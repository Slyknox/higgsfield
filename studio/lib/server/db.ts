import "server-only"

import { Pool } from "pg"

import { getEnv } from "./env"

// One pool per server process. Dev hot reload re-runs modules, so keep it on globalThis.
const holder = globalThis as typeof globalThis & { __studioPool?: Pool }

export function getPool(): Pool {
  if (!holder.__studioPool) {
    holder.__studioPool = new Pool({
      connectionString: getEnv().DATABASE_URL,
      // Serverless functions each hold their own pool; keep it small for Supabase's pooler.
      max: 5,
      idleTimeoutMillis: 10_000,
    })
  }
  return holder.__studioPool
}
