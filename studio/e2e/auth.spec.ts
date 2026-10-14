import { expect, test, type Page } from "@playwright/test"
import pg from "pg"

let db: pg.Pool

test.beforeAll(({}, testInfo) => {
  db = new pg.Pool({ connectionString: String(testInfo.config.metadata.databaseUrl) })
})
test.afterAll(async () => {
  await db.end()
})

let counter = 0
const freshEmail = () => `e2e-${Date.now()}-${counter++}@example.com`

/** The newest magic link the outbox holds for this address. */
async function latestLink(email: string): Promise<string> {
  await expect
    .poll(async () => (await db.query("select count(*)::int as n from email_outbox where recipient = $1", [email])).rows[0].n)
    .toBeGreaterThan(0)
  const { rows } = await db.query("select url from email_outbox where recipient = $1 order by id desc limit 1", [email])
  return rows[0].url as string
}

async function requestLink(page: Page, email: string) {
  await page.getByLabel("Email").fill(email)
  await page.getByRole("button", { name: "Email me a sign-in link" }).click()
  await expect(page).toHaveURL(/\/login\/check-email/)
  await expect(page.getByRole("heading", { name: "Check your email" })).toBeVisible()
}

test("signed-out visitors see Log in and are sent to sign in from /assets", async ({ page }) => {
  await page.goto("/")
  await expect(page.getByRole("link", { name: "Sign up" })).toBeVisible()
  await page.goto("/assets")
  await expect(page).toHaveURL(/\/login\?callbackUrl=(%2F|\/)assets$/)
})

test("magic link signs in, lands on the callback page, and signs out", async ({ page }) => {
  const email = freshEmail()
  await page.goto("/login?callbackUrl=/assets")
  await requestLink(page, email)

  await page.goto(await latestLink(email))
  await expect(page).toHaveURL(/\/assets$/)
  await page.getByRole("button", { name: `Account menu for ${email}` }).click()
  await expect(page.getByText(email)).toBeVisible()

  await page.getByRole("menuitem", { name: "Sign out" }).click()
  await expect(page).toHaveURL(/\/$/)
  await expect(page.getByRole("link", { name: "Sign up" })).toBeVisible()
})

test("a magic link works only once", async ({ page, context }) => {
  const email = freshEmail()
  await page.goto("/login")
  await requestLink(page, email)
  const link = await latestLink(email)
  await page.goto(link)
  await expect(page.getByRole("button", { name: `Account menu for ${email}` })).toBeVisible()

  await context.clearCookies()
  await page.goto(link)
  await expect(page).toHaveURL(/\/login\/error\?error=Verification/)
  await expect(page.getByText(/expired or was already used/)).toBeVisible()
})

test("invalid emails are rejected before anything is sent", async ({ page }) => {
  await page.goto("/login")
  await page.getByLabel("Email").fill("not-an-email")
  await page.getByRole("button", { name: "Email me a sign-in link" }).click()
  await expect(page.locator("#email-error")).toHaveText("Enter a valid email address.")
  await expect(page).toHaveURL(/\/login$/)
})

test("an off-site callback is replaced with the home page", async ({ page }) => {
  await page.goto("/login?callbackUrl=https://evil.example/steal")
  await expect(page.locator('input[name="callbackUrl"]')).toHaveValue("/")
})

test("Generate while signed out keeps the prompt through sign-in", async ({ page }) => {
  const email = freshEmail()
  const prompt = "A slow dolly shot through a neon market at night"
  await page.goto("/video?model=seedance-2.5")
  await page.getByRole("textbox", { name: "Prompt" }).fill(prompt)
  await page.getByRole("button", { name: "Generate" }).click()
  await expect(page).toHaveURL(/\/login\?callbackUrl=%2Fvideo%3Fmodel%3Dseedance-2\.5/)

  await requestLink(page, email)
  await page.goto(await latestLink(email))
  await expect(page).toHaveURL(/\/video\?model=seedance-2\.5$/)
  await expect(page.getByRole("textbox", { name: "Prompt" })).toHaveValue(prompt)
})

test("one address gets at most five sign-in emails an hour", async ({ page }) => {
  const email = freshEmail()
  for (let i = 0; i < 5; i++) {
    await page.goto("/login")
    await requestLink(page, email)
  }
  await page.goto("/login")
  await page.getByLabel("Email").fill(email)
  await page.getByRole("button", { name: "Email me a sign-in link" }).click()
  await expect(page.locator("#email-error")).toHaveText(/couldn't send the sign-in email/)
  const { rows } = await db.query("select count(*)::int as n from email_outbox where recipient = $1", [email])
  expect(rows[0].n).toBe(5)
})
