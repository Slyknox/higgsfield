// Runs against a real Postgres. Skipped unless TEST_DATABASE_URL is set.
// The schema in that database is dropped and rebuilt: never point it at real data.
import assert from "node:assert/strict";
import { readdirSync } from "node:fs";
import { after, before, test } from "node:test";

import pg from "pg";

import { migrate } from "../scripts/db-migrate.mjs";

const url = process.env.TEST_DATABASE_URL;
const skip = url ? false : "TEST_DATABASE_URL not set";
let pool;

before(async () => {
  if (!url) return;
  const admin = new pg.Client({ connectionString: url });
  await admin.connect();
  await admin.query("drop schema public cascade; create schema public;");
  await admin.end();
  await migrate(url, () => {});
  pool = new pg.Pool({ connectionString: url, max: 10 });
});

after(async () => {
  await pool?.end();
});

const { hitRateLimit } = await import("../lib/auth/rate-limit.ts");

test("migrations are idempotent: a rerun applies nothing new", { skip }, async () => {
  const files = readdirSync(new URL("../db/migrations/", import.meta.url)).filter((f) => f.endsWith(".sql"));
  await migrate(url, () => {});
  const { rows } = await pool.query("select count(*)::int as n from schema_migrations");
  assert.equal(rows[0].n, files.length);
});

test("every table has row level security on, so Supabase's public API reads nothing", { skip }, async () => {
  const { rows } = await pool.query(
    "select relname from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity"
  );
  assert.deepEqual(rows.map((r) => r.relname), []);
});

test("rate limit allows up to the limit, then blocks", { skip }, async () => {
  const results = [];
  for (let i = 0; i < 4; i++) results.push(await hitRateLimit(pool, "t:sequential", 3, 3600));
  assert.deepEqual(results.map((r) => r.allowed), [true, true, true, false]);
});

test("concurrent hits are counted exactly once each", { skip }, async () => {
  const results = await Promise.all(Array.from({ length: 20 }, () => hitRateLimit(pool, "t:concurrent", 10, 3600)));
  assert.deepEqual([...results.map((r) => r.count)].sort((a, b) => a - b), Array.from({ length: 20 }, (_, i) => i + 1));
  assert.equal(results.filter((r) => r.allowed).length, 10);
});

test("an expired window starts over", { skip }, async () => {
  await hitRateLimit(pool, "t:window", 1, 60);
  assert.equal((await hitRateLimit(pool, "t:window", 1, 60)).allowed, false);
  await pool.query("update rate_limits set window_start = now() - interval '2 minutes' where key = 't:window'");
  const fresh = await hitRateLimit(pool, "t:window", 1, 60);
  assert.equal(fresh.allowed, true);
  assert.equal(fresh.count, 1);
});

test("deleting a user removes their sessions", { skip }, async () => {
  const { rows } = await pool.query("insert into users (email) values ('gone@example.com') returning id");
  await pool.query(`insert into sessions ("userId", expires, "sessionToken") values ($1, now() + interval '1 day', 'tok')`, [rows[0].id]);
  await pool.query("delete from users where id = $1", [rows[0].id]);
  const left = await pool.query(`select count(*)::int as n from sessions where "sessionToken" = 'tok'`);
  assert.equal(left.rows[0].n, 0);
});
