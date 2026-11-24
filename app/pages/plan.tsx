import type { Handle } from "remix/component"

import type { PageMeta } from "../lib/page.ts"

export const meta: PageMeta = {
  title: "Choose your plan · Controller",
  robots: "noindex",
  styles: ["/site.css"],
}

export interface PlanPageProps {
  error?: string
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
    const error = handle.props.error
    return (
      <main class="tier-grid">
        <section class="tier">
          <div class="tier-head">
            <div>
              <h2>{"Trial"}</h2>
              <span class="price">{"30 days · full access"}</span>
            </div>
          </div>
          <ul>
            {TRIAL_BENEFITS.map((b) => (
              <li key={b}>{b}</li>
            ))}
          </ul>
          <p class="warn">
            {"Your account and all of its data will be permanently deleted from our system 30 days after signup."}
          </p>
          {error ? <p class="auth-err">{error}</p> : null}
          <form method="post" action="/plan">
            <input type="hidden" name="plan" value="trial" />
            <button class="btn btn-primary" type="submit">
              {"Start trial"}
            </button>
          </form>
        </section>
        <section class="tier disabled">
          <div class="tier-head">
            <div>
              <h2>{"Free"}</h2>
              <span class="price">{"forever · limited"}</span>
            </div>
            <span class="soon">{"Coming soon"}</span>
          </div>
          <ul>
            {FREE_BENEFITS.map((b) => (
              <li key={b}>{b}</li>
            ))}
          </ul>
          <form>
            <button class="btn" type="button" disabled>
              {"Coming soon"}
            </button>
          </form>
        </section>
      </main>
    )
  }
}
