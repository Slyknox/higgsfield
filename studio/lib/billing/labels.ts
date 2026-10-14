import type { LedgerReason } from "./credits"

/** How each ledger reason reads to the user. */
export const LEDGER_LABELS: Record<LedgerReason, string> = {
  signup: "Welcome credits",
  debit: "Generation",
  refund: "Refund",
  admin: "Adjustment",
  purchase: "Purchase",
}

export const formatCredits = (delta: number): string =>
  `${delta > 0 ? "+" : "−"}${Math.abs(delta).toLocaleString("en-US")}`
