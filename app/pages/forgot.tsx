import type { Handle } from "remix/component"

import type { PageMeta } from "../lib/page.ts"

export const meta: PageMeta = {
  title: "Forgot password · Controller",
  robots: "noindex",
  styles: ["/site.css"],
}

export interface ForgotPageProps {
  error?: string
  sent?: boolean
}

export function ForgotPage(handle: Handle<ForgotPageProps>) {
  return () => {
    const { error, sent } = handle.props
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
          <h2>{"Reset your password"}</h2>
          <p class="sub">{"Enter your account email — we'll send you a reset link."}</p>
          {error ? <p class="auth-err">{error}</p> : null}
          {sent ? (
            <>
              <p class="auth-ok">{"If that email has an account, a reset link is on its way. Check your inbox."}</p>
              <p class="auth-alt">
                <a href="/login">{"Back to sign in"}</a>
              </p>
            </>
          ) : (
            <form method="post" action="/forgot" autoComplete="on">
              <label>
                {"Email"}
                <input name="email" type="email" required autoComplete="email" />
              </label>
              <button class="btn btn-primary" type="submit">
                {"Send reset link"}
              </button>
            </form>
          )}
          <p class="auth-alt">
            <a href="/login">{"Back to sign in"}</a>
          </p>
        </section>
      </main>
    )
  }
}
