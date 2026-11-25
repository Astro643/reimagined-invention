import { Destination, NetworkPolicy, Rule, Sandbox } from "microsandbox"

import { kvDel, kvGet, kvSet } from "./store.ts"

const STEP_TIMEOUT_MS = 120_000
const BOX_KEY = (runId: string) => `box:${runId}`
const BOX_NAME = (runId: string) => `run-${runId.slice(0, 8)}`

let warned = false

export interface BoxRunResult {
  ok: boolean
  output: string
}

// The sandbox handle wrapper: runner only passes it back to runBoxCommand,
// and agent tools use `id`/`name` for bookkeeping.
export interface RunBox {
  id: string
  name: string
  sandbox: Sandbox
}

const clip = (s: string, max = 6000) => (s.length > max ? s.slice(0, max) + "…" : s)

// One persistent microVM per run. The sandbox name is stored in Postgres so a
// restarted process can re-attach via Sandbox.getRunning.
// Egress allowlist for boxes that hold secrets (DISCORD_TOKEN). Steps are
// arbitrary shell commands, so network policy — not input filtering — is what
// actually prevents token exfiltration to attacker-controlled hosts. Secrets
// are injected via secretEnv: the real value never enters the guest and is
// only substituted for allow-listed destinations. Extra domains can be added
// without a deploy via PLAN_BOX_ALLOWED_DOMAINS (comma-separated).
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

const egressDomains = () => [...BASE_EGRESS, ...extraEgress]

const DISCORD_SECRET_HOSTS = [
  "discord.com",
  "discordapp.com",
  "cdn.discordapp.com",
  "media.discordapp.net",
]

function planNetworkPolicy(): NetworkPolicy {
  return {
    defaultEgress: "deny",
    defaultIngress: "allow",
    rules: [
      Rule.allowDns(),
      ...egressDomains().map((d) => Rule.allowEgress(Destination.domain(d))),
    ],
  }
}

export interface BoxOptions {
  env?: Record<string, string>
  // Values that must never enter the guest: injected as placeholders that the
  // microsandbox network layer substitutes only for allowed hosts.
  secrets?: Record<string, string>
  restrictEgress?: boolean
}

export async function getOrCreateBox(runId: string, opts?: BoxOptions): Promise<RunBox> {
  const name = BOX_NAME(runId)
  const stored = await kvGet<string>(BOX_KEY(runId))
  const lookup = stored ?? name
  try {
    const existing = await Sandbox.getRunning(lookup)
    return { id: existing.id, name: existing.name, sandbox: existing }
  } catch {
    // Missing or stopped-unrecoverable: fall through to create/connect.
  }

  let builder = Sandbox.builder(name)
    .image(process.env.MSB_IMAGE ?? "node:22-bookworm")
    .cpus(1)
    .memory(1024)
    .labels({ app: "controller", run: runId.slice(0, 8) })

  if (opts?.env && Object.keys(opts.env).length) builder = builder.envs(opts.env)
  for (const [key, value] of Object.entries(opts?.secrets ?? {})) {
    const hosts = key === "DISCORD_TOKEN" ? DISCORD_SECRET_HOSTS : egressDomains()
    builder = builder.secret((b) => {
      b.env(key).value(value)
      b.substituteInHeaders(true).substituteInQuery(true).substituteInBody(true)
      for (const host of hosts) b.allow(host)
      return b
    })
  }
  if (opts?.restrictEgress) {
    builder = builder.network((n) => n.policy(planNetworkPolicy()))
  }

  const sandbox = await builder.connectOrCreate()
  await kvSet(BOX_KEY(runId), sandbox.name)
  return { id: sandbox.id, name: sandbox.name, sandbox }
}

export async function runBoxCommand(box: RunBox, command: string, timeoutMs = STEP_TIMEOUT_MS): Promise<BoxRunResult> {
  try {
    const out = await box.sandbox.execWith("/bin/sh", (b) =>
      b.args(["-c", command]).timeoutMilliseconds(timeoutMs).stdinNull(),
    )
    const output = clip([out.stdout(), out.stderr()].filter(Boolean).join("\n") || (out.success ? "" : "Command failed."))
    return { ok: out.success, output }
  } catch (error) {
    return { ok: false, output: clip(String((error as Error)?.message ?? error), 2000) }
  }
}

export async function deleteRunBox(runId: string) {
  const name = await kvGet<string>(BOX_KEY(runId))
  if (!name) return
  await kvDel(BOX_KEY(runId)).catch(() => {})
  try {
    const sandbox = await Sandbox.get(name)
    await sandbox.stop().catch(() => {})
    await Sandbox.remove(name)
  } catch (error) {
    if (!warned) {
      warned = true
      console.error("[box] delete failed:", error)
    }
  }
}
