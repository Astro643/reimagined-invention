import { createController } from "remix/router"
import { redirect } from "remix/response/redirect"

import { assets } from "../assets.ts"
import { signupIpAllowed, recordSignupIp, setUserPlan } from "../lib/db.ts"
import { mailConfigured } from "../lib/mail.ts"
import { auth, sendVerificationForUser } from "../lib/auth.ts"
import { canClaimTrial, effectivePlan } from "../lib/tier.ts"
import { routes } from "../routes.ts"
import { AboutPage, meta as aboutMeta } from "../pages/about.tsx"
import { DashboardPage, meta as dashboardMeta } from "../pages/dashboard.tsx"
import { DocsPage, meta as docsMeta } from "../pages/docs.tsx"
import { ForgotPage, meta as forgotMeta } from "../pages/forgot.tsx"
import { HomePage, meta as homeMeta } from "../pages/home.tsx"
import { LoginPage, meta as loginMeta } from "../pages/login.tsx"
import { NotFoundPage, meta as notFoundMeta } from "../pages/not-found.tsx"
import { PlanPage, meta as planMeta } from "../pages/plan.tsx"
import { PrivacyPage, meta as privacyMeta } from "../pages/privacy.tsx"
import { ResetPasswordPage, meta as resetPasswordMeta } from "../pages/reset-password.tsx"
import { SignupPage, meta as signupMeta } from "../pages/signup.tsx"
import { TermsPage, meta as termsMeta } from "../pages/terms.tsx"
import { VerifyPage, meta as verifyMeta } from "../pages/verify.tsx"
import { Document } from "./document.tsx"
import * as serverActions from "./server.tsx"

interface SessionUser {
  id: string
  email?: string
  emailVerified?: boolean
  plan?: string | null
  trialUsed?: boolean | null
  trialEndsAt?: string | Date | null
}

// Email verification is only enforced when mail is actually configured —
// otherwise users could never receive the link and would be locked out.
function verificationRequired() {
  return mailConfigured()
}

// Where a signed-in user belongs: plan first, then email verification.
function postAuthPath(user: SessionUser, fallback = "/dashboard") {
  if (!effectivePlan(user)) return "/plan"
  if (verificationRequired() && !user.emailVerified) return "/verify"
  return fallback
}

async function requireUser(request: Request): Promise<SessionUser | null> {
  try {
    const session = await auth.api.getSession({ headers: request.headers })
    return (session?.user as SessionUser | undefined) ?? null
  } catch {
    return null
  }
}

function getSetCookies(headers: Headers): string[] {
  const h = headers as Headers & { getSetCookie?: () => string[] }
  if (typeof h.getSetCookie === "function") return h.getSetCookie()
  const single = headers.get("set-cookie")
  return single ? [single] : []
}

function authRedirect(path: string, headers?: Headers) {
  const res = redirect(path, 303)
  if (headers) {
    for (const cookie of getSetCookies(headers)) res.headers.append("set-cookie", cookie)
  }
  return res
}

function authError(error: unknown, fallback: string) {
  const body = (error as { body?: { message?: string } })?.body
  return body?.message || fallback
}

function safeNext(raw: unknown): string {
  if (typeof raw !== "string" || !raw.startsWith("/") || raw.startsWith("//")) return "/dashboard"
  return raw
}

export default createController(routes, {
  actions: {
    async assets(context) {
      return (await assets.fetch(context.request)) ?? new Response("Not Found", { status: 404 })
    },
    async agentPreview(context) {
      return serverActions.agentPreview(context)
    },
    async agentExecute(context) {
      return serverActions.agentExecute(context)
    },
    async agentStatus(context) {
      return serverActions.getStatus(context)
    },
    async agentCancel(context) {
      return serverActions.cancelRun(context)
    },
    async agentApprove(context) {
      return serverActions.approveRun(context)
    },
    async preview(context) {
      return serverActions.preview(context)
    },
    async execute(context) {
      return serverActions.execute(context)
    },
    async publicStatus(context) {
      return serverActions.publicStatus()
    },
    async supportChat(context) {
      return serverActions.supportChat(context)
    },
    async loginView(context) {
      const user = await requireUser(context.request)
      if (user) return redirect(postAuthPath(user), 303)
      const next = safeNext(new URL(context.request.url).searchParams.get("next"))
      return context.render(
        <Document meta={loginMeta}>
          <LoginPage next={next === "/dashboard" ? undefined : next} />
        </Document>,
      )
    },
    async loginSubmit(context) {
      const form = await context.request.formData()
      const email = String(form.get("email") ?? "").trim().toLowerCase()
      const password = String(form.get("password") ?? "")
      const next = safeNext(form.get("next"))
      if (!email || !password) {
        return context.render(
          <Document meta={loginMeta}>
            <LoginPage error={"Enter your email and password."} next={next === "/dashboard" ? undefined : next} />
          </Document>,
          { status: 400 },
        )
      }
      try {
        const result = await auth.api.signInEmail({
          body: { email, password },
          headers: context.request.headers,
          returnHeaders: true,
        })
        const u = result.response.user as SessionUser
        return authRedirect(next === "/dashboard" ? postAuthPath(u) : next, result.headers)
      } catch (error) {
        console.error("[auth] login failed:", error)
        return context.render(
          <Document meta={loginMeta}>
            <LoginPage error={authError(error, "Invalid email or password.")} next={next === "/dashboard" ? undefined : next} />
          </Document>,
          { status: 401 },
        )
      }
    },
    async signupView(context) {
      const user = await requireUser(context.request)
      if (user) return redirect(postAuthPath(user), 303)
      const next = safeNext(new URL(context.request.url).searchParams.get("next"))
      return context.render(
        <Document meta={signupMeta}>
          <SignupPage next={next === "/dashboard" ? undefined : next} />
        </Document>,
      )
    },
    async signupSubmit(context) {
      const form = await context.request.formData()
      const email = String(form.get("email") ?? "").trim().toLowerCase()
      const password = String(form.get("password") ?? "")
      const next = safeNext(form.get("next"))
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || password.length < 8) {
        return context.render(
          <Document meta={signupMeta}>
            <SignupPage error={"Enter a valid email and an 8+ character password."} next={next === "/dashboard" ? undefined : next} />
          </Document>,
          { status: 400 },
        )
      }
      const ip =
        context.request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
        context.request.headers.get("x-real-ip") ||
        "unknown"
      try {
        if (!(await signupIpAllowed(ip))) {
          return context.render(
            <Document meta={signupMeta}>
              <SignupPage error={"Too many accounts were created from this network. Try again later."} next={next === "/dashboard" ? undefined : next} />
            </Document>,
            { status: 429 },
          )
        }
      } catch (error) {
        // If the limiter table is unavailable, don't block signups — log and continue.
        console.error("[auth] signup ip check failed:", error)
      }
      try {
        const result = await auth.api.signUpEmail({
          body: { name: email.split("@")[0], email, password },
          headers: context.request.headers,
          returnHeaders: true,
        })
        try {
          await recordSignupIp(ip)
        } catch (error) {
          console.error("[auth] signup ip record failed:", error)
        }
        // Carry the session cookie forward; plan selection (and the
        // verification email) happens next.
        const res = redirect("/plan", 303)
        for (const cookie of getSetCookies(result.headers)) res.headers.append("set-cookie", cookie)
        return res
      } catch (error) {
        console.error("[auth] signup failed:", error)
        return context.render(
          <Document meta={signupMeta}>
            <SignupPage error={authError(error, "Could not create that account.")} next={next === "/dashboard" ? undefined : next} />
          </Document>,
          { status: 400 },
        )
      }
    },
    async planView(context) {
      const user = await requireUser(context.request)
      if (!user) return redirect("/login", 303)
      return context.render(
        <Document meta={planMeta}>
          <PlanPage
            trialUsed={canClaimTrial(user) === false}
            currentPlan={effectivePlan(user)}
          />
        </Document>,
      )
    },
    async planSubmit(context) {
      const user = await requireUser(context.request)
      if (!user) return redirect("/login", 303)
      const form = await context.request.formData()
      const plan = String(form.get("plan") ?? "")
      const current = effectivePlan(user)
      const renderError = (error: string, status = 400) =>
        context.render(
          <Document meta={planMeta}>
            <PlanPage error={error} trialUsed={canClaimTrial(user) === false} currentPlan={current} />
          </Document>,
          { status },
        )
      if (plan !== "trial" && plan !== "free") {
        return renderError("That plan is not available yet.")
      }
      if (plan === "trial" && !canClaimTrial(user)) {
        return renderError("Your trial has already been used — the Free plan is still available.")
      }
      if (current === plan) {
        return redirect("/dashboard", 303)
      }
      try {
        const ok = await setUserPlan(user.id, plan)
        if (!ok) {
          return renderError("Your trial has already been used — the Free plan is still available.")
        }
      } catch (error) {
        console.error("[auth] plan update failed:", error)
        return renderError("Could not save your plan. Please try again.", 500)
      }
      // First plan choice triggers the verification email (when mail is set up).
      if (verificationRequired() && !user.emailVerified && user.email) {
        await sendVerificationForUser(user.email, "/dashboard")
        return context.render(
          <Document meta={verifyMeta}>
            <VerifyPage email={user.email} sent />
          </Document>,
        )
      }
      return redirect("/dashboard", 303)
    },
    async verifyView(context) {
      const user = await requireUser(context.request)
      if (!user) return redirect("/login", 303)
      if (!verificationRequired() || user.emailVerified) return redirect(postAuthPath(user), 303)
      return context.render(
        <Document meta={verifyMeta}>
          <VerifyPage email={user.email} />
        </Document>,
      )
    },
    async verifySubmit(context) {
      const user = await requireUser(context.request)
      if (!user) return redirect("/login", 303)
      if (user.email && !user.emailVerified) {
        await sendVerificationForUser(user.email, "/dashboard")
      }
      return context.render(
        <Document meta={verifyMeta}>
          <VerifyPage email={user.email} sent />
        </Document>,
      )
    },
    async forgotView(context) {
      return context.render(
        <Document meta={forgotMeta}>
          <ForgotPage />
        </Document>,
      )
    },
    async forgotSubmit(context) {
      const form = await context.request.formData()
      const email = String(form.get("email") ?? "").trim().toLowerCase()
      if (email) {
        try {
          await auth.api.requestPasswordReset({
            body: { email, redirectTo: "/reset-password" },
          })
        } catch (error) {
          console.error("[auth] password reset request failed:", error)
        }
      }
      // Always show the same response so the endpoint can't probe accounts.
      return context.render(
        <Document meta={forgotMeta}>
          <ForgotPage sent />
        </Document>,
      )
    },
    async resetPasswordView(context) {
      const token = new URL(context.request.url).searchParams.get("token") ?? ""
      return context.render(
        <Document meta={resetPasswordMeta}>
          <ResetPasswordPage token={token || undefined} />
        </Document>,
      )
    },
    async resetPasswordSubmit(context) {
      const form = await context.request.formData()
      const token = String(form.get("token") ?? "")
      const password = String(form.get("password") ?? "")
      const fail = (error: string) =>
        context.render(
          <Document meta={resetPasswordMeta}>
            <ResetPasswordPage token={token} error={error} />
          </Document>,
          { status: 400 },
        )
      if (!token || password.length < 8) {
        return fail("This reset link is invalid. Request a new one.")
      }
      try {
        await auth.api.resetPassword({
          body: { newPassword: password, token },
        })
        return context.render(
          <Document meta={resetPasswordMeta}>
            <ResetPasswordPage token={token} done />
          </Document>,
        )
      } catch (error) {
        console.error("[auth] password reset failed:", error)
        return fail("This reset link is invalid or has expired. Request a new one.")
      }
    },
    async logout(context) {
      try {
        const result = await auth.api.signOut({
          headers: context.request.headers,
          returnHeaders: true,
        })
        return authRedirect("/", result.headers)
      } catch {
        return redirect("/", 303)
      }
    },
    async dashboard(context) {
      const user = await requireUser(context.request)
      if (!user) return redirect("/login?next=/dashboard", 303)
      const plan = effectivePlan(user)
      if (!plan) return redirect("/plan", 303)
      if (verificationRequired() && !user.emailVerified) return redirect("/verify", 303)
      return context.render(
        <Document meta={dashboardMeta}>
          <DashboardPage
            email={user.email}
            plan={plan}
            trialEndsAt={user.trialEndsAt ? new Date(user.trialEndsAt).toISOString() : null}
          />
        </Document>,
      )
    },
    home(context) {
      return context.render(<Document meta={homeMeta}><HomePage /></Document>)
    },
    privacy(context) {
      return context.render(<Document meta={privacyMeta}><PrivacyPage /></Document>)
    },
    terms(context) {
      return context.render(<Document meta={termsMeta}><TermsPage /></Document>)
    },
    docs(context) {
      return context.render(<Document meta={docsMeta}><DocsPage /></Document>)
    },
    about(context) {
      return context.render(<Document meta={aboutMeta}><AboutPage /></Document>)
    },
    notFound(context) {
      return context.render(<Document meta={notFoundMeta}><NotFoundPage /></Document>, { status: 404 })
    },
  },
})
