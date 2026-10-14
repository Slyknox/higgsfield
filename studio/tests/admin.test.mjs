// Admin queries: overview counts, user search and the stuck filter.
import assert from "node:assert/strict";
import { after, before, test } from "node:test";

import { base, openDatabase, skip } from "./support/harness.mjs";

const admin = await import("../lib/admin/service.ts");

let db;
before(async () => { if (base) db = await openDatabase("admin_test"); });
after(async () => { await db?.pool.end(); });

const insertGeneration = (userId, status, minutesAgo = 0) =>
  db.pool.query(
    `insert into generations (user_id, surface, model_id, model_path, status, created_at, updated_at)
     values ($1, 'video', 'seedance-2.5', 'p', $2, now() - make_interval(mins => $3), now())
     returning id`,
    [userId, status, minutesAgo]
  ).then((r) => r.rows[0].id);

test("the overview counts running, stuck and failed work", { skip }, async () => {
  const u = await db.user();
  await insertGeneration(u, "queued", 1);
  const stuck = await insertGeneration(u, "in_progress", 30);
  await insertGeneration(u, "failed", 5);
  await insertGeneration(u, "completed", 5);
  const o = await admin.getOverview(db.pool);
  assert.equal(o.inFlight, 2);
  assert.equal(o.stuck, 1);
  assert.equal(o.failed24h, 1);
  assert.equal(o.generations24h, 4);
  const rows = await admin.listGenerations(db.pool, { stuck: true });
  assert.deepEqual(rows.map((r) => r.id), [stuck]);
  assert.deepEqual((await admin.listGenerations(db.pool, { status: "failed" })).map((r) => r.status), ["failed"]);
});

test("user search matches part of an email and treats input as text", { skip }, async () => {
  const { rows } = await db.pool.query("insert into users (email) values ('Zed.Search@Example.com') returning id");
  const found = await admin.listUsers(db.pool, { query: "zed.search" });
  assert.deepEqual(found.map((u) => u.id), [rows[0].id]);
  assert.deepEqual(await admin.listUsers(db.pool, { query: "%' or 1=1 --" }), []);
  assert.deepEqual(await admin.listUsers(db.pool, { query: "%" }), [], "no LIKE wildcards");
  assert.equal(await admin.getUser(db.pool, -1), null);
  assert.equal(await admin.getUser(db.pool, 1.5), null);
});

test("status filters reject unknown values", () => {
  assert.equal(admin.isGenerationStatus("completed"), true);
  assert.equal(admin.isGenerationStatus("drop table"), false);
  assert.equal(admin.isGenerationStatus(undefined), false);
});
