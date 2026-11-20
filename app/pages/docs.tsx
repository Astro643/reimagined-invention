import type { PageMeta } from "../lib/page.ts"
import { Layout } from "../ui/chrome.tsx"

export const meta: PageMeta = {
  title: "Docs · Controller",
  description:
    "How to use Controller: getting started, writing goals, request statuses, safety and how requests run under the hood.",
  styles: ["/site.css"],
}

const SECTIONS = [
  ["getting-started", "Getting started"],
  ["goals", "Writing good goals"],
  ["statuses", "Request statuses"],
  ["how-it-runs", "How a request runs"],
  ["safety", "Safety"],
  ["support", "Support"],
] as const

export function DocsPage() {
  return () => (
    <Layout>
      <div class="page">
        <h1>Docs</h1>
        <p class="lead">How to use Controller, what your agent does with a goal, and what every status means.</p>
        <ul class="toc">
          {SECTIONS.map(([id, title]) => (
            <li key={id}>
              <a href={"#" + id}>{title}</a>
            </li>
          ))}
        </ul>
      </div>

      <div class="prose">
        <h2 id="getting-started">Getting started</h2>
        <p>
          Controller is a Discord bot that turns plain-language goals into actions on your server. Add the bot to your
          server, then use it directly in Discord. No setup screens or passwords needed.
        </p>
        <p>
          If you need help, use the support chat on this site or ask in your Discord server.
        </p>

        <h2 id="goals">Writing good goals</h2>
        <p>Write the goal the way you would tell a person. A few habits get better plans:</p>
        <ul>
          <li>
            <b>Name the exact targets.</b> "Rename #general to #lobby and slow it to 5 seconds" beats "tidy up my
            channels".
          </li>
          <li>
            <b>One outcome per request.</b> Ten small requests are easier to track and cancel than one giant one.
          </li>
          <li>
            <b>Questions are free.</b> Ask "how many webhooks does my server have?" — questions get answers, not actions.
          </li>
        </ul>

        <h2 id="statuses">Request statuses</h2>
        <ul>
          <li>
            <b>Processing.</b> The plan is running right now.
          </li>
          <li>
            <b>Waiting.</b> The request is paused for a scheduled step and will resume on time. It can still be
            cancelled.
          </li>
          <li>
            <b>Completed.</b> Every step finished. The result note shows what was done.
          </li>
          <li>
            <b>Failed.</b> Something went wrong; the note says what. Nothing is retried without your say-so — run it
            again.
          </li>
          <li>
            <b>Traffic stall.</b> Discord rate limits slowed the plan down. It resumes automatically; no action needed.
          </li>
          <li>
            <b>No response.</b> The request went quiet for too long and was retired. Run it again if it still looks
            right.
          </li>
          <li>
            <b>Rejected.</b> The plan was refused by a safety check before anything ran.
          </li>
          <li>
            <b>Cancelled.</b> You stopped it.
          </li>
          <li>
            <b>Expired.</b> The request is no longer known to the server and was retired.
          </li>
        </ul>

        <h2 id="how-it-runs">How a request runs</h2>
        <p>
          When you submit a goal, Controller starts a durable workflow: an isolated Linux sandbox is created for your
          request, each step runs inside it in order, and the sandbox is destroyed when the plan finishes — nothing is
          shared between requests. The bot carries out the Discord-side actions, and the workflow records the result of
          every step so you can see exactly what happened.
        </p>

        <h2 id="safety">Safety</h2>
        <ul>
          <li>
            <b>Owner only.</b> Only the server owner can use Controller through Discord commands.
          </li>
          <li>
            <b>Never against you.</b> The bot refuses to act against the server owner or itself.
          </li>
          <li>
            <b>Small footprint.</b> Server history and audit records are removed automatically after 30 days.
          </li>
        </ul>

        <h2 id="support">Support and status</h2>
        <p>
          The chat bubble on every page shows live system status and an AI assistant that answers questions about
          Controller, around the clock.
        </p>
      </div>

      <div class="faq">
        <details>
          <summary>Do I need to learn commands?</summary>
          <div class="ans">
            <p>
              No. Just describe what you want in plain language. The bot understands natural language goals.
            </p>
          </div>
        </details>
        <details>
          <summary>What happens when I cancel a request?</summary>
          <div class="ans">
            <p>
              The remaining steps never run. Steps that already finished are not undone — if a channel was already
              renamed, it stays renamed.
            </p>
          </div>
        </details>
        <details>
          <summary>Why did my request fail?</summary>
          <div class="ans">
            <p>
              The status message says what went wrong — usually a missing channel or a permission Discord
              refused. Fix the detail and run it again; nothing is retried on its own.
            </p>
          </div>
        </details>
        <details>
          <summary>Is Controller affiliated with Discord?</summary>
          <div class="ans">
            <p>No. Controller is an independent product and is not affiliated with or endorsed by Discord Inc.</p>
          </div>
        </details>
      </div>
    </Layout>
  )
}
