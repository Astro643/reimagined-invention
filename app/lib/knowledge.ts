import { keyCount } from "./gemini.js";

const FACTS = [
  "Product: Controller — agentic automation for Discord servers. Users interact with the bot directly in Discord to run tasks, inspect status, and cancel requests.",
  "Agent flow: describe a goal in plain language -> the agent creates a plan -> the workflow executes it -> status updates are shown in Discord.",
  "Request statuses and their exact meanings:",
  "- Processing: the plan is running right now.",
  "- Completed: every step finished. The result note shows what was done.",
  "- Failed: something went wrong; the note says what. Nothing is retried without the user's say-so — run it again.",
  "- Cancelled: the user stopped it.",
  "- Expired: the request waited too long and was retired.",
  "System status: GET /api/public/status shows the current system status.",
  "HTTP API (all JSON): POST /api/controller/agent/preview {prompt}; POST /api/controller/agent/execute {agent_plan}; GET /api/controller/agent/status/:id; POST /api/controller/agent/cancel/:id; POST /api/controller/agent/approve/:id; POST /api/preview {prompt}; POST /api/execute {prompt} or {prompt, plan}; GET /api/public/status; POST /api/support/chat {message, history}.",
  "Context: Controller is in a closed beta. It is not affiliated with Discord Inc.",
].join("\n");

const RULES =
  "You are Controller's support assistant. Answer clearly and briefly using ONLY the facts below. " +
  "If something is not covered by the facts or the live status, say you are not sure rather than inventing features.";

export function knowledgeSystem() {
  return `${RULES}\n\n## Facts\n${knowledgeFacts()}`;
}

export function knowledgeFacts() {
  const keys = keyCount();
  const status =
    keys > 0
      ? `Live status: All systems operational (${keys} Gemini API key configured).`
      : "Live status: DEGRADED — GEMINI_API_KEY is not configured, so AI features may fail right now.";
  return `${FACTS}\n\n${status}`;
}
