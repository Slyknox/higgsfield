// Prepaid credits: pricing, debit before submit, refunds and the billing switch.
import assert from "node:assert/strict";
import { after, before, test } from "node:test";

import { base, openDatabase, openGenerationDeps, plane, skip, wait } from "./support/harness.mjs";

const { getModel } = await import("../generation/catalog/index.ts");
const { priceOf, FALLBACK_IMAGE_USD } = await import("../lib/billing/pricing.ts");
const credits = await import("../lib/billing/credits.ts");
const service = await import("../lib/generations/service.ts");

const BILLING = { enabled: true, markup: 2, signupCredits: 1000 };
let db, paid, free;

before(async () => {
  if (!base) return;
  db = await openDatabase("credits_test");
  paid = await openGenerationDeps(db.pool, { billing: BILLING });
  free = await openGenerationDeps(db.pool);
});

after(async () => {
  await paid?.close();
  await free?.close();
  await db?.pool.end();
});

async function settled(deps, id) {
  for (let i = 0; i < 30; i++) {
    const g = await service.finalizeGeneration(deps, id);
    if (!["pending_submit", "queued", "in_progress"].includes(g.status)) return g;
    await wait(150);
  }
  throw new Error("generation never settled");
}

const balance = (userId) => credits.getBalance(db.pool, userId);
const ledger = async (userId) =>
  (await db.pool.query("select reason, delta from credit_ledger where user_id = $1 order by id", [userId])).rows;

test("prices come from list prices, rounded up, and scale with duration", () => {
  const seedance = getModel("seedance-2.5");
  assert.deepEqual(priceOf(seedance, { duration: 5 }, 2), { credits: 206, usd: 0.206 * 5, estimated: false });
  assert.equal(priceOf(seedance, { duration: 10 }, 2).credits, 412);
  assert.equal(priceOf(getModel("kling-3-std"), { duration: 5 }, 2).credits, 84);
  const pro = priceOf(getModel("kling-3-pro"), { duration: 5 }, 2);
  assert.equal(pro.estimated, true, "variants don't inherit the base model's price");
  assert.ok(pro.credits > 84);
  assert.equal(priceOf(seedance, {}, 2).credits, 206, "uses the model's default duration");
  assert.equal(priceOf(seedance, { duration: 5 }, 0.5).credits, 103, "markup below 1 is treated as 1");
});

test("unobserved models are flagged as estimates and priced high", () => {
  const image = getModel("flux-2");
  const price = priceOf(image, {}, 2);
  assert.equal(price.estimated, true);
  assert.equal(price.credits, Math.ceil(FALLBACK_IMAGE_USD * 2 * 100));
});

test("a paid generation debits once and keeps its result", { skip }, async () => {
  const alice = await db.user();
  const g = await service.createGeneration(paid.deps, alice, plane("calm sea", { settings: { duration: 5 } }));
  assert.equal(g.status, "queued");
  assert.equal(await balance(alice), 1000 - 206);
  const done = await settled(paid.deps, g.id);
  assert.equal(done.status, "completed");
  assert.equal(await balance(alice), 1000 - 206, "completed generations aren't refunded");
  assert.deepEqual(await ledger(alice), [
    { reason: "signup", delta: 1000 },
    { reason: "debit", delta: -206 },
  ]);
});

test("sign-up credits are granted once", { skip }, async () => {
  const bob = await db.user();
  await credits.ensureAccount(db.pool, bob, 500);
  await credits.ensureAccount(db.pool, bob, 500);
  assert.equal(await balance(bob), 500);
  assert.equal((await ledger(bob)).length, 1);
});

test("without enough credits nothing is created or submitted", { skip }, async () => {
  const carol = await db.user();
  await credits.ensureAccount(db.pool, carol, 100);
  const submits = paid.fake.submits.length;
  await assert.rejects(
    service.createGeneration(paid.deps, carol, plane("too expensive", { settings: { duration: 5 } })),
    { code: "insufficient_credits", message: /costs 206 credits and you have 100/ }
  );
  assert.equal(paid.fake.submits.length, submits);
  assert.equal((await db.pool.query("select count(*)::int n from generations where user_id = $1", [carol])).rows[0].n, 0);
  assert.equal(await balance(carol), 100);
});

test("failed, blocked, rejected and canceled generations are refunded exactly once", { skip }, async () => {
  const dave = await db.user();
  const failed = await service.createGeneration(paid.deps, dave, plane("[fail] x"));
  const nsfw = await service.createGeneration(paid.deps, dave, plane("[nsfw] x"));
  const rejected = await service.createGeneration(paid.deps, dave, plane("[reject] x"));
  assert.equal(rejected.status, "failed");
  const slow = await service.createGeneration(paid.deps, dave, plane("[slow] x"));
  await service.cancelGeneration(paid.deps, dave, slow.id);
  await settled(paid.deps, failed.id);
  await settled(paid.deps, nsfw.id);
  // Finalizing and reconciling again must not refund twice.
  await service.finalizeGeneration(paid.deps, failed.id);
  await service.reconcile(paid.deps, { userId: dave });
  assert.equal(await balance(dave), 1000);
  const refunds = (await ledger(dave)).filter((e) => e.reason === "refund");
  assert.equal(refunds.length, 4);
});

test("deleting a queued generation cancels it and refunds", { skip }, async () => {
  const erin = await db.user();
  const g = await service.createGeneration(paid.deps, erin, plane("[slow] delete me"));
  assert.equal(await balance(erin), 1000 - 206);
  await service.deleteGeneration(paid.deps, erin, g.id);
  assert.equal(await balance(erin), 1000);
});

test("timed-out generations are refunded by the reconciler", { skip }, async () => {
  const fay = await db.user();
  const g = await service.createGeneration(paid.deps, fay, plane("[slow] forever"));
  await db.pool.query("update generations set created_at = now() - interval '20 minutes' where id = $1", [g.id]);
  await service.reconcile(paid.deps, { userId: fay });
  assert.equal(await balance(fay), 1000);
});

test("parallel submits can't spend more than the balance", { skip }, async () => {
  const gus = await db.user();
  await credits.ensureAccount(db.pool, gus, 206 * 2);
  const results = await Promise.allSettled(
    Array.from({ length: 4 }, (_, i) => service.createGeneration(paid.deps, gus, plane(`[slow] burst ${i}`)))
  );
  assert.equal(results.filter((r) => r.status === "fulfilled").length, 2);
  assert.ok(results.filter((r) => r.status === "rejected").every((r) => r.reason.code === "insufficient_credits"));
  assert.equal(await balance(gus), 0);
});

test("with billing off, generations are free and no credits move", { skip }, async () => {
  const hal = await db.user();
  const g = await service.createGeneration(free.deps, hal, plane("free one"));
  assert.equal(g.status, "queued");
  assert.equal((await db.pool.query("select cost from generations where id = $1", [g.id])).rows[0].cost, 0);
  assert.deepEqual(await ledger(hal), []);
});

test("admin adjustments are logged and can't go below zero", { skip }, async () => {
  const ida = await db.user();
  const admin = await db.user("admin");
  assert.equal(await credits.adjustCredits(db.pool, ida, 300, "Support credit", admin), 300);
  await assert.rejects(credits.adjustCredits(db.pool, ida, -301, "Too much", admin), { code: "invalid_input" });
  await assert.rejects(credits.adjustCredits(db.pool, ida, 10, "  ", admin), { code: "invalid_input" });
  await assert.rejects(credits.adjustCredits(db.pool, ida, 1.5, "half", admin), { code: "invalid_input" });
  assert.equal(await balance(ida), 300);
  const [entry] = await credits.listLedger(db.pool, ida);
  assert.equal(entry.reason, "admin");
  assert.equal(entry.note, "Support credit");
});
