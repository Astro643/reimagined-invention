import { getRun, getRunStatus, listResumableRuns, saveRunState, setRunApproval, setRunStatus, type RunRow } from "./db.ts"
import {
  APPROVAL_TOOLS,
  closeBrowserTab,
  executeAgentTool,
  type AgentToolCall,
  type AgentToolResult,
} from "./agent-tools.ts"
import { generateAgentTurn, MAX_AGENT_TURNS, type AgentMessage, type AgentPlan } from "./agent.ts"
import { parsePlan, type Plan } from "./plan.ts"
import { validateAndFormatCurl } from "./curl-formatter.ts"
import { deleteRunBox, getOrCreateBox, runBoxCommand } from "./box.ts"

const DECISION_POLL_MS = 2000
const APPROVAL_TIMEOUT_MS = 24 * 60 * 60 * 1000
const PLAN_STEP_TIMEOUT_MS = 120_000

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

// In-memory wake-ups so an approve/cancel request does not wait for the next poll.
const waiters = new Map<string, () => void>()

function wake(runId: string) {
  const fn = waiters.get(runId)
  if (fn) {
    waiters.delete(runId)
    fn()
  }
}

export function resolveRunControl(runId: string) {
  wake(runId)
}

interface ApprovalInfo {
  token: string
  tool: string
  label: string
  call: AgentToolCall
  decision?: "approved" | "rejected"
}

interface AgentState {
  messages: AgentMessage[]
  steps: { tool: string; label: string; ok: boolean; output: string }[]
  queue: AgentToolCall[]
  answer?: string
}

interface PlanState {
  index: number
  results: { label: string; ok: boolean; detail: string }[]
}

function initialAgentState(run: RunRow, plan: AgentPlan): AgentState {
  const prior = (run.state ?? null) as Partial<AgentState> | null
  return {
    messages: Array.isArray(prior?.messages) && prior.messages.length
      ? prior.messages
      : [{ role: "user", content: plan.prompt }],
    steps: Array.isArray(prior?.steps) ? prior.steps : [],
    queue: Array.isArray(prior?.queue) ? prior.queue : [...plan.steps],
    answer: prior?.answer,
  }
}

function initialPlanState(run: RunRow): PlanState {
  const prior = (run.state ?? null) as Partial<PlanState> | null
  return {
    index: typeof prior?.index === "number" ? prior.index : 0,
    results: Array.isArray(prior?.results) ? prior.results : [],
  }
}

async function isCancelled(runId: string) {
  return (await getRunStatus(runId)) === "cancelled"
}

async function waitTick(runId: string) {
  let fn: (() => void) | undefined
  await Promise.race([
    new Promise<void>((resolve) => {
      fn = () => resolve()
      waiters.set(runId, fn)
    }),
    sleep(DECISION_POLL_MS),
  ])
  if (fn) waiters.delete(runId)
}

// Waits for the owner to approve or reject a destructive tool call. The pending
// call and its decision live in the runs.approval column so a restart resumes
// the wait instead of losing it.
async function awaitApproval(runId: string, call: AgentToolCall): Promise<"approved" | "rejected" | "cancelled"> {
  const current = await getRun(runId)
  const existing = current?.approval as ApprovalInfo | null
  if (!existing || existing.call.tool !== call.tool || JSON.stringify(existing.call.arguments) !== JSON.stringify(call.arguments)) {
    const approval: ApprovalInfo = {
      token: crypto.randomUUID(),
      tool: call.tool,
      label: call.label,
      call,
    }
    await setRunApproval(runId, approval)
    await setRunStatus(runId, "awaiting_approval")
  } else if (existing.decision) {
    await setRunApproval(runId, null)
    await setRunStatus(runId, "processing")
    return existing.decision
  }

  const deadline = Date.now() + APPROVAL_TIMEOUT_MS
  while (Date.now() < deadline) {
    const run = await getRun(runId)
    if (!run) return "cancelled"
    if (run.status === "cancelled") return "cancelled"
    const approval = run.approval as ApprovalInfo | null
    if (approval?.decision) {
      await setRunApproval(runId, null)
      await setRunStatus(runId, "processing")
      return approval.decision
    }
    await waitTick(runId)
  }
  await setRunApproval(runId, null)
  await setRunStatus(runId, "processing")
  return "rejected"
}

function pushToolExchange(state: AgentState, call: AgentToolCall, result: AgentToolResult) {
  state.messages.push({ role: "assistant", content: JSON.stringify({ type: "tool", call }) })
  state.messages.push({
    role: "tool",
    content: `${call.tool} (${result.ok ? "ok" : "failed"}): ${result.output}`,
  })
  state.steps.push({ tool: call.tool, label: call.label, ok: result.ok, output: result.output })
}

async function finishRun(runId: string, status: string, result: unknown) {
  await setRunStatus(runId, status, result)
  closeBrowserTab(runId)
  await deleteRunBox(runId).catch(() => {})
}

async function failRun(runId: string, error: unknown) {
  console.error(`run ${runId} failed:`, error)
  await finishRun(runId, "failed", {
    error: error instanceof Error ? error.message : String(error),
  }).catch(() => {})
}

export function startAgentRun(runId: string) {
  void runAgent(runId).catch((error) => failRun(runId, error))
}

export function startPlanRun(runId: string) {
  void runPlan(runId).catch((error) => failRun(runId, error))
}

async function runAgent(runId: string) {
  const run = await getRun(runId)
  if (!run) return
  const plan = run.plan as AgentPlan | null
  if (!plan?.steps) {
    await finishRun(runId, "failed", { error: "Missing agent plan." })
    return
  }
  const state = initialAgentState(run, plan)
  await saveRunState(runId, state)

  try {
    // A pending approval survives restarts: resolve it before generating turns.
    // awaitApproval returns an existing decision immediately, so a call that was
    // approved but not yet executed still runs exactly once.
    const pending = run.approval as ApprovalInfo | null
    if (pending?.call) {
      const decision = await awaitApproval(runId, pending.call)
      if (decision === "cancelled") {
        await finishRun(runId, "cancelled", { summary: plan.summary, steps: state.steps, answer: "Cancelled by owner." })
        return
      }
      const result: AgentToolResult =
        decision === "approved"
          ? await executeAgentTool(pending.call, { runId })
          : { ok: false, output: "Rejected by the owner." }
      pushToolExchange(state, pending.call, result)
      await saveRunState(runId, state)
    }

    while (state.steps.length < MAX_AGENT_TURNS) {
      if (await isCancelled(runId)) {
        await finishRun(runId, "cancelled", { summary: plan.summary, steps: state.steps, answer: "Cancelled by owner." })
        return
      }

      let call = state.queue.shift() ?? null
      if (!call) {
        const turn = await generateAgentTurn(state.messages)
        if (turn.type === "final") {
          state.answer = turn.answer
          break
        }
        call = turn.call
      }

      if (APPROVAL_TOOLS.has(call.tool)) {
        const decision = await awaitApproval(runId, call)
        if (decision === "cancelled") {
          await finishRun(runId, "cancelled", { summary: plan.summary, steps: state.steps, answer: "Cancelled by owner." })
          return
        }
        const result: AgentToolResult =
          decision === "approved"
            ? await executeAgentTool(call, { runId })
            : { ok: false, output: "Rejected by the owner." }
        pushToolExchange(state, call, result)
      } else {
        const result = await executeAgentTool(call, { runId })
        pushToolExchange(state, call, result)
      }
      await saveRunState(runId, state)
    }

    await finishRun(runId, "completed", {
      prompt: plan.prompt,
      summary: plan.summary,
      steps: state.steps,
      answer: state.answer || "Agent run finished.",
    })
  } catch (error) {
    await failRun(runId, error)
  }
}

async function runPlan(runId: string) {
  const run = await getRun(runId)
  if (!run) return
  const plan = parsePlan(run.plan)
  if (!plan) {
    await finishRun(runId, "failed", { error: "Missing or invalid plan." })
    return
  }
  const state = initialPlanState(run)
  await saveRunState(runId, state)

  const env: Record<string, string> = {}
  if (process.env.DISCORD_TOKEN) env.DISCORD_TOKEN = process.env.DISCORD_TOKEN
  const box = await getOrCreateBox(runId, env)

  try {
    while (state.index < plan.steps.length) {
      if (await isCancelled(runId)) {
        await finishRun(runId, "cancelled", { steps: state.results })
        return
      }
      const step = plan.steps[state.index]
      const curl = validateAndFormatCurl(step.action)
      if (!curl.valid) {
        state.results.push({ label: step.label, ok: false, detail: `Invalid curl command: ${curl.error}` })
      } else {
        const res = await runBoxCommand(box, step.action, PLAN_STEP_TIMEOUT_MS)
        state.results.push({ label: step.label, ok: res.ok, detail: res.output })
      }
      state.index += 1
      await saveRunState(runId, state)
    }
    await finishRun(runId, "completed", { summary: plan.summary, steps: state.results })
  } catch (error) {
    await failRun(runId, error)
  }
}

// Runs once at server boot: anything still in flight rejoins the pipeline.
// Agent runs resume from their persisted message/step state (including a
// pending approval wait); plan runs resume at the next unexecuted step on
// the same Box.
export async function resumeRuns() {
  try {
    const runs = await listResumableRuns()
    for (const run of runs) {
      if (run.kind === "plan") {
        startPlanRun(run.id)
      } else {
        startAgentRun(run.id)
      }
    }
  } catch (error) {
    console.error("run recovery failed:", error)
  }
}
