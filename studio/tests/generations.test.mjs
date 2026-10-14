// Generation service against real Postgres, a fake Higgsfield over HTTP and
// local storage. Skipped unless TEST_DATABASE_URL is set. Uses its own schema
// (gen_test), which it drops and rebuilds.
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { registerHooks } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, test } from "node:test";
import { fileURLToPath } from "node:url";

import pg from "pg";

import { migrate } from "../scripts/db-migrate.mjs";
import { syncModels } from "../scripts/sync-models.mjs";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith("@/")) specifier = new URL(specifier.slice(2), `file://${ROOT}`).href;
    try { return nextResolve(specifier, context); }
    catch (error) {
      if (!specifier.startsWith(".") && !specifier.startsWith("file:")) throw error;
      if (error.code === "ERR_UNSUPPORTED_DIR_IMPORT") return nextResolve(`${specifier}/index.ts`, context);
      if (error.code === "ERR_MODULE_NOT_FOUND") return nextResolve(`${specifier}.ts`, context);
      throw error;
    }
  },
});
syncModels();

const base = process.env.TEST_DATABASE_URL;
const skip = base ? false : "TEST_DATABASE_URL not set";
const SCHEMA = "gen_test";
const url = base ? `${base}${base.includes("?") ? "&" : "?"}options=${encodeURIComponent(`-c search_path=${SCHEMA}`)}` : "";

const service = await import("../lib/generations/service.ts");
const { createLocalStorage } = await import("../lib/generations/storage.ts");
const { webhookToken, verifyWebhookToken, webhookUrl } = await import("../lib/generations/webhook-token.ts");
const { createPlatformClient } = await import("../generation/platform.ts");
const { startFakeHiggsfield, FAKE_KEY } = await import("../e2e/support/fake-higgsfield.ts");

let pool, fake, deps, mediaDir, alice, bob;

before(async () => {
  if (!base) return;
  const admin = new pg.Client({ connectionString: base });
  await admin.connect();
  await admin.query(`drop schema if exists ${SCHEMA} cascade; create schema ${SCHEMA};`);
  await admin.end();
  await migrate(url, () => {});
  pool = new pg.Pool({ connectionString: url, max: 10 });
  alice = (await pool.query("insert into users (email) values ('alice@example.com') returning id")).rows[0].id;
  bob = (await pool.query("insert into users (email) values ('bob@example.com') returning id")).rows[0].id;
  fake = await startFakeHiggsfield();
  mediaDir = mkdtempSync(join(tmpdir(), "studio-media-"));
  const client = createPlatformClient({ apiKey: FAKE_KEY, baseUrl: fake.url });
  deps = {
    db: pool,
    platform: {
      submit: (p, b, o) => client.submit(p, b, o),
      status: (id) => client.status(id),
      cancel: (id) => client.cancel(id),
    },
    storage: createLocalStorage({ dir: mediaDir, publicBaseUrl: "http://localhost:3000/api/media" }),
    webhookUrlFor: (id) => webhookUrl("https://app.example.com", "w".repeat(40), id),
    maxConcurrent: 4,
  };
});

after(async () => {
  await pool?.end();
  await fake?.close();
  if (mediaDir) rmSync(mediaDir, { recursive: true, force: true });
});

const plane = (prompt, extra = {}) => ({
  model: "seedance-2.5",
  prompt: { text: prompt },
  media: {},
  settings: {},
  ...extra,
});
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function settleDone(id) {
  for (let i = 0; i < 30; i++) {
    const g = await service.finalizeGeneration(deps, id);
    if (!["pending_submit", "queued", "in_progress"].includes(g.status)) return g;
    await wait(150);
  }
  throw new Error("generation never settled");
}

test("webhook tokens verify only for their own generation", () => {
  const secret = "s".repeat(40);
  const token = webhookToken(secret, "gen-1");
  assert.equal(verifyWebhookToken(secret, "gen-1", token), true);
  assert.equal(verifyWebhookToken(secret, "gen-2", token), false);
  assert.equal(verifyWebhookToken("x".repeat(40), "gen-1", token), false);
  for (const bad of [undefined, "", "zz", token.slice(1), token.toUpperCase() + "0"]) {
    assert.equal(verifyWebhookToken(secret, "gen-1", bad), false);
  }
});

test("a generation is queued, completes, and its output is copied to our storage", { skip }, async () => {
  const created = await service.createGeneration(deps, alice, plane("a calm ocean at dawn"));
  assert.equal(created.status, "queued");
  const submitted = fake.submits.at(-1);
  assert.equal(submitted.path, "/bytedance/seedance-2.5/text-to-video");
  assert.match(submitted.webhookUrl, /\/api\/webhooks\/higgsfield\?gid=.+&t=[0-9a-f]{64}$/);

  const done = await settleDone(created.id);
  assert.equal(done.status, "completed");
  assert.equal(done.outputs.length, 1);
  assert.equal(done.outputs[0].kind, "video");
  assert.match(done.outputs[0].url, new RegExp(`^http://localhost:3000/api/media/u/${alice}/${created.id}/0\\.mp4$`));
  const file = join(mediaDir, `u/${alice}/${created.id}/0.mp4`);
  assert.equal(readFileSync(file, "utf8"), "fake-mp4-bytes");
  assert.equal("key" in done.outputs[0], false, "storage keys never reach the browser");
});

test("finalizing twice at once copies once and ends in one terminal state", { skip }, async () => {
  const created = await service.createGeneration(deps, alice, plane("twin finalize"));
  await wait(1300);
  const [a, b] = await Promise.all([
    service.finalizeGeneration(deps, created.id),
    service.finalizeGeneration(deps, created.id),
  ]);
  assert.equal(a.status, "completed");
  assert.deepEqual(a.outputs, b.outputs);
});

test("content-filter blocks and failures end with a plain message", { skip }, async () => {
  const nsfw = await settleDone((await service.createGeneration(deps, alice, plane("[nsfw] something"))).id);
  assert.equal(nsfw.status, "nsfw");
  assert.equal(nsfw.error, "Blocked by the content filter");
  const failed = await settleDone((await service.createGeneration(deps, alice, plane("[fail] something"))).id);
  assert.equal(failed.status, "failed");
  assert.equal(failed.error, "Fake failure");
});

test("a rejected submit is recorded as failed with the generator's reason", { skip }, async () => {
  const g = await service.createGeneration(deps, alice, plane("[reject] nope"));
  assert.equal(g.status, "failed");
  assert.equal(g.error, "Prompt rejected by the fake");
});

test("a 429 on submit is retried, and accepted the second time", { skip }, async () => {
  const g = await service.createGeneration(deps, alice, plane("[busy] retry me"));
  assert.equal(g.status, "queued");
});

test("invalid input never reaches Higgsfield", { skip }, async () => {
  const before = fake.submits.length;
  await assert.rejects(service.createGeneration(deps, alice, plane("x", { model: "not-a-model" })), { code: "invalid_input" });
  await assert.rejects(service.createGeneration(deps, alice, plane("x", { settings: { duration: 999 } })), { code: "invalid_input" });
  await assert.rejects(
    service.createGeneration(deps, alice, plane("x", { media: { start: [{ id: "1", role: "start", url: "file:///etc/passwd" }] } })),
    { code: "invalid_input" }
  );
  await assert.rejects(service.createGeneration(deps, alice, plane("x".repeat(5001))), { code: "invalid_input" });
  assert.equal(fake.submits.length, before);
});

test("cancel works while queued and is refused once started", { skip }, async () => {
  const slow = await service.createGeneration(deps, bob, plane("[slow] wait"));
  const canceled = await service.cancelGeneration(deps, bob, slow.id);
  assert.equal(canceled.status, "canceled");

  const started = await service.createGeneration(deps, bob, plane("starts quickly"));
  await wait(500);
  await service.finalizeGeneration(deps, started.id);
  await assert.rejects(service.cancelGeneration(deps, bob, started.id), { code: "cannot_cancel" });
});

test("users can't see, cancel or delete each other's generations", { skip }, async () => {
  const mine = await service.createGeneration(deps, alice, plane("[slow] private"));
  assert.deepEqual(await service.getGenerations(deps, bob, [mine.id]), []);
  assert.equal((await service.listGenerations(deps, bob)).some((g) => g.id === mine.id), false);
  await assert.rejects(service.cancelGeneration(deps, bob, mine.id), { code: "not_found" });
  await assert.rejects(service.deleteGeneration(deps, bob, mine.id), { code: "not_found" });
  await assert.rejects(service.cancelGeneration(deps, bob, "not-a-uuid"), { code: "not_found" });
  await service.cancelGeneration(deps, alice, mine.id);
});

test("concurrent submits can't exceed the per-user limit", { skip }, async () => {
  const { rows } = await pool.query("insert into users (email) values ('carol@example.com') returning id");
  const carol = rows[0].id;
  const results = await Promise.allSettled(
    Array.from({ length: 8 }, (_, i) => service.createGeneration(deps, carol, plane(`[slow] burst ${i}`)))
  );
  assert.equal(results.filter((r) => r.status === "fulfilled").length, 4);
  assert.ok(results.filter((r) => r.status === "rejected").every((r) => r.reason.code === "too_many_running"));
});

test("reconcile fails generations that ran too long", { skip }, async () => {
  const g = await service.createGeneration(deps, bob, plane("[slow] forever"));
  await pool.query("update generations set created_at = now() - interval '20 minutes' where id = $1", [g.id]);
  const result = await service.reconcile(deps, { userId: bob });
  assert.ok(result.timedOut >= 1);
  const [after] = await service.getGenerations(deps, bob, [g.id]);
  assert.equal(after.status, "failed");
  assert.match(after.error, /Timed out/);
});

test("deleting a generation removes its stored file", { skip }, async () => {
  const done = await settleDone((await service.createGeneration(deps, bob, plane("delete me"))).id);
  const file = join(mediaDir, `u/${bob}/${done.id}/0.mp4`);
  assert.equal(existsSync(file), true);
  await service.deleteGeneration(deps, bob, done.id);
  assert.equal(existsSync(file), false);
  assert.deepEqual(await service.getGenerations(deps, bob, [done.id]), []);
});

test("storage refuses keys outside a user's folder", () => {
  const storage = createLocalStorage({ dir: tmpdir(), publicBaseUrl: "http://x" });
  return assert.rejects(storage.putFromUrl("../../etc/passwd", "http://127.0.0.1/x"), /Invalid storage key/);
});
