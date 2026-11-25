import type { PageMeta } from "../lib/page.ts"
import { inviteHref } from "../lib/site-config.ts"
import { CONSOLE, Layout, PREFETCH } from "../ui/chrome.tsx"

export const meta: PageMeta = {
  title: "Controller · Agentic infrastructure for Discord",
  description:
    "Agentic infrastructure for Discord. AI agents audit and plan your goals, durable workflows run them, and your bot carries them out.",
  styles: ["/site.css"],
}

const PARTS = [
  [
    "Your own agent",
    "Every request gets a dedicated AI agent that audits the request, then works step by step, reading each result before choosing the next. It has a backup model ready if its main model fails.",
  ],
  [
    "Durable workflows",
    "Each request runs as a durable run. It can pause for your approval or run for minutes, and it keeps going after you close the Console.",
  ],
  [
    "An executor, not a gambler",
    "The bot has no AI of its own. It performs one approved step at a time, with hard safety limits built into the bot itself.",
  ],
  [
    "Visible end to end",
    "Live status for every request, and a live system status card right in the corner of the site.",
  ],
] as const

const CAPABILITIES = [
  ["Structure", "Create categories and channels, rename them, lock them down or remove them when you are done."],
  ["Roles", "Make roles with exactly the permissions you choose, then hand them out or take them back."],
  ["Moderation", "Kick, ban, time out or rename members, people and bots alike, simply by their display name."],
  [
    "Research",
    "Search the web, read pages, write the summary and post it to Discord, all from one goal.",
  ],
] as const

const SAFEGUARDS = [
  ["Owner only.", "Only the account owner can use the Console."],
  ["Never against you.", "The bot refuses to act against the server owner or itself."],
  ["Audited first.", "Requests that look abusive or unclear are rejected before anything runs."],
  [
    "You approve the risky steps.",
    "Deleting channels or roles, kicking or banning members and changing permissions pause until you approve them.",
  ],
  ["Fails safe.", "If an agent and its backup model are both unavailable, nothing runs."],
  ["Cancel any time.", "Stop a request from the Console whenever you like. Steps that already ran are not undone."],
  ["Capped.", "A single request is limited in size, so one mistake cannot snowball."],
] as const

const STEPS = [
  ["Add the bot", 'Click "Add to Discord" to install the bot in your server. No configuration needed.'],
  ["State the goal", "Write it the way you would tell a person. No commands to learn."],
  ["Let the agents run it", "Your agent audits and plans it, the run executes it, and the status updates live."],
] as const

function Cta() {
  return () => (
    <div class="cta">
      {inviteHref ? (
        <>
          <a class="btn btn-primary" href={inviteHref}>Add to Discord</a>
          <a class="btn" href="/dashboard" {...CONSOLE}>Open Console</a>
        </>
      ) : (
        <a class="btn btn-primary" href="/dashboard" {...CONSOLE}>Open Console</a>
      )}
    </div>
  )
}

/** Headline block for the left rail. One oversized mark behind the type is the only decoration. */
function HomeRail() {
  return () => (
    <>
      <div class="rail-art" aria-hidden="true">
        <svg viewBox="0 0 24 24">
          <path d="M2.5 5h19L12 20.5z" fill="currentColor" />
        </svg>
      </div>
      <a class="rail-pill" href="/docs" {...PREFETCH}>
        <span>Closed beta</span>
        <span class="bar" aria-hidden="true">|</span>
        <b>Read the docs</b>
        <span aria-hidden="true">→</span>
      </a>
      <h1 class="rail-title">
        Agentic
        <br />
        infrastructure <span class="dim">for Discord.</span>
      </h1>
      <div class="cta">
        {inviteHref ? (
          <>
            <a class="btn btn-primary" href={inviteHref}>Add to Discord</a>
            <a class="btn" href="/dashboard" {...CONSOLE}>Open Console</a>
          </>
        ) : (
          <>
            <a class="btn btn-primary" href="/dashboard" {...CONSOLE}>Open Console</a>
            <a class="btn" href="/docs" {...PREFETCH}>Read the docs</a>
          </>
        )}
      </div>
    </>
  )
}

export function HomePage() {
  return () => (
    <Layout rail={<HomeRail />}>
      <section class="block first" id="intro">
        <div class="head">
          <h2>Overview</h2>
        </div>
        <p class="lead big">
          Give your server <b>agents that do the work.</b> State a goal in plain language. A dedicated AI agent audits
          it, researches, decides each next step and acts, a durable run keeps it going, and your bot carries out the
          Discord side.
        </p>
        <div class="demo" role="group" aria-label="Example request">
          <div class="demo-bar">
            <span>Example request</span>
          </div>
          <div class="demo-body">
            <div class="bubble">Create a #tournament-rules channel and post the rules in it</div>
            <div class="row">
              <span class="badge s-completed">
                <i />
                Completed
              </span>
              <span class="mono">2 steps</span>
            </div>
            <div class="steps-mini">
              <div>
                <b>1</b> create #tournament-rules <span class="done">· done</span>
              </div>
              <div>
                <b>2</b> post the rules in #tournament-rules <span class="done">· done</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section class="block">
        <div class="head">
          <h2>Infrastructure, not another bot.</h2>
          <p>Four parts work together so a request can be checked, planned and finished without you babysitting it.</p>
        </div>
        <div class="cells two">
          {PARTS.map(([title, text]) => (
            <div class="cell" key={title}>
              <h3>{title}</h3>
              <p>{text}</p>
            </div>
          ))}
        </div>
      </section>

      <section class="block">
        <div class="head">
          <h2>What your agents can do.</h2>
          <p>Anything an owner does by hand, from one sentence.</p>
        </div>
        <div class="cells two">
          {CAPABILITIES.map(([title, text]) => (
            <div class="cell" key={title}>
              <h3>{title}</h3>
              <p>{text}</p>
            </div>
          ))}
        </div>
      </section>

      <section class="block">
        <div class="head">
          <h2>Three steps. No setup screens.</h2>
        </div>
        <div class="cells">
          {STEPS.map(([title, text], index) => (
            <div class="cell" key={title}>
              <span class="num">{"0" + String(index + 1)}</span>
              <h3>{title}</h3>
              <p>{text}</p>
            </div>
          ))}
        </div>
      </section>

      <section class="block">
        <div class="head">
          <h2>Autonomy with the owner in control.</h2>
          <p>Agents are only worth it if you can trust them. These protections are built in, not bolted on.</p>
        </div>
        <div class="plus-box">
          <ul class="plus-list">
            {SAFEGUARDS.map(([title, text]) => (
              <li key={title}>
                <span>
                  <b>{title}</b> {text}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section class="band">
        <h2>Put agents to work on your server.</h2>
        <p class="lead">Add the bot and hand over your first goal.</p>
        <Cta />
      </section>
    </Layout>
  )
}
