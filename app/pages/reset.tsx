import type { Handle } from "remix/component"

import type { PageMeta } from "../lib/page.ts"

export const meta: PageMeta = {
  title: "Reset password · Controller",
  robots: "noindex",
  styles: ["/site.css"],
}

export interface ResetPageProps {
  error?: string
  done?: boolean
}

export function ResetPage(handle: Handle<ResetPageProps>) {
  return () => {
    const { error, done } = handle.props
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
          <h2>{"Reset password"}</h2>
          <p class="sub">{"Enter your user ID, recovery phrase, and a new password."}</p>
          {error ? <p class="auth-err">{error}</p> : null}
          {done ? (
            <>
              <p class="auth-ok">{"Password updated. You can sign in now."}</p>
              <p class="auth-alt">
                <a href="/login">{"Back to sign in"}</a>
              </p>
            </>
          ) : (
            <form method="post" action="/reset" autoComplete="off">
              <label>
                {"User ID"}
                <input name="user_id" type="text" required autoComplete="off" />
              </label>
              <label>
                {"Recovery phrase"}
                <textarea name="phrase" required rows={3} autoComplete="off" />
              </label>
              <label>
                {"New password"}
                <input name="password" type="password" required minLength={8} autoComplete="new-password" />
              </label>
              <button class="btn btn-primary" type="submit">
                {"Reset password"}
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
