import { Box } from "@upstash/box"

import { kvDel, kvGet, kvSet } from "./store.ts"

const STEP_TIMEOUT_MS = 120_000
const BOX_KEY = (runId: string) => `box:${runId}`

let warned = false

export interface BoxRunResult {
  ok: boolean
  output: string
}

const clip = (s: string, max = 6000) => (s.length > max ? s.slice(0, max) + "…" : s)

// One persistent Box per run: shell steps run through exec, and the
// headless Chromium (browser: true) serves browser-automation tools.
// The box id is stored in Postgres so a restarted process can re-attach.
// Egress allowlist for boxes that hold secrets (DISCORD_TOKEN). Plan/exec
// steps are arbitrary shell commands, so network policy — not input
// filtering — is what actually prevents token exfiltration to
// attacker-controlled hosts. Extra domains can be added without a deploy via
// PLAN_BOX_ALLOWED_DOMAINS (comma-separated).
const BASE_EGRESS = [
  // Discord API + CDN
  "discord.com",
  "discordapp.com",
  "cdn.discordapp.com",
  "media.discordapp.net",
  // Package registries / dev hosts (npm install, git clone, pip, apt)
  "registry.npmjs.org",
  "npmjs.com",
  "github.com",
  "api.github.com",
  "raw.githubusercontent.com",
  "objects.githubusercontent.com",
  "codeload.github.com",
  "nodejs.org",
  "pypi.org",
  "files.pythonhosted.org",
  "deb.debian.org",
  "security.debian.org",
  "archive.ubuntu.com",
  "security.ubuntu.com",
]

const extraEgress = (process.env.PLAN_BOX_ALLOWED_DOMAINS ?? "")
  .split(",")
  .map((d) => d.trim().toLowerCase())
  .filter(Boolean)

const PLAN_BOX_EGRESS = {
  mode: "custom" as const,
  allowedDomains: [...BASE_EGRESS, ...extraEgress],
}

export async function getOrCreateBox(
  runId: string,
  env?: Record<string, string>,
  opts?: { restrictEgress?: boolean },
): Promise<Box> {
  const existing = await kvGet<string>(BOX_KEY(runId))
  if (existing) {
    const box = await Box.get(existing)
    await box.resume().catch(() => {})
    return box
  }
  const box = await Box.create({
    name: `run-${runId.slice(0, 8)}`,
    labels: ["app:controller", `run:${runId.slice(0, 8)}`],
    runtime: "node",
    browser: true,
    size: "small",
    ...(env && Object.keys(env).length ? { env } : {}),
    ...(opts?.restrictEgress ? { networkPolicy: PLAN_BOX_EGRESS } : {}),
  })
  await kvSet(BOX_KEY(runId), box.id)
  return box
}

export async function runBoxCommand(box: Box, command: string, timeoutMs = STEP_TIMEOUT_MS): Promise<BoxRunResult> {
  let stream
  try {
    stream = await box.exec.stream(command)
  } catch (error) {
    return { ok: false, output: clip(String((error as Error)?.message ?? error), 2000) }
  }
  let output = ""
  let exitCode: number | null = null
  const deadline = Date.now() + timeoutMs
  try {
    for await (const chunk of stream) {
      if (chunk.type === "output") {
        output += chunk.data
      } else if (chunk.type === "exit") {
        exitCode = chunk.exitCode
        break
      }
      if (Date.now() > deadline) {
        await stream.cancel().catch(() => {})
        return { ok: false, output: "Step timed out." }
      }
    }
  } catch (error) {
    return { ok: false, output: clip(String((error as Error)?.message ?? error), 2000) }
  }
  const ok = exitCode === 0
  return { ok, output: clip(output || (ok ? "" : "Command failed.")) }
}

export async function deleteRunBox(runId: string) {
  const id = await kvGet<string>(BOX_KEY(runId))
  if (!id) return
  await kvDel(BOX_KEY(runId)).catch(() => {})
  await Box.delete({ boxIds: id }).catch((error) => {
    if (!warned) {
      warned = true
      console.error("[box] delete failed:", error)
    }
  })
}
