import { auth } from "../lib/auth.ts"
import { mailConfigured } from "../lib/mail.ts"
import { effectivePlan } from "../lib/tier.ts"
import { sql } from "../lib/db.ts"
import { ping } from "../lib/store.ts"
import { generateAgentPlan, generateAgentResponse, parseAgentPlanInput } from "../lib/agent.ts"
import { APPROVAL_TOOLS } from "../lib/agent-tools.ts"
import { knowledgeSystem } from "../lib/knowledge.ts"
import { generate, keyCount, MODELS } from "../lib/gemini.ts"
import { parsePlan } from "../lib/plan.ts"
import { countRecentRuns, createRun, getRun, requestRunCancel, setRunApproval, type RunRow } from "../lib/db.ts"
import { resolveRunControl, startAgentRun, startPlanRun } from "../lib/runner.ts"

const MAX_PROMPT = 5000
const MAX_CHAT = 600
const MAX_HISTORY = 8

interface SessionUser {
  id: string
  email?: string
  emailVerified?: boolean
  plan?: string | null
  trialUsed?: boolean | null
  trialEndsAt?: string | Date | null
}

async function sessionUser(request: Request): Promise<SessionUser | null> {
  try {
    const session = await auth.api.getSession({ headers: request.headers })
    return (session?.user as SessionUser | undefined) ?? null
  } catch {
    return null
  }
}

function bearerOk(request: Request) {
  const key = process.env.AGENT_API_KEY
  if (!key) return false
  return request.headers.get("authorization") === `Bearer ${key}`
}

// Session cookie OR the operator's bearer key (used by the Discord bot).
// Returns "unverified" when the account must confirm its email first.
async function requireActor(request: Request): Promise<SessionUser | "agent" | "unverified" | null> {
  if (bearerOk(request)) return "agent"
  const user = await sessionUser(request)
  if (user && mailConfigured() && !user.emailVerified) return "unverified"
  return user
}

function unauthorized() {
  return Response.json({ detail: "Authentication required. Please log in to use the Console." }, { status: 401 })
}

function actorDenied(actor: SessionUser | "agent" | "unverified" | null) {
  if (actor === "unverified") {
    return Response.json(
      { detail: "Please verify your email to continue.", code: "EMAIL_UNVERIFIED" },
      { status: 403 },
    )
  }
  if (actor === null) return unauthorized()
  if (actor !== "agent" && !effectivePlan(actor)) {
    return Response.json(
      { detail: "Choose a plan to continue.", code: "PLAN_REQUIRED" },
      { status: 403 },
    )
  }
  return null
}

// requireActor + gate checks in one step: returns the actor or a denial Response.
async function actorOrDeny(request: Request): Promise<SessionUser | "agent" | Response> {
  const actor = await requireActor(request)
  const denied = actorDenied(actor)
  return denied ?? (actor as SessionUser | "agent")
}

// Free tier: core toolsets (no browser automation) and a daily run cap.
// Trial and the operator bearer key are unlimited.
const FREE_DAILY_RUNS = () => {
  const n = Number(process.env.FREE_RUNS_PER_DAY ?? 10)
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 10
}

function isFreeActor(actor: SessionUser | "agent" | "unverified") {
  return actor !== "agent" && actor !== "unverified" && effectivePlan(actor) === "free"
}

const FREE_BLOCKED_TOOLS = new Set(["sandbox_browse"])

async function ownedRun(request: Request, id: string): Promise<RunRow | Response> {
  const actor = await actorOrDeny(request)
  if (actor instanceof Response) return actor
  let run: RunRow | null = null
  try {
    run = await getRun(id)
  } catch {
    run = null
  }
  if (!run) return Response.json({ detail: "Request not found." }, { status: 404 })
  if (actor !== "agent" && run.user_id !== actor.id) {
    return Response.json({ detail: "Request not found." }, { status: 404 })
  }
  return run
}

const clip = (s: string, max = 400) => (s.length > max ? s.slice(0, max) + "…" : s)

interface ResultShape {
  error?: string
  answer?: string
  summary?: string
  steps?: { label?: string; ok?: boolean; output?: string; detail?: string }[]
}

function formatResult(result: unknown): string {
  const r = (result ?? {}) as ResultShape
  const lines: string[] = []
  for (const step of Array.isArray(r.steps) ? r.steps : []) {
    const label = step.label ?? "step"
    const detail = step.output ?? step.detail ?? ""
    lines.push(`${step.ok ? "✓" : "✗"} ${label}${detail ? ` — ${clip(detail)}` : ""}`)
  }
  if (r.answer) lines.push(r.answer)
  if (r.summary && !lines.length) lines.push(r.summary)
  return lines.join("\n")
}

interface ApprovalShape {
  token?: string
  tool?: string
  label?: string
  decision?: string
}

function formatRun(run: RunRow) {
  const approval = (run.approval ?? null) as ApprovalShape | null
  const out: Record<string, unknown> = { id: run.id, status: run.status }
  if (run.status === "awaiting_approval" && approval && !approval.decision && approval.token) {
    out.approval = { approval_token: approval.token, label: approval.label, tool: approval.tool }
    return out
  }
  const result = (run.result ?? null) as ResultShape | null
  if (run.status === "completed") {
    out.result = formatResult(result)
  } else if (run.status === "failed") {
    out.error = result?.error || "Something went wrong."
  } else if (run.status === "cancelled") {
    out.result = "Cancelled by owner."
  }
  return out
}

async function readJson(request: Request) {
  return (await request.json().catch(() => ({}))) as Record<string, unknown>
}

function validPrompt(value: unknown, max = MAX_PROMPT) {
  return typeof value === "string" && value.trim().length > 0 && value.trim().length <= max
}

export async function agentPreview(context: { request: Request }) {
  const actor = await actorOrDeny(context.request)
  if (actor instanceof Response) return actor
  const body = await readJson(context.request)
  if (!validPrompt(body.prompt)) {
    return Response.json({ detail: `prompt must be a non-empty string of at most ${MAX_PROMPT} characters` }, { status: 400 })
  }
  try {
    const result = await generateAgentPlan(String(body.prompt).trim())
    // The console expects {complete, agent_plan, steps, question}; the agent
    // returns {type:"plan"|"answer"}. Map between the two contracts here.
    if (result.type === "answer") {
      return Response.json({ complete: false, incomplete: true, question: result.answer })
    }
    return Response.json({
      complete: true,
      summary: result.summary,
      steps: result.steps.map((step) => ({
        label: step.label,
        action: step.tool,
        requires_confirmation: APPROVAL_TOOLS.has(step.tool),
      })),
      agent_plan: result,
    })
  } catch (error) {
    console.error("agent preview failed:", error)
    return Response.json({ detail: "Could not generate agent preview right now." }, { status: 503 })
  }
}

export async function agentExecute(context: { request: Request }) {
  const actor = await actorOrDeny(context.request)
  if (actor instanceof Response) return actor
  const body = await readJson(context.request)
  const plan = parseAgentPlanInput(body.agent_plan)
  if (!plan) return Response.json({ detail: "a valid agent_plan from preview is required" }, { status: 400 })

  const runId = crypto.randomUUID()
  const userId = actor === "agent" ? "agent-api" : actor.id
  if (isFreeActor(actor)) {
    if (plan.steps.some((step) => FREE_BLOCKED_TOOLS.has(step.tool))) {
      return Response.json(
        { detail: "Browser automation requires a Trial plan. Remove sandbox_browse steps or upgrade." },
        { status: 403 },
      )
    }
    try {
      const used = await countRecentRuns(userId)
      if (used >= FREE_DAILY_RUNS()) {
        return Response.json(
          { detail: `Free plan allows ${FREE_DAILY_RUNS()} agent runs per day. Try again tomorrow or upgrade to Trial.` },
          { status: 429 },
        )
      }
    } catch (error) {
      console.error("run limit check failed:", error)
    }
  }
  try {
    await createRun(runId, userId, "agent", plan.prompt, plan)
    startAgentRun(runId)
    return Response.json({ command_id: runId, status: "processing" })
  } catch (error) {
    console.error("agent run start failed:", error)
    return Response.json({ detail: "Could not start the agent right now." }, { status: 503 })
  }
}

export async function getStatus(context: { request: Request; params: { id: string } }) {
  const run = await ownedRun(context.request, context.params.id)
  if (run instanceof Response) return run
  try {
    const fresh = await getRun(run.id)
    if (!fresh) return Response.json({ detail: "Request not found." }, { status: 404 })
    return Response.json(formatRun(fresh))
  } catch (error) {
    console.error("status lookup failed:", error)
    return Response.json({ detail: "Status temporarily unavailable." }, { status: 503 })
  }
}

export async function cancelRun(context: { request: Request; params: { id: string } }) {
  const run = await ownedRun(context.request, context.params.id)
  if (run instanceof Response) return run
  try {
    const cancelled = await requestRunCancel(run.id)
    resolveRunControl(run.id)
    if (!cancelled) {
      const fresh = await getRun(run.id)
      return Response.json({ id: run.id, status: fresh?.status ?? "unknown" })
    }
    return Response.json({ id: run.id, status: "cancelled" })
  } catch (error) {
    console.error("cancel failed:", error)
    return Response.json({ detail: "Could not cancel right now." }, { status: 503 })
  }
}

export async function approveRun(context: { request: Request; params: { id: string } }) {
  const run = await ownedRun(context.request, context.params.id)
  if (run instanceof Response) return run
  const body = await readJson(context.request)
  const token = typeof body.approval_token === "string" ? body.approval_token : ""
  const approved = body.approved === true
  try {
    const fresh = await getRun(run.id)
    const approval = fresh?.approval as { token?: string; decision?: string } | null
    if (!fresh || fresh.status !== "awaiting_approval" || !approval || approval.token !== token || approval.decision) {
      return Response.json({ detail: "That approval request is no longer pending." }, { status: 409 })
    }
    await setRunApproval(run.id, { ...(fresh.approval as object), decision: approved ? "approved" : "rejected" })
    resolveRunControl(run.id)
    return Response.json({ id: run.id, status: approved ? "processing" : "processing" })
  } catch (error) {
    console.error("approve failed:", error)
    return Response.json({ detail: "Could not record that decision." }, { status: 503 })
  }
}

export async function preview(context: { request: Request }) {
  const actor = await actorOrDeny(context.request)
  if (actor instanceof Response) return actor
  const body = await readJson(context.request)
  if (!validPrompt(body.prompt)) {
    return Response.json({ detail: "prompt must be between 1 and 5000 characters" }, { status: 400 })
  }
  try {
    const response = await generateAgentResponse(String(body.prompt).trim())
    return Response.json(response)
  } catch (error) {
    console.error("preview failed:", error)
    return Response.json({ detail: "Could not generate preview right now." }, { status: 503 })
  }
}

export async function execute(context: { request: Request }) {
  const actor = await actorOrDeny(context.request)
  if (actor instanceof Response) return actor
  const body = await readJson(context.request)
  const userId = actor === "agent" ? "agent-api" : actor.id
  if (isFreeActor(actor)) {
    try {
      const used = await countRecentRuns(userId)
      if (used >= FREE_DAILY_RUNS()) {
        return Response.json(
          { detail: `Free plan allows ${FREE_DAILY_RUNS()} runs per day. Try again tomorrow or upgrade to Trial.` },
          { status: 429 },
        )
      }
    } catch (error) {
      console.error("run limit check failed:", error)
    }
  }

  if (body.plan) {
    const plan = parsePlan(body.plan)
    if (!plan) return Response.json({ detail: "a valid plan is required" }, { status: 400 })
    const runId = crypto.randomUUID()
    try {
      await createRun(runId, userId, "plan", plan.summary, plan)
      startPlanRun(runId)
      return Response.json({ command_id: runId, status: "processing" })
    } catch (error) {
      console.error("plan run start failed:", error)
      return Response.json({ detail: "Could not start execution right now." }, { status: 503 })
    }
  }
  if (validPrompt(body.prompt)) {
    try {
      const response = await generateAgentResponse(String(body.prompt).trim())
      if (response.type === "plan") {
        const runId = crypto.randomUUID()
        await createRun(runId, userId, "plan", response.plan.summary, response.plan)
        startPlanRun(runId)
        return Response.json({ command_id: runId, status: "processing" })
      }
      return Response.json(response)
    } catch (error) {
      console.error("execute failed:", error)
      return Response.json({ detail: "Could not execute right now." }, { status: 503 })
    }
  }
  return Response.json({ detail: "prompt or plan is required" }, { status: 400 })
}

export async function publicStatus() {
  const check = async (p: Promise<unknown>) => {
    try {
      await p
      return true
    } catch {
      return false
    }
  }
  const [storeUp, dbUp] = await Promise.all([check(ping()), check(sql`SELECT 1`)])
  const keys = keyCount()
  const components = [
    {
      name: "Agent store",
      detail: storeUp ? "Postgres goal store reachable" : "Postgres goal store unreachable",
      status: storeUp ? "operational" : "outage",
    },
    {
      name: "Database",
      detail: dbUp ? "Postgres reachable" : "Postgres unreachable",
      status: dbUp ? "operational" : "outage",
    },
    {
      name: "AI models",
      detail: keys > 0 ? `${keys} Gemini key${keys === 1 ? "" : "s"} configured` : "No Gemini API key configured",
      status: keys > 0 ? "operational" : "outage",
    },
  ]
  const ok = storeUp && dbUp && keys > 0
  return Response.json({
    overall: ok ? "operational" : "degraded",
    label: ok ? "All systems operational" : "Degraded — some services are impaired",
    updated: new Date().toISOString(),
    components,
    status: ok ? "operational" : "degraded",
    message: ok ? "All systems operational" : "Degraded — a backend dependency is unavailable",
  })
}

// supportChat is public (the widget sits on marketing pages), so it needs its
// own abuse guard: Gemini spend is metered per IP.
const chatHits = new Map<string, number[]>()
const CHAT_LIMIT = 20
const CHAT_WINDOW_MS = 60_000

function chatAllowed(ip: string) {
  const now = Date.now()
  const hits = (chatHits.get(ip) ?? []).filter((t) => now - t < CHAT_WINDOW_MS)
  if (hits.length >= CHAT_LIMIT) {
    chatHits.set(ip, hits)
    return false
  }
  hits.push(now)
  chatHits.set(ip, hits)
  if (chatHits.size > 5000) chatHits.clear()
  return true
}

export async function supportChat(context: { request: Request }) {
  const ip = context.request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local"
  if (!chatAllowed(ip)) {
    return Response.json({ detail: "Too many messages. Please try again in a minute." }, { status: 429 })
  }
  const body = await readJson(context.request)
  const message = typeof body.message === "string" ? body.message.trim().slice(0, MAX_CHAT) : ""
  if (!message) {
    return Response.json({ detail: "message is required" }, { status: 400 })
  }
  const history = Array.isArray(body.history) ? body.history.slice(-MAX_HISTORY) : []
  const convo = history
    .filter(
      (m): m is { role: string; text: string } =>
        !!m && typeof m === "object" &&
        ((m as { role?: unknown }).role === "user" || (m as { role?: unknown }).role === "assistant") &&
        typeof (m as { text?: unknown }).text === "string",
    )
    .map((m) => `${m.role}: ${String(m.text).slice(0, 800)}`)
    .join("\n")
  try {
    const reply = await generate(
      MODELS.support,
      convo ? `${convo}\nuser: ${message}` : message,
      knowledgeSystem(),
    )
    return Response.json({ reply })
  } catch (error) {
    console.error("support chat failed:", error)
    return Response.json({ detail: "Could not generate response right now." }, { status: 503 })
  }
}
