import type { Handle } from "remix/component"

import type { PageMeta } from "../lib/page.ts"

export const meta: PageMeta = {
  title: "Create account · Controller",
  robots: "noindex",
  styles: ["/site.css"],
}

export interface SignupPageProps {
  error?: string
  next?: string
}

export function SignupPage(handle: Handle<SignupPageProps>) {
  return () => {
    const { error, next } = handle.props
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
          <h2>{"Create your account"}</h2>
          <p class="sub">{"Pick a plan next — takes ten seconds."}</p>
          {error ? <p class="auth-err">{error}</p> : null}
          <form method="post" action="/signup" autoComplete="on">
            {next ? <input type="hidden" name="next" value={next} /> : null}
            <label>
              {"Email"}
              <input name="email" type="email" required autoComplete="email" />
            </label>
            <label>
              {"Password"}
              <input name="password" type="password" required minLength={8} autoComplete="new-password" />
            </label>
            <button class="btn btn-primary" type="submit">
              {"Create account"}
            </button>
          </form>
          <p class="auth-alt">
            {"Already have an account? "}
            <a href={next ? "/login?next=" + encodeURIComponent(next) : "/login"}>{"Sign in"}</a>
          </p>
        </section>
      </main>
    )
  }
}
