// Projects in Postgres: ownership, names, delete, and linking generations.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, test } from "node:test";

import { base, openDatabase, openGenerationDeps, plane, skip } from "./support/harness.mjs";

const projects = await import("../lib/projects/service.ts");
const service = await import("../lib/generations/service.ts");

let db, gen;

before(async () => {
  if (!base) return;
  db = await openDatabase("projects_test");
  gen = await openGenerationDeps(db.pool);
});

after(async () => {
  await gen?.close();
  await db?.pool.end();
});

test("a project keeps the browser's id, cleans its name, and lists newest first", { skip }, async () => {
  const alice = await db.user();
  const id = randomUUID();
  const first = await projects.createProject(db.pool, alice, { id, name: "  Launch   video  " });
  assert.equal(first.id, id);
  assert.equal(first.name, "Launch video");
  const second = await projects.createProject(db.pool, alice, { name: "" });
  assert.equal(second.name, "Untitled");
  const long = await projects.createProject(db.pool, alice, { name: "x".repeat(200) });
  assert.equal(long.name.length, projects.MAX_PROJECT_NAME);
  const list = await projects.listProjects(db.pool, alice);
  assert.deepEqual(list.map((p) => p.id), [long.id, second.id, id]);
});

test("retrying a create is harmless; another user's id is refused", { skip }, async () => {
  const alice = await db.user();
  const bob = await db.user();
  const id = randomUUID();
  await projects.createProject(db.pool, alice, { id, name: "Mine" });
  assert.equal((await projects.createProject(db.pool, alice, { id, name: "Mine" })).id, id);
  await assert.rejects(projects.createProject(db.pool, bob, { id, name: "Steal" }), { code: "invalid_input" });
  await assert.rejects(projects.createProject(db.pool, bob, { id: "not-a-uuid" }), { code: "invalid_input" });
});

test("users can't rename or delete each other's projects", { skip }, async () => {
  const alice = await db.user();
  const bob = await db.user();
  const p = await projects.createProject(db.pool, alice, { name: "Private" });
  await assert.rejects(projects.renameProject(db.pool, bob, p.id, "Mine now"), { code: "not_found" });
  await assert.rejects(projects.deleteProject(db.pool, bob, p.id), { code: "not_found" });
  assert.deepEqual(await projects.listProjects(db.pool, bob), []);
  assert.equal((await projects.renameProject(db.pool, alice, p.id, "Renamed")).name, "Renamed");
});

test("generations join only their owner's project, and survive its deletion", { skip }, async () => {
  const alice = await db.user();
  const bob = await db.user();
  const p = await projects.createProject(db.pool, alice, { name: "Shoot" });
  const inside = await service.createGeneration(gen.deps, alice, plane("[slow] in project"), p.id);
  assert.equal(inside.projectId, p.id);
  const sneaky = await service.createGeneration(gen.deps, bob, plane("[slow] sneak in"), p.id);
  assert.equal(sneaky.projectId, null, "another user's project is ignored");
  const unknown = await service.createGeneration(gen.deps, alice, plane("[slow] old id"), "local-123");
  assert.equal(unknown.projectId, null);

  await projects.deleteProject(db.pool, alice, p.id);
  const [kept] = await service.getGenerations(gen.deps, alice, [inside.id]);
  assert.equal(kept.projectId, null);
  for (const g of [inside, sneaky, unknown])
    await service.cancelGeneration(gen.deps, g.id === sneaky.id ? bob : alice, g.id);
});
