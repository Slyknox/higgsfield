// Applies db/migrations/*.sql in name order, once each, inside a transaction.
// Usage: DATABASE_URL=... node scripts/db-migrate.mjs
import { readdirSync, readFileSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

import pg from "pg"

const DIR = join(resolve(dirname(fileURLToPath(import.meta.url)), ".."), "db/migrations")

export async function migrate(connectionString, log = console.log) {
  const client = new pg.Client({ connectionString })
  await client.connect()
  try {
    await client.query(
      "create table if not exists schema_migrations (name text primary key, applied_at timestamptz not null default now())"
    )
    await client.query("alter table schema_migrations enable row level security")
    const done = new Set((await client.query("select name from schema_migrations")).rows.map((r) => r.name))
    const files = readdirSync(DIR).filter((f) => f.endsWith(".sql")).sort()
    for (const file of files) {
      if (done.has(file)) continue
      await client.query("begin")
      try {
        await client.query(readFileSync(join(DIR, file), "utf8"))
        await client.query("insert into schema_migrations (name) values ($1)", [file])
        await client.query("commit")
        log(`[db] applied ${file}`)
      } catch (error) {
        await client.query("rollback")
        throw new Error(`[db] ${file} failed: ${error.message}`)
      }
    }
  } finally {
    await client.end()
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const url = process.env.DATABASE_URL
  if (!url) {
    console.error("[db] DATABASE_URL is not set")
    process.exit(1)
  }
  migrate(url).catch((error) => {
    console.error(error.message)
    process.exit(1)
  })
}
