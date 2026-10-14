import type { ModelEntry, Surface } from "@/generation/catalog"

// Compares ids with separators folded, so `seedance_2_5` (Higgsfield-style)
// and `seedance-2.5` (catalog id) name the same model.
const fold = (id: string) => id.toLowerCase().replace(/[^a-z0-9]+/g, "_")

/**
 * Resolves a `?model=` value against the catalog. Returns the model only when
 * it exists and belongs to `surface`; anything else returns undefined so the
 * page keeps its current model instead of trusting the URL.
 */
export function resolveModelParam(
  models: readonly ModelEntry[],
  param: string | null | undefined,
  surface?: Surface
): ModelEntry | undefined {
  if (!param) return undefined
  const wanted = fold(param)
  const match =
    models.find((m) => m.id === param) ??
    models.find((m) => fold(m.id) === wanted)
  if (!match) return undefined
  if (surface && match.surface !== surface) return undefined
  return match
}
