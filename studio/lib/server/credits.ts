import "server-only"

import { ensureAccount, getBalance } from "@/lib/billing/credits"

import { getBillingConfig } from "./billing-env"
import { getPool } from "./db"

/** What the browser needs to price a generation, or null while billing is off. */
export type CreditSummary = { markup: number; balance: number } | null

export async function getCreditSummary(
  userId: number | null
): Promise<CreditSummary> {
  const billing = getBillingConfig()
  if (!billing.enabled) return null
  if (!userId) return { markup: billing.markup, balance: 0 }
  const pool = getPool()
  await ensureAccount(pool, userId, billing.signupCredits)
  return { markup: billing.markup, balance: await getBalance(pool, userId) }
}
