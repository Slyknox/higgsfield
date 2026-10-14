import type { ModelEntry } from "@/generation/catalog"

// Credit prices. Pure, so the server charges and the Generate button shows the
// same number. 1 credit = $0.01 retail.

/**
 * Higgsfield list prices in USD per second of video, observed in the console
 * on 2026-10-14 (docs/ui-inventory.md). List, not promotional, prices.
 */
const VIDEO_USD_PER_SECOND: { prefix: string; usd: number }[] = [
  { prefix: "seedance-2.5", usd: 0.206 },
  { prefix: "kling-3", usd: 0.084 },
  { prefix: "minimax-h3", usd: 0.13 },
]

/**
 * Prices for models we haven't observed yet. Deliberately high, so an
 * unverified model can't be sold below cost. Replace with list prices.
 */
export const FALLBACK_VIDEO_USD_PER_SECOND = 0.35
export const FALLBACK_IMAGE_USD = 0.1

export const DEFAULT_CREDIT_MARKUP = 2

export type Price = {
  credits: number
  /** Higgsfield's cost in USD, before markup. */
  usd: number
  /** True when no observed list price exists for this model. */
  estimated: boolean
}

function seconds(model: ModelEntry, settings: Record<string, unknown>): number {
  const raw = Number(settings.duration)
  if (Number.isFinite(raw) && raw > 0) return raw
  const field = model.settings.duration
  if (field?.type === "range") return field.default
  return 5
}

/** What one generation with these settings costs. */
export function priceOf(
  model: ModelEntry,
  settings: Record<string, unknown>,
  markup: number = DEFAULT_CREDIT_MARKUP
): Price {
  let usd: number
  let estimated = false
  if (model.surface === "video") {
    const known = VIDEO_USD_PER_SECOND.find((p) => model.id.startsWith(p.prefix))
    estimated = !known
    usd = (known?.usd ?? FALLBACK_VIDEO_USD_PER_SECOND) * seconds(model, settings)
  } else {
    estimated = true
    usd = FALLBACK_IMAGE_USD
  }
  const safeMarkup = Number.isFinite(markup) && markup >= 1 ? markup : 1
  // Round up so rounding never sells below cost.
  const credits = Math.max(1, Math.ceil(usd * safeMarkup * 100 - 1e-9))
  return { credits, usd, estimated }
}
