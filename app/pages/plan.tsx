import type { Handle } from "remix/component"

import type { PageMeta } from "../lib/page.ts"

export const meta: PageMeta = {
  title: "Choose your plan · Controller",
  robots: "noindex",
  styles: ["/site.css"],
}

export interface PlanPageProps {
  error?: string
  trialUsed?: boolean
  currentPlan?: string | null
  notice?: string
}

const TRIAL_BENEFITS = [
  "Full agent access for 30 days",
  "Every toolset, including browser automation",
  "Priority execution",
  "Full request history and step logs",
]

const FREE_BENEFITS = [
  "Core agent toolsets",
  "Standard execution",
  "Community support",
  "Free for as long as the service exists",
]

export function PlanPage(handle: Handle<PlanPageProps>) {
  return () => {
    const { error, trialUsed, currentPlan, notice } = handle.props
    return (
      <main class="tier-grid">
        <section class={currentPlan === "trial" ? "tier tier-current" : "tier" + (trialUsed ? " disabled" : "")}>
          <div class="tier-head">
            <div>
              <h2>{"Trial"}</h2>
              <span class="price">{"30 days · full access"}</span>
            </div>
            {currentPlan === "trial" ? <span class="tier-badge">{"Current plan"}</span> : null}
          </div>
          <ul>
            {TRIAL_BENEFITS.map((b) => (
              <li key={b}>{b}</li>
            ))}
          </ul>
          {trialUsed ? (
            <p class="warn">{"You've already used your trial — it can't be claimed again."}</p>
          ) : (
            <p class="warn">
              {"Full access for 30 days. When it ends, your plan resets and you choose again."}
            </p>
          )}
          {error ? <p class="auth-err">{error}</p> : null}
          {notice ? <p class="auth-ok">{notice}</p> : null}
          {trialUsed ? null : (
            <form method="post" action="/plan">
              <input type="hidden" name="plan" value="trial" />
              <button class="btn btn-primary" type="submit">
                {currentPlan ? "Switch to trial" : "Start trial"}
              </button>
            </form>
          )}
        </section>
        <section class={currentPlan === "free" ? "tier tier-current" : "tier"}>
          <div class="tier-head">
            <div>
              <h2>{"Free"}</h2>
              <span class="price">{"forever · core toolsets"}</span>
            </div>
            {currentPlan === "free" ? <span class="tier-badge">{"Current plan"}</span> : null}
          </div>
          <ul>
            {FREE_BENEFITS.map((b) => (
              <li key={b}>{b}</li>
            ))}
          </ul>
          {error ? <p class="auth-err">{error}</p> : null}
          {notice ? <p class="auth-ok">{notice}</p> : null}
          {currentPlan === "free" ? null : (
            <form method="post" action="/plan">
              <input type="hidden" name="plan" value="free" />
              <button class="btn" type="submit">
                {currentPlan ? "Switch to free" : "Start free"}
              </button>
            </form>
          )}
        </section>
      </main>
    )
  }
}
