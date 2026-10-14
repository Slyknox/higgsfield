import { test } from "@playwright/test"
import pg from "pg"

/** A pool on the E2E database for one spec file, closed after it. */
export function openSpecDatabase(): () => pg.Pool {
  let db: pg.Pool | undefined
  test.beforeAll(({}, testInfo) => {
    db = new pg.Pool({
      connectionString: String(testInfo.config.metadata.databaseUrl),
    })
  })
  test.afterAll(async () => {
    await db?.end()
  })
  return () => {
    if (!db) throw new Error("database not ready")
    return db
  }
}

let counter = 0
/** A fresh address, so each test starts as a new user. */
export const freshEmail = (prefix: string) =>
  `${prefix}-${Date.now()}-${counter++}@example.com`
