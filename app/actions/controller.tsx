import { createController } from "remix/router"
import { redirect } from "remix/response/redirect"

import { assets } from "../assets.ts"
import { sql } from "../lib/db.ts"
import { auth } from "../lib/auth.ts"
import { routes } from "../routes.ts"
import { AboutPage, meta as aboutMeta } from "../pages/about.tsx"
import { DashboardPage, meta as dashboardMeta } from "../pages/dashboard.tsx"
import { DocsPage, meta as docsMeta } from "../pages/docs.tsx"
import { HomePage, meta as homeMeta } from "../pages/home.tsx"
import { LoginPage, meta as loginMeta } from "../pages/login.tsx"
import { NotFoundPage, meta as notFoundMeta } from "../pages/not-found.tsx"
import { PlanPage, meta as planMeta } from "../pages/plan.tsx"
import { PrivacyPage, meta as privacyMeta } from "../pages/privacy.tsx"
import { SignupPage, meta as signupMeta } from "../pages/signup.tsx"
import { TermsPage, meta as termsMeta } from "../pages/terms.tsx"
import { Document } from "./document.tsx"
import * as serverActions from "./server.tsx"

interface SessionUser {
  id: string
  plan?: string | null
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
      if (user) return redirect(user.plan ? "/dashboard" : "/plan", 303)
      const next = safeNext(new URL(context.request.url).searchParams.get("next"))
      return context.render(
        <Document meta={loginMeta}>
          <LoginPage next={next === "/dashboard" ? undefined : next} />
        </Document>,
      )
    },
    async loginSubmit(context) {
      const form = await context.request.formData()
      const email = String(form.get("email") ?? "").trim()
      const password = String(form.get("password") ?? "")
      const next = safeNext(form.get("next"))
      try {
        const result = await auth.api.signInEmail({
          body: { email, password },
          headers: context.request.headers,
          returnHeaders: true,
        })
        const plan = (result.response.user as { plan?: string }).plan
        return authRedirect(plan ? next : "/plan", result.headers)
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
      if (user) return redirect(user.plan ? "/dashboard" : "/plan", 303)
      const next = safeNext(new URL(context.request.url).searchParams.get("next"))
      return context.render(
        <Document meta={signupMeta}>
          <SignupPage next={next === "/dashboard" ? undefined : next} />
        </Document>,
      )
    },
    async signupSubmit(context) {
      const form = await context.request.formData()
      const email = String(form.get("email") ?? "").trim()
      const password = String(form.get("password") ?? "")
      const next = safeNext(form.get("next"))
      const name = email.split("@")[0] || "user"
      try {
        const result = await auth.api.signUpEmail({
          body: { name, email, password },
          headers: context.request.headers,
          returnHeaders: true,
        })
        return authRedirect("/plan", result.headers)
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
      if (user.plan) return redirect("/dashboard", 303)
      return context.render(
        <Document meta={planMeta}>
          <PlanPage />
        </Document>,
      )
    },
    async planSubmit(context) {
      const user = await requireUser(context.request)
      if (!user) return redirect("/login", 303)
      const form = await context.request.formData()
      const plan = String(form.get("plan") ?? "")
      if (plan !== "trial") {
        return context.render(
          <Document meta={planMeta}>
            <PlanPage error={"That plan is not available yet."} />
          </Document>,
          { status: 400 },
        )
      }
      try {
        await sql`UPDATE "user" SET plan = 'trial', "updatedAt" = now() WHERE id = ${user.id}`
      } catch (error) {
        console.error("[auth] plan update failed:", error)
        return context.render(
          <Document meta={planMeta}>
            <PlanPage error={"Could not save your plan. Please try again."} />
          </Document>,
          { status: 500 },
        )
      }
      return redirect("/dashboard", 303)
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
      if (!user.plan) return redirect("/plan", 303)
      return context.render(
        <Document meta={dashboardMeta}>
          <DashboardPage />
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
