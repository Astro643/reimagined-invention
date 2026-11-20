import { executeAgentTool, type AgentToolResult } from "../lib/agent-tools.js";
import {
  MAX_AGENT_TURNS,
  generateAgentTurn,
  type AgentMessage,
  type AgentPlan,
} from "../lib/agent.js";

export interface AgentStepResult {
  tool: string;
  label: string;
  ok: boolean;
  output: string;
}

export interface AgentRunResult {
  prompt: string
  summary: string
  steps: AgentStepResult[]
  answer: string
}

export async function executeAgent(plan: AgentPlan): Promise<AgentRunResult> {
  "use workflow";
  return await run(plan);
}

async function run(plan: AgentPlan): Promise<AgentRunResult> {
  "use step";

  const steps: AgentStepResult[] = [];
  const messages: AgentMessage[] = [{ role: "user", content: plan.prompt }];

  const applyCall = async (call: AgentPlan["steps"][number]) => {
    const result: AgentToolResult = await executeAgentTool(call);
    steps.push({
      tool: call.tool,
      label: call.label,
      ok: result.ok,
      output: result.output,
    });
    messages.push({ role: "assistant", content: JSON.stringify({ type: "tool", call }) });
    messages.push({
      role: "tool",
      content: `${call.tool} (${result.ok ? "ok" : "failed"}): ${result.output}`,
    });
    return result;
  };

  for (const call of plan.steps) {
    if (steps.length >= MAX_AGENT_TURNS) break;
    await applyCall(call);
  }

  let answer = "";
  while (steps.length < MAX_AGENT_TURNS) {
    const turn = await generateAgentTurn(messages);
    if (turn.type === "final") {
      answer = turn.answer;
      break;
    }
    await applyCall(turn.call);
  }

  return { prompt: plan.prompt, summary: plan.summary, steps, answer: answer || "Agent run finished." };
}
