"use server"

import { redirect } from "next/navigation"

import { signOut } from "@/auth"
import { deleteAccount } from "@/lib/account/service"
import { GenerationUnavailableError } from "@/lib/server/generation-env"
import { getGenerationDeps, userIdOf } from "@/lib/server/generations"
import { getSession } from "@/lib/server/session"

export type DeleteState = { error?: string }

/** Deletes the signed-in account after the user types their email to confirm. */
export async function deleteAccountAction(
  _prev: DeleteState,
  formData: FormData
): Promise<DeleteState> {
  const session = await getSession()
  const userId = userIdOf(session)
  if (!userId) redirect("/login?callbackUrl=/account")
  const typed = String(formData.get("confirm") ?? "").trim().toLowerCase()
  if (!session?.user?.email || typed !== session.user.email.toLowerCase())
    return { error: "Type your email address exactly to confirm." }

  let deps
  try {
    deps = getGenerationDeps()
  } catch (error) {
    // Without storage settings we can't remove the files, so we don't half-delete.
    if (error instanceof GenerationUnavailableError) {
      console.error(error.message)
      return {
        error:
          "Account deletion is temporarily unavailable. Try again later or contact support.",
      }
    }
    throw error
  }
  await deleteAccount(deps, userId)
  await signOut({ redirectTo: "/" })
  return {}
}
