// Transactional email via Postmark. Env: POSTMARK_API_KEY (server token),
// POSTMARK_FROM (a verified Sender Signature address — no domain needed).
// Fails open: without keys, mail is skipped and a warning is logged so auth
// flows never break in dev.

const API = "https://api.postmarkapp.com/email"

export function mailConfigured() {
  return Boolean(process.env.POSTMARK_API_KEY && process.env.POSTMARK_FROM)
}

export async function sendMail(opts: { to: string; subject: string; html: string; text?: string }) {
  const token = process.env.POSTMARK_API_KEY
  const from = process.env.POSTMARK_FROM
  if (!token || !from) {
    console.warn(`[mail] POSTMARK_API_KEY/POSTMARK_FROM not set — skipping "${opts.subject}" to ${opts.to}`)
    return false
  }
  try {
    const res = await fetch(API, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-postmark-server-token": token,
      },
      body: JSON.stringify({
        From: from,
        To: opts.to,
        Subject: opts.subject,
        HtmlBody: opts.html,
        TextBody: opts.text ?? opts.html.replace(/<[^>]+>/g, ""),
        MessageStream: "outbound",
      }),
    })
    if (!res.ok) {
      console.error(`[mail] postmark ${res.status}: ${await res.text()}`)
      return false
    }
    return true
  } catch (error) {
    console.error("[mail] send failed:", error)
    return false
  }
}
