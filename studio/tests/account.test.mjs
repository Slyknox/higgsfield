// Account summary and deletion.
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { after, before, test } from "node:test";

import { base, openDatabase, openGenerationDeps, plane, skip, wait } from "./support/harness.mjs";

const account = await import("../lib/account/service.ts");
const service = await import("../lib/generations/service.ts");
const projects = await import("../lib/projects/service.ts");

let db, gen;
before(async () => {
  if (!base) return;
  db = await openDatabase("account_test");
  gen = await openGenerationDeps(db.pool, { billing: { enabled: true, markup: 2, signupCredits: 5000 } });
});
after(async () => {
  await gen?.close();
  await db?.pool.end();
});

async function completed(userId, prompt) {
  const g = await service.createGeneration(gen.deps, userId, plane(prompt));
  for (let i = 0; i < 30; i++) {
    const now = await service.finalizeGeneration(gen.deps, g.id);
    if (now.status === "completed") return now;
    await wait(150);
  }
  throw new Error("never completed");
}

test("the summary counts only the user's own things", { skip }, async () => {
  const alice = await db.user();
  const bob = await db.user();
  await completed(alice, "one");
  await projects.createProject(db.pool, alice, { name: "P" });
  await completed(bob, "not alice's");
  const summary = await account.getAccountSummary(db.pool, alice);
  assert.equal(summary.generations.total, 1);
  assert.equal(summary.generations.completed, 1);
  assert.equal(summary.projects, 1);
  assert.equal(await account.getAccountSummary(db.pool, 999999), null);
});

test("deleting an account cancels running work, removes files and every row, and nothing else", { skip }, async () => {
  const carol = await db.user();
  const dan = await db.user();
  const done = await completed(carol, "keep me? no");
  const running = await service.createGeneration(gen.deps, carol, plane("[slow] running"));
  await projects.createProject(db.pool, carol, { name: "Gone" });
  const dansWork = await completed(dan, "dan's");
  const requestId = (await db.pool.query("select hf_request_id from generations where id = $1", [running.id])).rows[0].hf_request_id;

  const file = join(gen.mediaDir, `u/${carol}/${done.id}/0.mp4`);
  assert.equal(existsSync(file), true);
  const result = await account.deleteAccount(gen.deps, carol);
  assert.equal(result.filesRemoved, 1);
  assert.equal(existsSync(file), false);
  assert.equal((await gen.deps.platform.status(requestId)).status, "canceled", "running work is canceled on Higgsfield");

  for (const table of ["generations", "projects", "credit_balances", "credit_ledger", "sessions", "uploads"]) {
    const column = table === "sessions" ? '"userId"' : "user_id";
    const { rows } = await db.pool.query(`select count(*)::int n from ${table} where ${column} = $1`, [carol]);
    assert.equal(rows[0].n, 0, `${table} rows remain`);
  }
  assert.equal((await db.pool.query("select count(*)::int n from users where id = $1", [carol])).rows[0].n, 0);
  assert.equal(existsSync(join(gen.mediaDir, `u/${dan}/${dansWork.id}/0.mp4`)), true, "other users' files stay");
  assert.equal((await service.getGenerations(gen.deps, dan, [dansWork.id])).length, 1);
});
