import type { Handle, RemixNode } from "remix/component"

import { inviteHref, supportHref, supportMail } from "../lib/site-config.ts"
import { Logo } from "./logo.tsx"
import { Console } from "./console.tsx"
import { SupportWidget } from "./support-widget.tsx"

export const PREFETCH = { "data-rmx-prefetch": "intent" } as const

/** Marks a link that opens the Console overlay. The href stays as the fallback when scripts are off. */
export const CONSOLE = { "data-open-console": "true" } as const

// Marks the tab for the current path. Runs once, right after the nav is parsed.
const NAV_SCRIPT =
  "(function(){var p=location.pathname;if(p.length>1&&p.slice(-1)==='/')p=p.slice(0,-1);" +
  "document.querySelectorAll('.topnav a[data-nav]').forEach(function(a){if(a.getAttribute('href')===p)a.setAttribute('aria-current','page')})})()"

function FootLinks() {
  return () => (
    <>
      <nav class="foot-links" aria-label="Footer">
        <a href="/docs" {...PREFETCH}>Docs</a>
        <a href="/about" {...PREFETCH}>About</a>
        <a href="/privacy" {...PREFETCH}>Privacy</a>
        <a href="/terms" {...PREFETCH}>Terms</a>
        {inviteHref ? <a href={inviteHref}>Add to Discord</a> : null}
        {supportHref ? <a href={supportHref}>Discord server</a> : null}
        {supportMail ? <a href={"mailto:" + supportMail}>{supportMail}</a> : null}
      </nav>
      <p class="legal">© {String(new Date().getFullYear())} Controller. Not affiliated with or endorsed by Discord Inc.</p>
    </>
  )
}

function DefaultRail() {
  return () => (
    <>
      <p class="rail-title">
        Agentic
        <br />
        infrastructure <span class="dim">for Discord.</span>
      </p>
      <p class="rail-text">Agents plan it, workflows run it, your bot does it.</p>
      <a class="rail-link" href="/dashboard" {...CONSOLE}>
        Open Console <span aria-hidden="true">↗</span>
      </a>
    </>
  )
}

export interface LayoutProps {
  children?: RemixNode
  /** Replaces the default text in the left rail (the home page uses this for its headline). */
  rail?: RemixNode
}

/** Left rail, tab nav, main content, Console overlay and support widget, shared by every page. */
export function Layout(handle: Handle<LayoutProps>) {
  return () => {
    const { children, rail } = handle.props
    return (
      <>
        <a class="skip" href="#main">Skip to content</a>
        <div class="shell">
          <aside class={rail ? "rail rail-hero" : "rail"}>
            <div class="rail-top">
              <a class="brand" href="/" {...PREFETCH}>
                <Logo />
                Controller
              </a>
            </div>
            <div class="rail-main">{rail ?? <DefaultRail />}</div>
            <div class="rail-foot">
              <FootLinks />
            </div>
          </aside>
          <div class="stage">
            <nav class="topnav" aria-label="Main">
              <a href="/" data-nav="" {...PREFETCH}>Home</a>
              <a href="/docs" data-nav="" {...PREFETCH}>Docs</a>
              <a href="/about" data-nav="" {...PREFETCH}>About</a>
              <a class="nav-cta" href="/dashboard" {...CONSOLE}>
                Open Console <span aria-hidden="true">↗</span>
              </a>
            </nav>
            <script>{NAV_SCRIPT}</script>
            <main id="main" class="content">{children}</main>
            <div class="stage-foot">
              <FootLinks />
            </div>
          </div>
        </div>
        <Console />
        <SupportWidget />
      </>
    )
  }
}

export function ContactLine() {
  return () => {
    if (supportMail && supportHref) {
      return (
        <>
          <a href={"mailto:" + supportMail}>{supportMail}</a>
          {" or "}
          <a href={supportHref}>our Discord server</a>
        </>
      )
    }
    if (supportMail) return <a href={"mailto:" + supportMail}>{supportMail}</a>
    if (supportHref) return <a href={supportHref}>our Discord server</a>
    return <span>please contact whoever operates this bot for your server.</span>
  }
}
