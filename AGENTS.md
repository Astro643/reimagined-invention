# Controller — unified Remix app

Single Remix 3.2.0 app: marketing site + Console overlay + agent backend
(native Remix Request/Response routes under `app/actions/`).

## Commands

- `npm run dev` — dev server on :5173 (NODE_ENV=development)
- `npm start` — production server (`PORT` env, default 5173)
- `npm run typecheck` — `tsc --noEmit`

## Architecture

- Routes/actions: `app/routes.ts` + `app/actions/controller.tsx` (pages/forms)
  and `app/actions/server.tsx` (JSON API for the Console + bot).
- Pages: `app/pages/*`; client entries: `app/ui/*` (`console.tsx` overlay,
  `support-widget.tsx`). Console opens via `[data-open-console]` links or ⌘K;
  `/dashboard` requires a session with `user.plan` and auto-opens it.
- Auth: Better Auth (`app/lib/auth.ts`) — username+password (no email; the
  username maps to a synthetic `*@users.local` address), no email verification,
  Postgres via `pg` Pool, `dash()` infra plugin for analytics. Signup shows a
  one-time user ID + 26-word recovery phrase (`user.recovery_hash`); `/reset`
  verifies the phrase to set a new password. Signup is rate-limited to 3/IP/24h
  (`signup_attempts` table). Login/signup/plan are native form posts; handler
  mounted at `/api/auth/*` in `server.ts`. Tiers: trial (30-day wipe) and free
  (core toolsets, no `sandbox_browse`, `FREE_RUNS_PER_DAY` cap, default 10).
- Agent pipeline (in-process, durable via Postgres): `app/lib/runner.ts`
  executes agent runs (multi-turn tool loop from `app/lib/agent.ts` +
  `app/lib/agent-tools.ts`) and shell-plan runs (`app/lib/plan.ts` steps in an
  Upstash Box, `app/lib/box.ts`). Runs live in the `runs` table; state/steps/
  pending approvals persist in `state`/`approval` jsonb, so `resumeRuns()` at
  boot continues interrupted work. Destructive Discord tools pause for owner
  approval (`awaiting_approval` + `approval_token`).
- Storage: Render Postgres via `postgres` (postgres.js) — `app/lib/db.ts`
  (`runs`, Better Auth tables, `goal_kv`, `signup_attempts`) and
  `app/lib/store.ts` (kv). `purgeStale()` runs hourly + at boot: expired
  sessions/verification rows and finished runs older than 30 days.
- Execution: Upstash Box per run (`browser: true` → headless Chromium for the
  `sandbox_browse` tool); box id persisted in `goal_kv` for crash resume.
- Bot-facing JSON API also accepts `Authorization: Bearer $AGENT_API_KEY`.

## Env vars (see .env.example)

`DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `BETTER_AUTH_API_KEY` (optional, infra dashboard), `UPSTASH_BOX_API_KEY`,
`GEMINI_API_KEY` (or `GEMINI_API_KEYS`/`GEMINI_API_KEY_1..4`), `DISCORD_TOKEN`,
`DISCORD_GUILD_ID`, optional `AGENT_API_KEY`, `MODEL_*`, `PORT`, `NODE_ENV`.

Deploy: `render.yaml` (Render web service, `npm ci` / `npm start`).
