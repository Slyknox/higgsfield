import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
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
const { MODELS } = await import("../generation/catalog/index.ts");
const { resolveModelParam } = await import("../lib/site/model-query.ts");
const { modelMeta } = await import("../lib/site/model-meta.ts");

test("?model= accepts catalog ids and Higgsfield-style ids", () => {
  assert.equal(resolveModelParam(MODELS, "seedance-2.5")?.id, "seedance-2.5");
  assert.equal(resolveModelParam(MODELS, "seedance_2_5")?.id, "seedance-2.5");
  assert.equal(resolveModelParam(MODELS, "SEEDANCE_2_5", "video")?.id, "seedance-2.5");
});

test("?model= ignores unknown models and models from another surface", () => {
  assert.equal(resolveModelParam(MODELS, "not-a-model"), undefined);
  assert.equal(resolveModelParam(MODELS, ""), undefined);
  assert.equal(resolveModelParam(MODELS, null), undefined);
  assert.equal(resolveModelParam(MODELS, "seedance-2.5", "image"), undefined);
  assert.equal(resolveModelParam(MODELS, "soul-2", "video"), undefined);
});

test("every installed model has its own picker description", () => {
  const generic = MODELS.filter((m) => /^(Image|Video) generation$/.test(modelMeta(m).description));
  assert.deepEqual(generic.map((m) => m.id), []);
});

const { modeOf, modesFor, familyOf } = await import("../lib/site/model-modes.ts");

test("generator modes: edit needs a source clip, motion models transfer motion", () => {
  const byId = (id) => MODELS.find((m) => m.id === id);
  assert.equal(modeOf(byId("seedance-2.5")), "create");
  assert.equal(modeOf(byId("seedance-2.5-edit")), "edit");
  assert.equal(modeOf(byId("seedance-2.5-extend")), "edit");
  assert.equal(modeOf(byId("kling-3-motion-std")), "motion");
  assert.equal(modeOf(byId("kling-3-pro")), "create");
});

test("video shows all three mode tabs; image shows none", () => {
  assert.deepEqual(modesFor(MODELS.filter((m) => m.surface === "video")), ["create", "edit", "motion"]);
  assert.deepEqual(modesFor(MODELS.filter((m) => m.surface === "image")), ["create"]);
});

test("every model belongs to a named family for the picker", () => {
  assert.equal(familyOf(MODELS.find((m) => m.id === "kling-o3")), "Kling");
  for (const m of MODELS) assert.ok(familyOf(m).length > 0, m.id);
});
