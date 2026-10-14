import type { FullConfig } from "@playwright/test"
import pg from "pg"

import { migrate } from "../scripts/db-migrate.mjs"

export default async function globalSetup(config: FullConfig) {
  const url = String(config.metadata.databaseUrl)
  const client = new pg.Client({ connectionString: url })
  await client.connect()
  await client.query("drop schema public cascade; create schema public;")
  await client.end()
  await migrate(url, () => {})
}
