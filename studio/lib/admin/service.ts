import type { Pool } from "pg"

import type { GenerationStatus } from "@/lib/generations/types"
import { IN_FLIGHT_STATUSES } from "@/lib/generations/types"

// Read-only queries for the admin panel. Mutations reuse the credit and
// generation services so admins can't bypass their rules.

export type AdminOverview = {
  users: number
  newUsers7d: number
  generations24h: number
  failed24h: number
  inFlight: number
  stuck: number
  creditsOutstanding: number
}

/** In-flight generations older than this are shown as stuck. */
export const STUCK_MINUTES = 10

export async function getOverview(db: Pool): Promise<AdminOverview> {
  const { rows } = await db.query<AdminOverview>(
    `select
       (select count(*)::int from users) as "users",
       (select count(*)::int from users where created_at > now() - interval '7 days') as "newUsers7d",
       (select count(*)::int from generations where created_at > now() - interval '1 day') as "generations24h",
       (select count(*)::int from generations where created_at > now() - interval '1 day'
          and status in ('failed', 'nsfw')) as "failed24h",
       (select count(*)::int from generations where status = any($1)) as "inFlight",
       (select count(*)::int from generations where status = any($1)
          and created_at < now() - make_interval(mins => $2)) as "stuck",
       (select coalesce(sum(balance), 0)::int from credit_balances) as "creditsOutstanding"`,
    [IN_FLIGHT_STATUSES, STUCK_MINUTES]
  )
  return rows[0]!
}

export type AdminUserRow = {
  id: number
  email: string
  role: "user" | "admin"
  createdAt: number
  balance: number
  generations: number
}

/** Users, newest first, optionally filtered by part of their email. */
export async function listUsers(
  db: Pool,
  options: { query?: string; limit?: number; offset?: number } = {}
): Promise<AdminUserRow[]> {
  const query = (options.query ?? "").trim().toLowerCase().slice(0, 254)
  const { rows } = await db.query<{
    id: number
    email: string
    role: "user" | "admin"
    created_at: Date
    balance: number
    generations: number
  }>(
    `select u.id, u.email, u.role, u.created_at,
       coalesce(b.balance, 0) as balance,
       (select count(*)::int from generations g where g.user_id = u.id) as generations
     from users u left join credit_balances b on b.user_id = u.id
     where ($1 = '' or strpos(lower(u.email), $1) > 0)
     order by u.created_at desc, u.id desc
     limit $2 offset $3`,
    [
      query,
      Math.min(Math.max(options.limit ?? 50, 1), 200),
      Math.max(options.offset ?? 0, 0),
    ]
  )
  return rows.map((r) => ({
    id: r.id,
    email: r.email,
    role: r.role,
    createdAt: r.created_at.getTime(),
    balance: r.balance,
    generations: r.generations,
  }))
}

export async function getUser(
  db: Pool,
  id: number
): Promise<AdminUserRow | null> {
  if (!Number.isInteger(id) || id <= 0) return null
  const { rows } = await db.query<{
    id: number
    email: string
    role: "user" | "admin"
    created_at: Date
    balance: number
    generations: number
  }>(
    `select u.id, u.email, u.role, u.created_at, coalesce(b.balance, 0) as balance,
       (select count(*)::int from generations g where g.user_id = u.id) as generations
     from users u left join credit_balances b on b.user_id = u.id where u.id = $1`,
    [id]
  )
  const r = rows[0]
  return r
    ? {
        id: r.id,
        email: r.email,
        role: r.role,
        createdAt: r.created_at.getTime(),
        balance: r.balance,
        generations: r.generations,
      }
    : null
}

export type AdminGenerationRow = {
  id: string
  userId: number
  email: string
  modelId: string
  status: GenerationStatus
  cost: number
  prompt: string
  error: string | null
  createdAt: number
  outputUrl: string | null
}

const STATUSES: readonly GenerationStatus[] = [
  "pending_submit",
  "queued",
  "in_progress",
  "completed",
  "failed",
  "nsfw",
  "canceled",
]

export const isGenerationStatus = (v: unknown): v is GenerationStatus =>
  typeof v === "string" && (STATUSES as readonly string[]).includes(v)

/** Recent generations across users. `stuck` limits to in-flight ones past STUCK_MINUTES. */
export async function listGenerations(
  db: Pool,
  options: {
    status?: GenerationStatus
    stuck?: boolean
    userId?: number
    limit?: number
  } = {}
): Promise<AdminGenerationRow[]> {
  const { rows } = await db.query<{
    id: string
    user_id: number
    email: string
    model_id: string
    status: GenerationStatus
    cost: number
    prompt: string
    error: string | null
    created_at: Date
    output_url: string | null
  }>(
    `select g.id, g.user_id, u.email, g.model_id, g.status, g.cost, g.prompt, g.error, g.created_at,
       g.outputs->0->>'url' as output_url
     from generations g join users u on u.id = g.user_id
     where ($1::text is null or g.status = $1)
       and ($2::boolean is not true or (g.status = any($3)
            and g.created_at < now() - make_interval(mins => $4)))
       and ($5::int is null or g.user_id = $5)
     order by g.created_at desc limit $6`,
    [
      options.status ?? null,
      options.stuck ?? false,
      IN_FLIGHT_STATUSES,
      STUCK_MINUTES,
      options.userId ?? null,
      Math.min(Math.max(options.limit ?? 50, 1), 200),
    ]
  )
  return rows.map((r) => ({
    id: r.id,
    userId: r.user_id,
    email: r.email,
    modelId: r.model_id,
    status: r.status,
    cost: r.cost,
    prompt: r.prompt,
    error: r.error,
    createdAt: r.created_at.getTime(),
    outputUrl: r.output_url,
  }))
}
