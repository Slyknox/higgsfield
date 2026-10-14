// The reference library: only confirmed uploads, only the owner's.
import assert from "node:assert/strict";
import { after, before, test } from "node:test";

import { base, openDatabase, skip } from "./support/harness.mjs";

const uploads = await import("../lib/uploads/service.ts");

let db;
before(async () => { if (base) db = await openDatabase("uploads_test"); });
after(async () => { await db?.pool.end(); });

const prepare = (userId, url, type = "image/png") =>
  db.pool.query("insert into uploads (user_id, public_url, content_type) values ($1, $2, $3)", [userId, url, type]);

test("an upload joins the library only once confirmed", { skip }, async () => {
  const alice = await db.user();
  await prepare(alice, "https://cdn.example.com/a.png");
  await prepare(alice, "https://cdn.example.com/never-finished.png");
  assert.deepEqual(await uploads.listUploads(db.pool, alice), []);
  const confirmed = await uploads.confirmUpload(db.pool, alice, "https://cdn.example.com/a.png", "  cat.png ");
  assert.equal(confirmed.name, "cat.png");
  const list = await uploads.listUploads(db.pool, alice);
  assert.deepEqual(list.map((u) => u.url), ["https://cdn.example.com/a.png"]);
  // Confirming twice is harmless.
  await uploads.confirmUpload(db.pool, alice, "https://cdn.example.com/a.png");
  assert.equal((await uploads.listUploads(db.pool, alice)).length, 1);
});

test("nobody can confirm someone else's upload or an unknown URL", { skip }, async () => {
  const alice = await db.user();
  const bob = await db.user();
  await prepare(alice, "https://cdn.example.com/private.png");
  await assert.rejects(uploads.confirmUpload(db.pool, bob, "https://cdn.example.com/private.png"), { code: "not_found" });
  await assert.rejects(uploads.confirmUpload(db.pool, bob, "https://evil.example.com/x.png"), { code: "not_found" });
  await assert.rejects(uploads.confirmUpload(db.pool, bob, 42), { code: "invalid_input" });
  assert.deepEqual(await uploads.listUploads(db.pool, bob), []);
});
