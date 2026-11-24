import { betterAuth } from "better-auth"
import { dash } from "@better-auth/infra"
import { Pool } from "pg"

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 5,
  idleTimeoutMillis: 20_000,
})

export const auth = betterAuth({
  appName: "Controller",
  baseURL: process.env.BETTER_AUTH_URL,
  // Falls back to a dev-only secret so the server still boots without env
  // vars; production deploys must set BETTER_AUTH_SECRET.
  secret: process.env.BETTER_AUTH_SECRET ?? "dev-only-insecure-secret-do-not-use-in-prod",
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
