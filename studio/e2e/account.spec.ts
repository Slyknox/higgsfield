import { expect, test } from "@playwright/test"

import { freshEmail, openSpecDatabase } from "./support/db"
import { signIn } from "./support/session"

const db = openSpecDatabase()

test("signed-out visitors are sent to sign in", async ({ page }) => {
  await page.goto("/account")
  await expect(page).toHaveURL(/\/login\?callbackUrl=(%2F|\/)account$/)
})

test("Generate shows its price, debits it, and the account shows the history", async ({
  page,
}) => {
  const email = freshEmail("acct")
  await signIn(page, db(), email, "/video?model=seedance-2.5")
  const generate = page.getByRole("button", { name: /Generate/ })
  // Seedance 2.5, 5 s at $0.206/s and 2× markup.
  await expect(generate).toContainText("206")
  await expect(page.getByText("1,000 credits left.")).toBeVisible()

  await page
    .getByRole("textbox", { name: "Prompt" })
    .fill("A lighthouse at dusk")
  await generate.click()
  await expect(page.getByText("794 credits left.")).toBeVisible()

  await page.goto("/account")
  await expect(
    page.getByRole("heading", { name: "Account", exact: true })
  ).toBeVisible()
  await expect(
    page.getByRole("region", { name: "Profile" }).getByText(email)
  ).toBeVisible()
  await expect(page.getByText("794 credits")).toBeVisible()
  await expect(page.getByRole("cell", { name: "Generation" })).toBeVisible()
  await expect(
    page.getByRole("cell", { name: "Welcome credits" })
  ).toBeVisible()
})

test("without enough credits the generator says so and nothing runs", async ({
  page,
}) => {
  const email = freshEmail("broke")
  await signIn(page, db(), email, "/video?model=seedance-2.5")
  await db().query(
    "update credit_balances set balance = 0 where user_id = (select id from users where email = $1)",
    [email]
  )
  await page.getByRole("textbox", { name: "Prompt" }).fill("Too expensive")
  await page.getByRole("button", { name: /Generate/ }).click()
  await expect(page.getByText(/costs 206 credits and you have 0/)).toBeVisible()
  const { rows } = await db().query(
    "select count(*)::int n from generations g join users u on u.id = g.user_id where u.email = $1",
    [email]
  )
  expect(rows[0].n).toBe(0)
})

test("a failed generation gives its credits back", async ({ page }) => {
  const email = freshEmail("refund")
  await signIn(page, db(), email, "/video?model=seedance-2.5")
  await page.getByRole("textbox", { name: "Prompt" }).fill("[fail] this breaks")
  await page.getByRole("button", { name: /Generate/ }).click()
  await expect(page.getByText("Fake failure")).toBeVisible({ timeout: 20_000 })
  await page.goto("/account")
  await expect(page.getByText("1,000 credits")).toBeVisible()
  await expect(page.getByRole("cell", { name: "Refund" })).toBeVisible()
})

test("deleting the account needs the email typed back, then removes everything", async ({
  page,
}) => {
  const email = freshEmail("delete")
  await signIn(page, db(), email, "/account")
  const button = page.getByRole("button", { name: "Delete my account" })
  await expect(button).toBeDisabled()
  await page.getByLabel(/to confirm/).fill("wrong@example.com")
  await expect(button).toBeDisabled()
  await page.getByLabel(/to confirm/).fill(email)
  await button.click()
  await expect(page).toHaveURL(/\/$/)
  await expect(page.getByRole("link", { name: "Log in" })).toBeVisible()
  const { rows } = await db().query(
    "select count(*)::int n from users where email = $1",
    [email]
  )
  expect(rows[0].n).toBe(0)
})
