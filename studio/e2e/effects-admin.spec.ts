import { expect, test } from "@playwright/test"

import { freshEmail, openSpecDatabase } from "./support/db"
import { signIn } from "./support/session"

const db = openSpecDatabase()

test("an effect opens the generator with its model and prompt filled in", async ({
  page,
}) => {
  await page.goto("/effects")
  await expect(page.getByRole("heading", { name: "Effects" })).toBeVisible()
  await page.getByRole("tab", { name: "Camera" }).click()
  await expect(page.getByRole("link", { name: /Studio packshot/ })).toHaveCount(
    0
  )
  await page.getByRole("link", { name: /Dolly zoom/ }).click()
  await expect(page).toHaveURL(/\/video\?model=seedance-2\.5&effect=dolly-zoom/)
  await expect(page.getByRole("textbox", { name: "Prompt" })).toHaveValue(
    /^Dolly zoom:/
  )
  await expect(page.getByText("Effect: Dolly zoom.")).toBeVisible()
})

test("the admin area is invisible to users and works for admins", async ({
  page,
}) => {
  const email = freshEmail("admin")
  await signIn(page, db(), email, "/")
  const res = await page.goto("/admin")
  expect(res?.status()).toBe(404)
  await page.goto("/")
  await page.getByRole("button", { name: /Account menu/ }).click()
  await expect(page.getByRole("menuitem", { name: "Admin" })).toHaveCount(0)
  await page.keyboard.press("Escape")

  await db().query("update users set role = 'admin' where email = $1", [email])
  await page.goto("/admin")
  await expect(page.getByRole("heading", { name: "Admin" })).toBeVisible()
  await expect(page.getByText("On, 2× markup")).toBeVisible()

  const target = freshEmail("target")
  await db().query("insert into users (email) values ($1)", [target])
  await page.getByRole("link", { name: "Users" }).click()
  await page.getByRole("searchbox", { name: "Search by email" }).fill(target)
  await page.getByRole("button", { name: "Search" }).click()
  await page.getByRole("link", { name: target }).click()
  await expect(page.getByRole("heading", { name: target })).toBeVisible()
  await page.getByLabel("Credits", { exact: true }).fill("250")
  await page.getByLabel(/Reason/).fill("Launch bonus")
  await page.getByRole("button", { name: "Adjust credits" }).click()
  await expect(page.getByText("New balance: 250 credits.")).toBeVisible()
  // The form clears after a successful change.
  await page.getByLabel("Credits", { exact: true }).fill("-500")
  await page.getByLabel(/Reason/).fill("Correction")
  await page.getByRole("button", { name: "Adjust credits" }).click()
  await expect(
    page.getByText("That would take the balance below zero.")
  ).toBeVisible()
  const { rows } = await db().query(
    `select l.delta, l.note, a.email as actor from credit_ledger l
     join users u on u.id = l.user_id left join users a on a.id = l.actor_id
     where u.email = $1`,
    [target]
  )
  expect(rows).toEqual([{ delta: 250, note: "Launch bonus", actor: email }])

  await page.getByRole("button", { name: /Account menu/ }).click()
  await expect(page.getByRole("menuitem", { name: "Admin" })).toBeVisible()
})

test("admin actions refuse non-admins", async ({ page }) => {
  await signIn(page, db(), freshEmail("not-admin"), "/")
  for (const path of ["/admin/users", "/admin/generations", "/admin/users/1"]) {
    const res = await page.goto(path)
    expect(res?.status(), path).toBe(404)
  }
})

test("a forged router state can't skip the admin check", async ({ page }) => {
  const secret = freshEmail("leak-target")
  await db().query("insert into users (email) values ($1)", [secret])
  await signIn(page, db(), freshEmail("forger"), "/")
  // Claims the /admin layout is already rendered, so only the page segment runs.
  const tree = ["", { children: ["admin", { children: ["__PAGE__", {}] }] }]
  for (const path of ["/admin/users", "/admin/generations", "/admin"]) {
    const res = await page.request.get(path, {
      headers: {
        RSC: "1",
        "Next-Router-State-Tree": encodeURIComponent(JSON.stringify(tree)),
      },
    })
    const body = await res.text()
    expect(body, path).not.toContain(secret)
    expect(body, path).not.toContain("Unspent credits")
  }
})
