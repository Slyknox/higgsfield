import "server-only"

import { z } from "zod"

import { DEFAULT_CREDIT_MARKUP } from "@/lib/billing/pricing"
import type { BillingConfig } from "@/lib/generations/service"

// The billing switch. Off (the default) means generations are free and no
// credits move. On means every generation is paid for with prepaid credits.
const schema = z.object({
  BILLING_ENABLED: z
    .enum(["true", "false", "1", "0", ""])
    .default("false")
    .transform((v) => v === "true" || v === "1"),
  CREDIT_MARKUP: z.coerce
    .number()
    .min(1)
    .max(20)
    .default(DEFAULT_CREDIT_MARKUP),
  SIGNUP_CREDITS: z.coerce.number().int().min(0).max(100_000).default(0),
})

let cached: BillingConfig | undefined

export function getBillingConfig(): BillingConfig {
  if (cached) return cached
  const result = schema.safeParse(process.env)
  if (!result.success)
    throw new Error(
      `Invalid billing settings:\n${result.error.issues
        .map((i) => `  ${i.path.join(".")}: ${i.message}`)
        .join("\n")}`
    )
  cached = {
    enabled: result.data.BILLING_ENABLED,
    markup: result.data.CREDIT_MARKUP,
    signupCredits: result.data.SIGNUP_CREDITS,
  }
  return cached
}
