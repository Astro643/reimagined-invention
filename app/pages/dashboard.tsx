import type { Handle } from "remix/component"

import type { PageMeta } from "../lib/page.ts"
import { Layout } from "../ui/chrome.tsx"

export const meta: PageMeta = {
  title: "Console · Controller",
  robots: "noindex",
  styles: ["/site.css"],
}

export interface DashboardPageProps {
  email?: string
  plan?: string | null
  trialEndsAt?: string | null
}

export function DashboardPage(handle: Handle<DashboardPageProps>) {
  return () => {
    const { email, plan, trialEndsAt } = handle.props
    return (
      <Layout>
        <div class="page">
          <h1>{"Console"}</h1>
          <p class="lead">
            {"Describe a goal below. Your agent audits it, plans it, and runs it — watch every step live."}
          </p>
          <div class="dash-meta">
            {email ? (
              <p class="mono" style={{ color: "var(--faint)", fontSize: "13px" }}>
                {"Signed in as "}
                <code>{email}</code>
              </p>
            ) : null}
            <p class="mono" style={{ color: "var(--faint)", fontSize: "13px" }}>
              {"Plan: "}
              <strong>{plan === "trial" ? "Trial" : "Free"}</strong>
              {plan === "trial" && trialEndsAt
                ? ` — ends ${new Date(trialEndsAt).toLocaleDateString()}`
                : ""}
              {" · "}
              <a href="/plan">{"change plan"}</a>
            </p>
          </div>
          <p class="mono" style={{ color: "var(--faint)", fontSize: "13px" }}>
            {"Tip: press ⌘K / Ctrl+K anywhere to open the console."}
          </p>
        </div>
        <form method="post" action="/logout" class="dash-out">
          <button class="btn btn-sm" type="submit">
            {"Sign out"}
          </button>
        </form>
      </Layout>
    )
  }
}
