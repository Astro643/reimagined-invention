import { betterAuth } from "better-auth"
import { dash } from "@better-auth/infra"
import { Pool } from "pg"

import { sendMail } from "./mail.ts"

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
    sendResetPassword: async ({ user, url }) => {
      await sendMail({
        to: user.email,
        subject: "Reset your Controller password",
        html: `<p>Hi ${user.name || "there"},</p><p><a href="${url}">Click here to reset your password</a>. The link expires in 1 hour.</p><p>If you didn't request this, ignore this email.</p>`,
      })
    },
    resetPasswordTokenExpiresIn: 3600,
  },
  emailVerification: {
    // Verification is triggered after plan selection (see controller), not at signup.
    sendOnSignUp: false,
    sendVerificationEmail: async ({ user, url }) => {
      await sendMail({
        to: user.email,
        subject: "Verify your Controller email",
        html: `<p>Hi ${user.name || "there"},</p><p><a href="${url}">Click here to verify your email</a>.</p><p>If you didn't create a Controller account, ignore this email.</p>`,
      })
    },
  },
  user: {
    additionalFields: {
      plan: {
        type: "string",
        required: false,
        input: false,
      },
      trialUsed: {
        type: "boolean",
        required: false,
        input: false,
        defaultValue: false,
      },
      trialEndsAt: {
        type: "date",
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

// Re-exported for the controller: after a plan is chosen we email a
// verification link; better-auth's send-verification endpoint does the work.
export async function sendVerificationForUser(email: string, callbackURL: string) {
  try {
    await auth.api.sendVerificationEmail({
      body: { email, callbackURL },
    })
  } catch (error) {
    console.error("[auth] sendVerificationEmail failed:", error)
  }
}
