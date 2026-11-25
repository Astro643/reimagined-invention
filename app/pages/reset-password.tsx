import type { Handle } from "remix/component"

import type { PageMeta } from "../lib/page.ts"

export const meta: PageMeta = {
  title: "Choose a new password · Controller",
  robots: "noindex",
  styles: ["/site.css"],
}

export interface ResetPasswordPageProps {
  token?: string
  error?: string
  done?: boolean
}

export function ResetPasswordPage(handle: Handle<ResetPasswordPageProps>) {
  return () => {
    const { token, error, done } = handle.props
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
          <h2>{"Choose a new password"}</h2>
          {error ? <p class="auth-err">{error}</p> : null}
          {done ? (
            <>
              <p class="auth-ok">{"Password updated. You can sign in now."}</p>
              <p class="auth-alt">
                <a href="/login">{"Back to sign in"}</a>
              </p>
            </>
          ) : token ? (
            <form method="post" action="/reset-password" autoComplete="off">
              <input type="hidden" name="token" value={token} />
              <label>
                {"New password"}
                <input name="password" type="password" required minLength={8} autoComplete="new-password" />
              </label>
              <button class="btn btn-primary" type="submit">
                {"Update password"}
              </button>
            </form>
          ) : (
            <>
              <p class="auth-err">{"This reset link is invalid or has expired. Request a new one."}</p>
              <p class="auth-alt">
                <a href="/forgot">{"Request a new reset link"}</a>
              </p>
            </>
          )}
          <p class="auth-alt">
            <a href="/login">{"Back to sign in"}</a>
          </p>
        </section>
      </main>
    )
  }
}
