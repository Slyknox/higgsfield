// Shared setup for database tests: resolves "@/..." and extensionless TS
// imports, builds a throwaway schema, and starts the fake Higgsfield.
// Database tests are skipped unless TEST_DATABASE_URL is set.
import { mkdtempSync, rmSync } from "node:fs";
import { registerHooks } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import pg from "pg";

import { migrate } from "../../scripts/db-migrate.mjs";
import { syncModels } from "../../scripts/sync-models.mjs";

const ROOT = fileURLToPath(new URL("../..", import.meta.url));
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "server-only") return { url: "data:text/javascript,", shortCircuit: true };
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

export const base = process.env.TEST_DATABASE_URL;
export const skip = base ? false : "TEST_DATABASE_URL not set";

/** A migrated schema of its own, a pool on it, and helpers to make users. */
export async function openDatabase(schema) {
  const admin = new pg.Client({ connectionString: base });
  await admin.connect();
  await admin.query(`drop schema if exists ${schema} cascade; create schema ${schema};`);
  await admin.end();
  const url = `${base}${base.includes("?") ? "&" : "?"}options=${encodeURIComponent(`-c search_path=${schema}`)}`;
  await migrate(url, () => {});
  const pool = new pg.Pool({ connectionString: url, max: 10 });
  let n = 0;
  const user = async (role = "user") =>
    (await pool.query("insert into users (email, role) values ($1, $2) returning id", [`${schema}-${++n}@example.com`, role])).rows[0].id;
  return { pool, user };
}

/** Generation dependencies wired to the fake Higgsfield and a temp media folder. */
export async function openGenerationDeps(pool, extra = {}) {
  const { createLocalStorage } = await import("../../lib/generations/storage.ts");
  const { createPlatformClient } = await import("../../generation/platform.ts");
  const { startFakeHiggsfield, FAKE_KEY } = await import("../../e2e/support/fake-higgsfield.ts");
  const fake = await startFakeHiggsfield();
  const mediaDir = mkdtempSync(join(tmpdir(), "studio-media-"));
  const client = createPlatformClient({ apiKey: FAKE_KEY, baseUrl: fake.url });
  const deps = {
    db: pool,
    platform: {
      submit: (p, b, o) => client.submit(p, b, o),
      status: (id) => client.status(id),
      cancel: (id) => client.cancel(id),
    },
    storage: createLocalStorage({ dir: mediaDir, publicBaseUrl: "http://localhost:3000/api/media" }),
    maxConcurrent: 4,
    ...extra,
  };
  const close = async () => {
    await fake.close();
    rmSync(mediaDir, { recursive: true, force: true });
  };
  return { deps, fake, mediaDir, close };
}

export const plane = (prompt, extra = {}) => ({
  model: "seedance-2.5",
  prompt: { text: prompt },
  media: {},
  settings: {},
  ...extra,
});

export const wait = (ms) => new Promise((r) => setTimeout(r, ms));
