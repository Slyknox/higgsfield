import type { FullConfig } from "@playwright/test"
import pg from "pg"

import { migrate } from "../scripts/db-migrate.mjs"
import { startFakeHiggsfield } from "./support/fake-higgsfield"

/** Fresh schema, then a fake Higgsfield for the app to call. Returns its teardown. */
export default async function globalSetup(config: FullConfig) {
  const url = String(config.metadata.databaseUrl)
  const client = new pg.Client({ connectionString: url })
  await client.connect()
  await client.query("drop schema public cascade; create schema public;")
  await client.end()
  await migrate(url, () => {})
  const fake = await startFakeHiggsfield(
    Number(config.metadata.fakeHiggsfieldPort)
  )
  return () => fake.close()
}
