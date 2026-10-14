"use server"

import { revalidatePath } from "next/cache"

import { adjustCredits } from "@/lib/billing/credits"
import { finalizeGeneration, reconcile } from "@/lib/generations/service"
import { UserFacingError } from "@/lib/generations/types"
import { requireAdmin } from "@/lib/server/admin"
import { getPool } from "@/lib/server/db"
import { GenerationUnavailableError } from "@/lib/server/generation-env"
import { getGenerationDeps } from "@/lib/server/generations"

export type AdminFormState = { error?: string; message?: string }

/** Adds or removes credits for one user, with a note that lands in their ledger. */
export async function grantCreditsAction(
  _prev: AdminFormState,
  formData: FormData
): Promise<AdminFormState> {
  const adminId = await requireAdmin()
  const userId = Number(formData.get("userId"))
  const delta = Number(formData.get("delta"))
  const note = String(formData.get("note") ?? "")
  if (!Number.isInteger(userId) || userId <= 0) return { error: "Unknown user." }
  try {
    const balance = await adjustCredits(getPool(), userId, delta, note, adminId)
    revalidatePath(`/admin/users/${userId}`)
    return { message: `Done. New balance: ${balance} credits.` }
  } catch (error) {
    if (error instanceof UserFacingError) return { error: error.message }
    // A foreign-key failure means the user was deleted meanwhile.
    return { error: "Couldn't update credits. Reload and try again." }
  }
}

async function withGenerationDeps<T>(
  work: (deps: ReturnType<typeof getGenerationDeps>) => Promise<T>
): Promise<{ ok: true; value: T } | { ok: false; error: string }> {
  try {
    return { ok: true, value: await work(getGenerationDeps()) }
  } catch (error) {
    if (error instanceof GenerationUnavailableError) {
      console.error(error.message)
      return { ok: false, error: "Generation isn't configured." }
    }
    console.error(
      "[admin] action failed",
      error instanceof Error ? error.name : typeof error
    )
    return { ok: false, error: "Couldn't reach the generator." }
  }
}

/** Asks Higgsfield for one generation's status now, instead of waiting for the webhook. */
export async function refreshGenerationAction(
  _prev: AdminFormState,
  formData: FormData
): Promise<AdminFormState> {
  await requireAdmin()
  const id = String(formData.get("id") ?? "")
  if (!/^[0-9a-f-]{36}$/i.test(id)) return { error: "Generation not found." }
  const result = await withGenerationDeps((deps) =>
    finalizeGeneration(deps, id)
  )
  revalidatePath("/admin/generations")
  if (!result.ok) return { error: result.error }
  return result.value
    ? { message: `Now ${result.value.status.replace("_", " ")}.` }
    : { error: "Generation not found." }
}

/** Runs the reconciler now: refreshes stale runs, times out old ones, retries refunds. */
export async function reconcileNowAction(): Promise<AdminFormState> {
  await requireAdmin()
  const result = await withGenerationDeps((deps) =>
    reconcile(deps, { limit: 50 })
  )
  revalidatePath("/admin")
  revalidatePath("/admin/generations")
  if (!result.ok) return { error: result.error }
  return {
    message: `Refreshed ${result.value.refreshed}, timed out ${result.value.timedOut}.`,
  }
}
