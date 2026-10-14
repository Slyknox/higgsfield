import "server-only"

import { render } from "@react-email/components"
import { Resend } from "resend"

import { MagicLinkEmail, magicLinkText } from "@/emails/magic-link"
import { MAGIC_LINK_MINUTES } from "@/lib/auth/policy"
import { BRAND } from "@/lib/site/brand"

import { getPool } from "./db"
import { getEnv } from "./env"

/** Sends the sign-in email through Resend, or writes it to the local outbox. */
export async function sendMagicLink({
  to,
  url,
}: {
  to: string
  url: string
}): Promise<void> {
  const env = getEnv()
  const subject = `Sign in to ${BRAND.name}`
  const props = { url, brand: BRAND.name, expiresInMinutes: MAGIC_LINK_MINUTES }

  if (env.EMAIL_TRANSPORT === "outbox") {
    await getPool().query(
      "insert into email_outbox (recipient, subject, url) values ($1, $2, $3)",
      [to, subject, url]
    )
    console.info(
      `[email] outbox: sign-in link for ${to} stored in email_outbox`
    )
    return
  }

  const resend = new Resend(env.AUTH_RESEND_KEY)
  const { error } = await resend.emails.send({
    from: env.EMAIL_FROM,
    to,
    subject,
    html: await render(<MagicLinkEmail {...props} />),
    text: magicLinkText(props),
  })
  // Never log the link or the provider's full response: the link signs someone in.
  if (error)
    throw new Error(`Resend rejected the sign-in email (${error.name})`)
}
