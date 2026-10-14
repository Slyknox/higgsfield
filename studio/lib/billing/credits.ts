import type { Pool, PoolClient } from "pg"

import { UserFacingError } from "@/lib/generations/types"

// Credit balance and ledger. Every change to a balance writes a ledger row in
// the same statement or transaction, so the two always agree.

type Queryable = Pool | PoolClient

export type LedgerReason = "signup" | "debit" | "refund" | "admin" | "purchase"

export type LedgerEntry = {
  id: string
  delta: number
  reason: LedgerReason
  generationId: string | null
  note: string | null
  createdAt: number
}

/** Creates the user's balance on first use, with any sign-up credits. Idempotent. */
export async function ensureAccount(
  db: Queryable,
  userId: number,
  signupCredits = 0
): Promise<void> {
  const credits = Math.max(0, Math.floor(signupCredits))
  await db.query(
    `with b as (
       insert into credit_balances (user_id, balance) values ($1, $2)
       on conflict (user_id) do nothing returning user_id, balance
     )
     insert into credit_ledger (user_id, delta, reason, note)
     select user_id, balance, 'signup', 'Sign-up credits' from b where balance > 0`,
    [userId, credits]
  )
}

export async function getBalance(db: Queryable, userId: number): Promise<number> {
  const { rows } = await db.query<{ balance: number }>(
    "select balance from credit_balances where user_id = $1",
    [userId]
  )
  return rows[0]?.balance ?? 0
}

/**
 * Spends `cost` credits on a generation. Call inside the transaction that
 * inserts the generation, so a refused debit leaves no row behind.
 */
export async function debitForGeneration(
  client: PoolClient,
  userId: number,
  generationId: string,
  cost: number
): Promise<void> {
  if (cost <= 0) return
  const spent = await client.query(
    `update credit_balances set balance = balance - $2, updated_at = now()
     where user_id = $1 and balance >= $2`,
    [userId, cost]
  )
  if (spent.rowCount !== 1) {
    const balance = await getBalance(client, userId)
    throw new UserFacingError(
      "insufficient_credits",
      `This costs ${cost} credits and you have ${balance}.`
    )
  }
  await client.query(
    `insert into credit_ledger (user_id, delta, reason, generation_id)
     values ($1, $2, 'debit', $3)`,
    [userId, -cost, generationId]
  )
}

/**
 * Returns a generation's cost when it ended without a result (failed, blocked
 * or canceled). One statement, and the ledger's unique index makes it
 * idempotent: the webhook, reconciler and status route can all call it.
 */
export async function refundGeneration(
  db: Queryable,
  generationId: string
): Promise<number> {
  const { rows } = await db.query<{ delta: number }>(
    `with r as (
       insert into credit_ledger (user_id, delta, reason, generation_id)
       select user_id, cost, 'refund', id from generations
       where id = $1 and cost > 0 and status in ('failed', 'nsfw', 'canceled')
       on conflict (generation_id, reason) where generation_id is not null do nothing
       returning user_id, delta
     ), b as (
       update credit_balances c set balance = c.balance + r.delta, updated_at = now()
       from r where c.user_id = r.user_id
       returning r.delta
     )
     select delta from b`,
    [generationId]
  )
  return rows[0]?.delta ?? 0
}

/** An admin grant (positive) or correction (negative). Never takes a balance below zero. */
export async function adjustCredits(
  db: Pool,
  userId: number,
  delta: number,
  note: string,
  actorId: number
): Promise<number> {
  if (!Number.isInteger(delta) || delta === 0 || Math.abs(delta) > 1_000_000)
    throw new UserFacingError(
      "invalid_input",
      "Enter a whole number of credits, not zero."
    )
  const reason = note.trim().slice(0, 200)
  if (!reason)
    throw new UserFacingError("invalid_input", "Add a note saying why.")
  const client = await db.connect()
  try {
    await client.query("begin")
    await client.query(
      "insert into credit_balances (user_id) values ($1) on conflict do nothing",
      [userId]
    )
    const updated = await client.query<{ balance: number }>(
      `update credit_balances set balance = balance + $2, updated_at = now()
       where user_id = $1 and balance + $2 >= 0 returning balance`,
      [userId, delta]
    )
    if (!updated.rows[0])
      throw new UserFacingError(
        "invalid_input",
        "That would take the balance below zero."
      )
    await client.query(
      `insert into credit_ledger (user_id, delta, reason, note, actor_id)
       values ($1, $2, 'admin', $3, $4)`,
      [userId, delta, reason, actorId]
    )
    await client.query("commit")
    return updated.rows[0].balance
  } catch (error) {
    await client.query("rollback")
    throw error
  } finally {
    client.release()
  }
}

export async function listLedger(
  db: Queryable,
  userId: number,
  limit = 50
): Promise<LedgerEntry[]> {
  const { rows } = await db.query<{
    id: string
    delta: number
    reason: LedgerReason
    generation_id: string | null
    note: string | null
    created_at: Date
  }>(
    `select id, delta, reason, generation_id, note, created_at from credit_ledger
     where user_id = $1 order by created_at desc, id desc limit $2`,
    [userId, Math.min(Math.max(limit, 1), 200)]
  )
  return rows.map((r) => ({
    id: String(r.id),
    delta: r.delta,
    reason: r.reason,
    generationId: r.generation_id,
    note: r.note,
    createdAt: r.created_at.getTime(),
  }))
}
