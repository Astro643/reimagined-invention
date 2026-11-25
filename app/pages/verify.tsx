import type { Handle } from "remix/component"

import type { PageMeta } from "../lib/page.ts"

export const meta: PageMeta = {
  title: "Verify your email · Controller",
  robots: "noindex",
  styles: ["/site.css"],
}

export interface VerifyPageProps {
  email?: string
  sent?: boolean
  error?: string
}

export function VerifyPage(handle: Handle<VerifyPageProps>) {
  return () => {
    const { email, sent, error } = handle.props
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
          <h2>{"Check your inbox"}</h2>
          <p class="sub">
            {email ? `We sent a verification link to ${email}. Click it to unlock your Console.` : "We sent you a verification link. Click it to unlock your Console."}
          </p>
          {sent ? <p class="auth-ok">{"Verification email sent — check your inbox."}</p> : null}
          {error ? <p class="auth-err">{error}</p> : null}
          <form method="post" action="/verify">
            <button class="btn btn-primary" type="submit">
              {"Resend verification email"}
            </button>
          </form>
          <p class="auth-alt">
            <a href="/dashboard">{"I've verified — continue"}</a>
          </p>
        </section>
      </main>
    )
  }
}
