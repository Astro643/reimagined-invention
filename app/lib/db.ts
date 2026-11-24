import postgres from "postgres"

export const sql = postgres(process.env.DATABASE_URL!, { max: 5, idle_timeout: 20 })

export async function initDb() {
  await sql`
    CREATE TABLE IF NOT EXISTS runs (
      id text PRIMARY KEY,
      user_id text NOT NULL,
      kind text NOT NULL DEFAULT 'agent',
      prompt text NOT NULL,
      plan jsonb,
      state jsonb,
      status text NOT NULL DEFAULT 'processing',
      result jsonb,
      approval jsonb,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `
  await sql`CREATE INDEX IF NOT EXISTS runs_user_status ON runs (user_id, status)`
  // Covers databases where runs was created before the approval column existed.
  await sql`ALTER TABLE runs ADD COLUMN IF NOT EXISTS approval jsonb`
  await sql`
    CREATE TABLE IF NOT EXISTS "user" (
      id text PRIMARY KEY,
      name text NOT NULL,
      email text NOT NULL UNIQUE,
      "emailVerified" boolean NOT NULL DEFAULT false,
      image text,
      plan text,
      "createdAt" timestamptz NOT NULL DEFAULT now(),
      "updatedAt" timestamptz NOT NULL DEFAULT now()
    )
  `
  // Covers databases where "user" was created before the plan column existed.
  await sql`ALTER TABLE "user" ADD COLUMN IF NOT EXISTS plan text`
  // Recovery phrase hash for password resets (username-only accounts).
  await sql`ALTER TABLE "user" ADD COLUMN IF NOT EXISTS recovery_hash text`
  await sql`
    CREATE TABLE IF NOT EXISTS "session" (
      id text PRIMARY KEY,
      "expiresAt" timestamptz NOT NULL,
      token text NOT NULL UNIQUE,
      "createdAt" timestamptz NOT NULL DEFAULT now(),
      "updatedAt" timestamptz NOT NULL DEFAULT now(),
      "ipAddress" text,
      "userAgent" text,
      "userId" text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE
    )
  `
  await sql`
    CREATE TABLE IF NOT EXISTS "account" (
      id text PRIMARY KEY,
      "accountId" text NOT NULL,
      "providerId" text NOT NULL,
      "userId" text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
      "accessToken" text,
      "refreshToken" text,
      "idToken" text,
      "accessTokenExpiresAt" timestamptz,
      "refreshTokenExpiresAt" timestamptz,
      scope text,
      password text,
      "createdAt" timestamptz NOT NULL DEFAULT now(),
      "updatedAt" timestamptz NOT NULL DEFAULT now()
    )
  `
  await sql`
    CREATE TABLE IF NOT EXISTS goal_kv (
      key text PRIMARY KEY,
      value jsonb NOT NULL,
      expires_at timestamptz,
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `
  await sql`
    CREATE TABLE IF NOT EXISTS "verification" (
      id text PRIMARY KEY,
      identifier text NOT NULL,
      value text NOT NULL,
      "expiresAt" timestamptz NOT NULL,
      "createdAt" timestamptz NOT NULL DEFAULT now(),
      "updatedAt" timestamptz NOT NULL DEFAULT now()
    )
  `
  // Signup rate limiting: one row per successful account creation, keyed by IP.
  await sql`
    CREATE TABLE IF NOT EXISTS signup_attempts (
      id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      ip text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now()
    )
  `
  await sql`CREATE INDEX IF NOT EXISTS signup_attempts_ip_time ON signup_attempts (ip, created_at)`
}

const SIGNUP_IP_LIMIT = 3

export async function signupIpAllowed(ip: string) {
  const rows = await sql`
    SELECT count(*)::int AS n FROM signup_attempts
    WHERE ip = ${ip} AND created_at > now() - interval '24 hours'
  `
  return ((rows[0] as { n: number } | undefined)?.n ?? 0) < SIGNUP_IP_LIMIT
}

export async function recordSignupIp(ip: string) {
  await sql`INSERT INTO signup_attempts (ip) VALUES (${ip})`
}

export interface UserRow {
  id: string
  email: string
  name: string
  plan: string | null
  recovery_hash: string | null
}

export async function getUserById(id: string) {
  const rows = await sql`
    SELECT id, email, name, plan, recovery_hash FROM "user" WHERE id = ${id}
  `
  return (rows[0] as UserRow | undefined) ?? null
}

export async function getUserByEmail(email: string) {
  const rows = await sql`
    SELECT id, email, name, plan, recovery_hash FROM "user" WHERE email = ${email}
  `
  return (rows[0] as UserRow | undefined) ?? null
}

export async function setRecoveryHash(userId: string, hash: string) {
  await sql`UPDATE "user" SET recovery_hash = ${hash}, "updatedAt" = now() WHERE id = ${userId}`
}

export async function setUserPassword(userId: string, passwordHash: string) {
  await sql`
    UPDATE account SET password = ${passwordHash}, "updatedAt" = now()
    WHERE "userId" = ${userId} AND "providerId" = 'credential'
  `
}

export interface RunRow {
  id: string
  user_id: string
  kind: string
  prompt: string
  plan: unknown
  state: unknown
  status: string
  result: unknown
  approval: unknown
  created_at?: string
  updated_at?: string
}

export async function createRun(id: string, userId: string, kind: string, prompt: string, plan: unknown) {
  await sql`
    INSERT INTO runs (id, user_id, kind, prompt, plan)
    VALUES (${id}, ${userId}, ${kind}, ${prompt}, ${plan === null || plan === undefined ? null : JSON.stringify(plan)}::jsonb)
  `
}

export async function getRun(id: string) {
  const rows = await sql`SELECT * FROM runs WHERE id = ${id}`
  return (rows[0] as RunRow | undefined) ?? null
}

export async function getRunStatus(id: string) {
  const rows = await sql`SELECT status FROM runs WHERE id = ${id}`
  return (rows[0] as { status: string } | undefined)?.status ?? null
}

export async function listResumableRuns() {
  const rows = await sql`
    SELECT * FROM runs WHERE status IN ('processing', 'awaiting_approval')
  `
  return rows as unknown as RunRow[]
}

export async function saveRunState(id: string, state: unknown) {
  await sql`UPDATE runs SET state = ${JSON.stringify(state)}::jsonb, updated_at = now() WHERE id = ${id}`
}

export async function setRunStatus(id: string, status: string, result?: unknown) {
  if (result === undefined) {
    await sql`UPDATE runs SET status = ${status}, updated_at = now() WHERE id = ${id}`
  } else {
    await sql`
      UPDATE runs SET status = ${status}, result = ${JSON.stringify(result)}::jsonb, updated_at = now()
      WHERE id = ${id}
    `
  }
}

export async function setRunResult(id: string, result: unknown) {
  await sql`UPDATE runs SET result = ${JSON.stringify(result)}::jsonb, updated_at = now() WHERE id = ${id}`
}

export async function setRunApproval(id: string, approval: unknown) {
  await sql`
    UPDATE runs SET approval = ${approval === null || approval === undefined ? null : JSON.stringify(approval)}::jsonb, updated_at = now()
    WHERE id = ${id}
  `
}

export async function requestRunCancel(id: string) {
  const rows = await sql`
    UPDATE runs SET status = 'cancelled', updated_at = now()
    WHERE id = ${id} AND status IN ('processing', 'awaiting_approval')
    RETURNING id
  `
  return rows.length > 0
}
