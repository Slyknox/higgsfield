import { expect, test } from "@playwright/test"

import { freshEmail, openSpecDatabase } from "./support/db"
import { signIn } from "./support/session"

const db = openSpecDatabase()

test("a project is saved on the server and is private to its owner", async ({
  page,
  browser,
}) => {
  await signIn(page, db(), freshEmail("proj"), "/assets")
  await page.getByRole("button", { name: "New project" }).click()
  await page
    .getByRole("textbox", { name: "Project name" })
    .fill("Spring launch")
  await page.getByRole("button", { name: "Create" }).click()
  await expect(page.getByText("Spring launch").first()).toBeVisible()

  // Saved on the server: it survives a reload and a cleared browser store.
  await expect
    .poll(async () => {
      const res = await page.request.get("/api/projects")
      return (
        (await res.json()) as { projects: { name: string }[] }
      ).projects.map((p) => p.name)
    })
    .toEqual(["Spring launch"])
  await page.evaluate(() => window.localStorage.clear())
  await page.reload()
  await expect(page.getByText("Spring launch").first()).toBeVisible()

  const other = await browser.newPage()
  await signIn(other, db(), freshEmail("proj-other"), "/assets")
  const res = await other.request.get("/api/projects")
  expect(((await res.json()) as { projects: unknown[] }).projects).toEqual([])
  const [project] = (
    (await (await page.request.get("/api/projects")).json()) as {
      projects: { id: string }[]
    }
  ).projects
  const steal = await other.request.patch(`/api/projects/${project.id}`, {
    data: { name: "Mine now" },
  })
  expect(steal.status()).toBe(404)
  const del = await other.request.delete(`/api/projects/${project.id}`)
  expect(del.status()).toBe(404)
  await other.close()
})

test("project and upload APIs refuse signed-out and cross-site requests", async ({
  page,
  request,
}) => {
  expect((await request.get("/api/projects")).status()).toBe(401)
  expect((await request.get("/api/uploads")).status()).toBe(401)
  expect((await request.get("/api/credits")).status()).toBe(401)
  await signIn(page, db(), freshEmail("csrf"), "/assets")
  const cross = await page.request.post("/api/projects", {
    data: { name: "From elsewhere" },
    headers: { Origin: "https://evil.example.com" },
  })
  expect(cross.status()).toBe(403)
})
