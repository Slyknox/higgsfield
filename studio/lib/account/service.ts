import type { Pool } from "pg"

import type { GenerationDeps } from "@/lib/generations/service"
import { IN_FLIGHT_STATUSES } from "@/lib/generations/types"

// Account-level reads and the account deletion that removes everything a user owns.

export type AccountSummary = {
  email: string
  memberSince: number
  generations: { total: number; completed: number; thisMonth: number }
  projects: number
  uploads: number
}

export async function getAccountSummary(
  db: Pool,
  userId: number
): Promise<AccountSummary | null> {
  const { rows } = await db.query<{
    email: string
    created_at: Date
    total: number
    completed: number
    this_month: number
    projects: number
    uploads: number
  }>(
    `select u.email, u.created_at,
       (select count(*)::int from generations g where g.user_id = u.id) as total,
       (select count(*)::int from generations g where g.user_id = u.id and g.status = 'completed') as completed,
       (select count(*)::int from generations g where g.user_id = u.id
          and g.created_at >= date_trunc('month', now())) as this_month,
       (select count(*)::int from projects p where p.user_id = u.id) as projects,
       (select count(*)::int from uploads x where x.user_id = u.id and x.confirmed_at is not null) as uploads
     from users u where u.id = $1`,
    [userId]
  )
  const r = rows[0]
  if (!r) return null
  return {
    email: r.email,
    memberSince: r.created_at.getTime(),
    generations: {
      total: r.total,
      completed: r.completed,
      thisMonth: r.this_month,
    },
    projects: r.projects,
    uploads: r.uploads,
  }
}

/**
 * Deletes the user and everything they own: running generations are canceled
 * on Higgsfield, rows go by cascade, then stored files are removed. Reference
 * files live in Higgsfield's storage, which has no delete API.
 */
export async function deleteAccount(
  deps: Pick<GenerationDeps, "db" | "platform" | "storage" | "log">,
  userId: number
): Promise<{ filesRemoved: number }> {
  const running = await deps.db.query<{ hf_request_id: string }>(
    `select hf_request_id from generations
     where user_id = $1 and status = any($2) and hf_request_id is not null`,
    [userId, IN_FLIGHT_STATUSES]
  )
  await Promise.allSettled(
    running.rows.map((r) => deps.platform.cancel(r.hf_request_id))
  )
  const files = await deps.db.query<{ key: string }>(
    `select o->>'key' as key from generations g, jsonb_array_elements(g.outputs) o
     where g.user_id = $1 and o ? 'key'`,
    [userId]
  )
  await deps.db.query("delete from users where id = $1", [userId])
  const keys = files.rows.map((r) => r.key).filter(Boolean)
  if (keys.length)
    await deps.storage.remove(keys).catch((error: unknown) => {
      deps.log?.("[account] storage cleanup failed", {
        userId,
        files: keys.length,
        reason: String(error).slice(0, 200),
      })
    })
  return { filesRemoved: keys.length }
}
