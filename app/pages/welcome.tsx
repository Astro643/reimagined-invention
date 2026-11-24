import type { Handle } from "remix/component"

import type { PageMeta } from "../lib/page.ts"

export const meta: PageMeta = {
  title: "Save your credentials · Controller",
  robots: "noindex",
  styles: ["/site.css"],
}

export interface WelcomePageProps {
  userId: string
  phrase: string
}

export function WelcomePage(handle: Handle<WelcomePageProps>) {
  return () => {
    const { userId, phrase } = handle.props
    return (
      <main class="auth-wrap">
        <section class="auth-hero">
          <a class="auth-brand" href="/">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M2.5 5h19L12 20.5z" fill="currentColor" />
            </svg>
            Controller
          </a>
          <h1>
            {"THE FUTURE"}
            <br />
            {"OF AGENTS"}
          </h1>
          <p>
            {"Describe a goal in plain language. An agent audits it, plans it, and runs it — while you watch every step."}
          </p>
        </section>
        <section class="auth-card">
          <h2>{"Save these — shown only once"}</h2>
          <p class="sub">
            {"Your account has no email. These two things are the only way back in."}
          </p>
          <div class="cred-block">
            <span class="cred-label">{"User ID"}</span>
            <code class="cred-value">{userId}</code>
          </div>
          <div class="cred-block">
            <span class="cred-label">{"Recovery phrase — 26 words"}</span>
            <code class="cred-value cred-phrase">{phrase}</code>
          </div>
          <p class="auth-warn">
            {"Store both somewhere safe. If you forget your password, your user ID + recovery phrase are the only way to reset it. Anyone holding the phrase can reset your password — treat it like a password."}
          </p>
          <form method="get" action="/plan">
            <button class="btn btn-primary" type="submit">
              {"I saved them — continue"}
            </button>
          </form>
        </section>
      </main>
    )
  }
}
