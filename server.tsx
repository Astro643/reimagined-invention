import { start } from "workflow/api"
import { parseAgentPlanInput, generateAgentPlan } from "../lib/agent.js"
import { executeAgent } from "../workflows/agent.js"
import { generateAgentResponse } from "../lib/agent.js"
import { knowledgeSystem } from "../lib/knowledge.js"
import { generateJson, MODELS } from "../lib/gemini.js"
import { parsePlan } from "../lib/plan.js"
import { executePlan } from "../workflows/execute.js"

export async function agentPreview(context: { request: Request }) {
  const body = await context.request.json().catch(() => ({} as { prompt?: unknown }))
  if (typeof body.prompt !== "string" || !body.prompt.trim() || body.prompt.length > 2000) {
    return Response.json({ detail: "prompt must be a non-empty string of at most 2000 characters" }, { status: 400 })
  }
  try {
    const plan = await generateAgentPlan(body.prompt.trim())
    return Response.json(plan)
  } catch (error) {
    console.error("agent preview failed:", error)
    return Response.json({ detail: "Could not generate agent preview right now." }, { status: 503 })
  }
}

export async function agentExecute(context: { request: Request }) {
  const body = await context.request.json().catch(() => ({} as { agent_plan?: unknown }))
  const plan = parseAgentPlanInput(body.agent_plan)
  if (!plan) return Response.json({ detail: "a valid agent_plan from preview is required" }, { status: 400 })

  try {
    const run = await start(executeAgent, [plan])
    return Response.json({ command_id: run.runId, status: "processing" })
  } catch (error) {
    console.error("agent workflow start failed:", error)
    return Response.json({ detail: "Could not start the agent right now." }, { status: 503 })
  }
}

export async function getStatus(context: { request: Request; params: { id: string } }) {
  return Response.json({ id: context.params.id, status: "unknown" })
}

export async function cancelRun(context: { request: Request; params: { id: string } }) {
  return Response.json({ id: context.params.id, status: "cancelled" })
}

export async function approveRun(context: { request: Request; params: { id: string } }) {
  return Response.json({ id: context.params.id, status: "approved" })
}

export async function preview(context: { request: Request }) {
  const body = await context.request.json().catch(() => ({} as { prompt?: unknown }))
  if (typeof body.prompt !== "string" || !body.prompt.trim() || body.prompt.length > 5000) {
    return Response.json({ detail: "prompt must be between 1 and 5000 characters" }, { status: 400 })
  }
  try {
    const response = await generateAgentResponse(body.prompt.trim())
    return Response.json(response)
  } catch (error) {
    console.error("preview failed:", error)
    return Response.json({ detail: "Could not generate preview right now." }, { status: 503 })
  }
}

export async function execute(context: { request: Request }) {
  const body = await context.request.json().catch(() => ({} as { prompt?: unknown; plan?: unknown }))
  if (body.plan) {
    const plan = parsePlan(body.plan)
    if (!plan) return Response.json({ detail: "a valid plan is required" }, { status: 400 })
    try {
      const run = await start(executePlan, [plan])
      return Response.json({ command_id: run.runId, status: "processing" })
    } catch (error) {
      console.error("execute workflow start failed:", error)
      return Response.json({ detail: "Could not start execution right now." }, { status: 503 })
    }
  }
  if (body.prompt) {
    if (typeof body.prompt !== "string" || !body.prompt.trim() || body.prompt.length > 5000) {
      return Response.json({ detail: "prompt must be between 1 and 5000 characters" }, { status: 400 })
    }
    try {
      const response = await generateAgentResponse(body.prompt.trim())
      if (response.type === "plan") {
        const run = await start(executePlan, [response.plan])
        return Response.json({ command_id: run.runId, status: "processing" })
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
  return Response.json({
    status: "operational",
    message: "All systems operational",
  })
}

export async function supportChat(context: { request: Request }) {
  const body = await context.request.json().catch(() => ({} as { message?: unknown; history?: unknown }))
  if (typeof body.message !== "string" || !body.message.trim()) {
    return Response.json({ detail: "message is required" }, { status: 400 })
  }
  try {
    const response = await generateJson<unknown>(MODELS.support, body.message.trim(), knowledgeSystem())
    return Response.json({ response })
  } catch (error) {
    console.error("support chat failed:", error)
    return Response.json({ detail: "Could not generate response right now." }, { status: 503 })
  }
}
