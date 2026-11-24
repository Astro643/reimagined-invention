import type { PageMeta } from "../lib/page.ts"
import { Layout } from "../ui/chrome.tsx"

export const meta: PageMeta = {
  title: "Console · Controller",
  robots: "noindex",
  styles: ["/site.css"],
}

export function DashboardPage() {
  return () => (
    <Layout>
      <div class="page">
        <h1>{"Console"}</h1>
        <p class="lead">
          {"Describe a goal below. Your agent audits it, plans it, and runs it — watch every step live."}
        </p>
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
