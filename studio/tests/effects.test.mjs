// Effects must open a real model with settings that model accepts.
import assert from "node:assert/strict";
import { test } from "node:test";

import "./support/harness.mjs";

const { MODELS, getModel, parseSettings } = await import("../generation/catalog/index.ts");
const { EFFECTS, availableEffects, effectHref, findEffect } = await import("../lib/site/effects.ts");

test("every effect names an installed model on its own surface, with valid settings", () => {
  for (const e of EFFECTS) {
    const model = getModel(e.modelId);
    assert.equal(model.surface, e.surface, `${e.id} surface`);
    assert.doesNotThrow(() => parseSettings(model, e.settings ?? {}), `${e.id} settings`);
    if (e.input === "photo") assert.ok(model.roles.start || model.roles.reference, `${e.id} takes a photo`);
    assert.ok(e.prompt.length > 20 && e.prompt.length < 5000);
  }
  assert.equal(new Set(EFFECTS.map((e) => e.id)).size, EFFECTS.length, "ids are unique");
  assert.equal(availableEffects(MODELS).length, EFFECTS.length);
});

test("effects with a missing model are hidden, and links carry model and effect", () => {
  assert.deepEqual(availableEffects([{ id: "seedance-2.5" }]).map((e) => e.modelId), EFFECTS.filter((e) => e.modelId === "seedance-2.5").map(() => "seedance-2.5"));
  const e = findEffect("dolly-zoom");
  assert.equal(effectHref(e), "/video?model=seedance-2.5&effect=dolly-zoom");
  assert.equal(findEffect("nope"), undefined);
  assert.equal(findEffect(null), undefined);
});
