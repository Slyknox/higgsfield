import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { test } from "node:test";
import { syncModels } from "../scripts/sync-models.mjs";

registerHooks({
  resolve(specifier, context, nextResolve) {
    try { return nextResolve(specifier, context); }
    catch (error) {
      if (!specifier.startsWith(".")) throw error;
      if (error.code === "ERR_UNSUPPORTED_DIR_IMPORT") return nextResolve(`${specifier}/index.ts`, context);
      if (error.code === "ERR_MODULE_NOT_FOUND") return nextResolve(`${specifier}.ts`, context);
      throw error;
    }
  },
});

syncModels();
const catalog = await import("../generation/catalog/index.ts");

const media = (role, n) =>
  Array.from({ length: n }, (_, i) => ({ id: `${role}-${i}`, url: `https://cdn.example.com/${role}-${i}`, role }));

function plane(modelId, { text = "", media: items = {}, settings = {} } = {}) {
  const model = catalog.getModel(modelId);
  return {
    model: modelId,
    prompt: { text },
    media: items,
    settings: catalog.parseSettings(model, settings),
  };
}

const request = (modelId, input) => catalog.getModel(modelId).toPlatform(plane(modelId, input));

test("Seedance 2.5 is the studio's default video model", () => {
  const model = catalog.defaultModel();
  assert.equal(model?.id, "seedance-2.5");
  assert.equal(model?.surface, "video");
});

test("prompt-only Seedance 2.5 posts text-to-video with defaults", () => {
  assert.deepEqual(request("seedance-2.5", { text: "  a coastal road at sunset  " }), {
    path: "bytedance/seedance-2.5/text-to-video",
    body: {
      prompt: "a coastal road at sunset",
      resolution: "720p",
      generate_audio: true,
      duration: 5,
      bitrate_mode: "high",
      aspect_ratio: "16:9",
    },
  });
});

test("start and end frames route to image-to-video without aspect ratio", () => {
  const { path, body } = request("seedance-2.5", {
    text: "dolly in",
    media: { start: media("start", 1), end: media("end", 1) },
  });
  assert.equal(path, "bytedance/seedance-2.5/image-to-video");
  assert.equal(body.image_url, "https://cdn.example.com/start-0");
  assert.equal(body.end_image_url, "https://cdn.example.com/end-0");
  assert.equal("aspect_ratio" in body, false);
});

test("references route to reference-to-video and frames cannot mix with them", () => {
  const { path, body } = request("seedance-2.5", {
    media: { reference: media("reference", 2), video: media("video", 1), audio: media("audio", 1) },
  });
  assert.equal(path, "bytedance/seedance-2.5/reference-to-video");
  assert.equal(body.image_urls.length, 2);
  assert.equal(body.video_urls.length, 1);
  assert.equal(body.audio_urls.length, 1);
  assert.throws(
    () => request("seedance-2.5", { media: { start: media("start", 1), reference: media("reference", 1) } }),
    /either frames or references/i,
  );
});

test("an empty prompt with no media is rejected before reaching the API", () => {
  assert.throws(() => request("seedance-2.5", { text: "   " }), /prompt or add a reference/i);
});

test("edit and extend post the source video to their own endpoints", () => {
  const source = { source: media("source", 1) };
  const edit = request("seedance-2.5-edit", { text: "make it night", media: source });
  assert.equal(edit.path, "bytedance/seedance-2.5/video-edit");
  assert.equal(edit.body.video_url, "https://cdn.example.com/source-0");
  assert.equal("duration" in edit.body, false);

  const extend = request("seedance-2.5-extend", { text: "keep driving", media: source, settings: { duration: 8 } });
  assert.equal(extend.path, "bytedance/seedance-2.5/video-extend");
  assert.equal(extend.body.duration, 8);
});

test("settings outside the catalog's ranges are rejected, not sent", () => {
  const model = catalog.getModel("seedance-2.5");
  assert.throws(() => catalog.parseSettings(model, { duration: 99 }), /Invalid duration/);
  assert.throws(() => catalog.parseSettings(model, { resolution: "4k" }), /Invalid resolution/);
});
