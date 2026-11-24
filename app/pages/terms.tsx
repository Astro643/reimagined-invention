import type { PageMeta } from "../lib/page.ts"
import { ContactLine, Layout } from "../ui/chrome.tsx"

export const meta: PageMeta = {
  title: "Terms of Service · Controller",
  description: "The rules for using Controller.",
  styles: ["/site.css"],
}

export function TermsPage() {
  return () => (
    <Layout>
      <div class="page">
        <h1>Terms of Service</h1>
        <p class="lead">The simple rules for using Controller.</p>
      </div>

      <div class="prose">
        <p class="updated">Last updated: November 20, 2026</p>

        <h2>Agreement</h2>
        <p>
          By adding the Controller bot to a server or using its website (the "Service"), you agree to these terms. If you
          do not agree, please do not use the Service.
        </p>

        <h2>Who may use it</h2>
        <p>
          The Service is for the owner of the server the bot is in. You must follow Discord's Terms of Service and
          Community Guidelines, and you must be old enough to use Discord.
        </p>

        <h2>What the Service does</h2>
        <p>
          The Service turns your written requests into actions on your Discord server, after an AI-based safety check. It
          can create, change and delete channels, roles and messages, and can moderate members, including by kicking,
          banning and timing them out.
        </p>

        <h2>Your responsibility</h2>
        <ul>
          <li>You are responsible for the requests you make and for what they do to your server and its members.</li>
          <li>Some actions cannot be undone, including deleting channels and removing members.</li>
          <li>The AI can misunderstand a request. Review what you send, and check results.</li>
        </ul>

        <h2>Acceptable use</h2>
        <p>
          Do not use the Service to harass or harm people, to spam, to evade bans, to break Discord's rules or the law, to
          try to bypass its safety checks, or to attempt to access anything that is not yours.
        </p>

        <h2>Safety checks are not a guarantee</h2>
        <p>
          The safety check is designed to refuse abusive or unclear requests, but it can be wrong in either direction. It
          is a safeguard, not a promise that every request will be handled correctly.
        </p>

        <h2>AI support</h2>
        <p>
          Support in the chat widget is answered by an AI assistant (with a backup assistant if it is down), not by
          people. If both are unavailable, support is temporarily down. Its answers can be incomplete or wrong, so verify
          anything important yourself. The assistant cannot see or change your server.
        </p>

        <h2>Availability</h2>
        <p>
          The Service is provided "as is" and "as available". It may be interrupted, changed or discontinued, and it
          depends on third-party services such as Discord and Google that we do not control.
        </p>

        <h2>Suspension</h2>
        <p>We may limit or end access to the Service for anyone who breaks these terms or misuses it.</p>

        <h2>Limitation of liability</h2>
        <p>
          To the fullest extent the law allows, we are not liable for indirect or consequential losses, or for loss of
          data, members or content on your server, arising from your use of the Service. Nothing in these terms limits
          liability that cannot be limited by law.
        </p>

        <h2>Privacy</h2>
        <p>
          How we handle data is described in the <a href="/privacy">Privacy Policy</a>.
        </p>

        <h2>Changes</h2>
        <p>
          We may update these terms. If we do, we will change the date above, and continued use means you accept the new
          terms.
        </p>

        <h2>Contact</h2>
        <p>
          Questions about these terms: <ContactLine />
        </p>
      </div>
    </Layout>
  )
}
