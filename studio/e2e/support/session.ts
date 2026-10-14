import { expect, type Page } from "@playwright/test"
import type pg from "pg"

/** Signs in through the real magic-link flow, reading the link from the local outbox. */
export async function signIn(
  page: Page,
  db: pg.Pool,
  email: string,
  callbackUrl = "/"
) {
  // Every test signs in from 127.0.0.1; reset the per-network limit (20 an
  // hour) so the suite isn't capped by it. Per-address limits still apply.
  await db.query("delete from rate_limits where key like 'magic-link:ip:%'")
  await page.goto(`/login?callbackUrl=${encodeURIComponent(callbackUrl)}`)
  await page.getByLabel("Email").fill(email)
  await page.getByRole("button", { name: "Email me a sign-in link" }).click()
  await expect(page).toHaveURL(/\/login\/check-email/)
  await expect
    .poll(
      async () =>
        (
          await db.query(
            "select count(*)::int as n from email_outbox where recipient = $1",
            [email]
          )
        ).rows[0].n
    )
    .toBeGreaterThan(0)
  const { rows } = await db.query(
    "select url from email_outbox where recipient = $1 order by id desc limit 1",
    [email]
  )
  await page.goto(rows[0].url as string)
}
