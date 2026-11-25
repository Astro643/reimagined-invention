import { betterAuth } from "better-auth"
import { dash } from "@better-auth/infra"
import { Pool } from "pg"

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 5,
  idleTimeoutMillis: 20_000,
})

// Development falls back to a throwaway secret so the server still boots without env vars.
// Production must set BETTER_AUTH_SECRET: signing sessions with a published default would let anyone forge one.
const secret = process.env.BETTER_AUTH_SECRET
if (!secret && process.env.NODE_ENV === "production") {
  throw new Error("BETTER_AUTH_SECRET must be set when NODE_ENV=production")
}

export const auth = betterAuth({
  appName: "Controller",
  baseURL: process.env.BETTER_AUTH_URL,
  secret: secret ?? "dev-only-insecure-secret-do-not-use-in-prod",
  database: pool,
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false,
  },
  user: {
    additionalFields: {
      plan: {
        type: "string",
        required: false,
        input: false,
      },
    },
  },
  plugins: [
    // Better Auth Infrastructure: hosted analytics/dashboard. No-op until
    // BETTER_AUTH_API_KEY is set (key comes from the infra dashboard).
    dash({ apiKey: process.env.BETTER_AUTH_API_KEY }),
  ],
})
