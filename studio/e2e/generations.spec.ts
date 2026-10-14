import { expect, test } from "@playwright/test"
import pg from "pg"

import { signIn } from "./support/session"

let db: pg.Pool
test.beforeAll(({}, testInfo) => {
  db = new pg.Pool({
    connectionString: String(testInfo.config.metadata.databaseUrl),
  })
})
test.afterAll(async () => {
  await db.end()
})

let counter = 0
const email = () => `gen-${Date.now()}-${counter++}@example.com`

async function generate(page: import("@playwright/test").Page, prompt: string) {
  await page.getByRole("textbox", { name: "Prompt" }).fill(prompt)
  await page.getByRole("button", { name: "Generate" }).click()
}

test("a video generates, is served from our storage, and survives a reload", async ({
  page,
}) => {
  await signIn(page, db, email(), "/video?model=seedance-2.5")
  await expect(page).toHaveURL(/\/video/)
  await generate(page, "A calm ocean at dawn")

  await expect(
    page
      .getByRole("status")
      .filter({ hasText: /generating/i })
      .first()
  ).toBeVisible()
  // The gallery tile puts the URL on a <source> inside its <video>.
  const video = page.locator('video source[src*="/api/media/u/"]').first()
  await expect(video).toBeAttached({ timeout: 20_000 })
  const src = await video.getAttribute("src")
  expect(src).toMatch(/\/api\/media\/u\/\d+\/[0-9a-f-]{36}\/0\.mp4$/)
  const media = await page.request.get(src!)
  expect(media.status()).toBe(200)
  expect(media.headers()["content-type"]).toBe("video/mp4")

  await page.reload()
  await expect(page.locator(`video source[src="${src}"]`)).toBeAttached()
})

test("a content-filter block shows a plain reason", async ({ page }) => {
  await signIn(page, db, email(), "/video?model=seedance-2.5")
  await generate(page, "[nsfw] blocked scene")
  await expect(page.getByText("Blocked by the content filter")).toBeVisible({
    timeout: 20_000,
  })
})

test("a queued generation can be canceled", async ({ page }) => {
  await signIn(page, db, email(), "/video?model=seedance-2.5")
  await generate(page, "[slow] a scene that waits")
  const cancel = page.getByRole("button", { name: "Cancel" })
  await expect(cancel).toBeVisible()
  await cancel.click()
  await expect(page.getByText("Canceled")).toBeVisible({ timeout: 10_000 })
  await expect(page.getByRole("button", { name: "Generate" })).toBeVisible()
})

test("one user can't read another user's generations", async ({
  page,
  browser,
}) => {
  await signIn(page, db, email(), "/video?model=seedance-2.5")
  await generate(page, "[slow] private to the first user")
  await expect(page.getByRole("button", { name: "Cancel" })).toBeVisible()
  const mine = await page.request.get("/api/generations")
  const [first] = ((await mine.json()) as { generations: { id: string }[] })
    .generations
  expect(first?.id).toBeTruthy()

  const other = await browser.newContext()
  const otherPage = await other.newPage()
  await signIn(otherPage, db, email(), "/assets")
  const list = await otherPage.request.get("/api/generations")
  expect(
    ((await list.json()) as { generations: unknown[] }).generations
  ).toEqual([])
  const status = await otherPage.request.get(
    `/api/generations/status?ids=${first!.id}`
  )
  expect(
    ((await status.json()) as { generations: unknown[] }).generations
  ).toEqual([])
  await other.close()

  await page.getByRole("button", { name: "Cancel" }).click()
})

test("signed-out requests to generation APIs are refused", async ({
  request,
}) => {
  expect((await request.get("/api/generations")).status()).toBe(401)
  expect((await request.get("/api/generations/status?ids=x")).status()).toBe(
    401
  )
  const upload = await request.post("/api/upload", {
    data: { contentType: "image/png" },
  })
  expect(upload.status()).toBe(401)
})

test("webhooks without a valid token are rejected", async ({ request }) => {
  const response = await request.post(
    "/api/webhooks/higgsfield?gid=00000000-0000-4000-8000-000000000000&t=" +
      "0".repeat(64),
    { data: { request_id: "x", status: "completed" } }
  )
  expect(response.status()).toBe(403)
})
