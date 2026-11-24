import { Sandbox } from "@vercel/sandbox";
import type { Plan } from "../lib/plan.js";
import { MAX_ACTION } from "../lib/plan.js";
import { validateAndFormatCurl } from "../lib/curl-formatter.js";

export interface StepResult {
  label: string
  ok: boolean
  detail: string
}

const clip = (s: string) => s.slice(0, MAX_ACTION).trim();

export async function executePlan(plan: Plan): Promise<StepResult[]> {
  "use workflow";
  return await run(plan);
}

async function run(plan: Plan): Promise<StepResult[]> {
  "use step";
  const results: StepResult[] = [];
  let sandbox: Sandbox | null = null;
  try {
    const networkPolicy = {
      allow: [
        "discord.com",
        "api.github.com",
        "github.com",
        "registry.npmjs.org",
        "pypi.org",
        "files.pythonhosted.org",
        "registry.yarnpkg.com",
      ],
    };

    const sbx = process.env.SANDBOX_SNAPSHOT_ID
      ? await Sandbox.create({
          source: { type: "snapshot", snapshotId: process.env.SANDBOX_SNAPSHOT_ID },
          persistent: false,
          networkPolicy,
        })
      : await Sandbox.create({ persistent: false, networkPolicy });
    sandbox = sbx;
    for (const step of plan.steps) {
      try {
        // Validate and format curl commands for Discord API
        const curlValidation = validateAndFormatCurl(step.action);
        if (!curlValidation.valid) {
          results.push({
            label: step.label,
            ok: false,
            detail: `Invalid curl command: ${curlValidation.error}`,
          });
          continue;
        }

        const cmd = await sbx.runCommand("sh", ["-lc", step.action], { timeoutMs: 60_000 });
        const out = clip(`${await cmd.stdout()}\n${await cmd.stderr()}`);
        results.push({ label: step.label, ok: cmd.exitCode === 0, detail: out });
      } catch (e) {
        results.push({ label: step.label, ok: false, detail: clip(String((e as Error)?.message ?? e)) });
      }
    }
  } catch (e) {
    const detail = clip(String((e as Error)?.message ?? e));
    for (const step of plan.steps.slice(results.length)) {
      results.push({ label: step.label, ok: false, detail });
    }
  } finally {
    if (sandbox) await sandbox.stop().catch(() => {});
  }
  return results;
}
