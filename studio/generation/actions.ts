"use server"

import type { GenerationPlane } from "./catalog/types"
import {
  cancelGeneration as cancelInService,
  createGeneration,
  deleteGeneration as deleteInService,
} from "@/lib/generations/service"
import { UserFacingError, type GenerationDTO } from "@/lib/generations/types"
import { GenerationUnavailableError } from "@/lib/server/generation-env"
import { getGenerationDeps, userIdOf } from "@/lib/server/generations"
import { getSession } from "@/lib/server/session"

// Every action checks the session itself; ownership is enforced in the service
// queries (user_id in every WHERE), so another user's id simply isn't found.

export type ActionResult<T> =
  { ok: true; value: T } | { ok: false; error: string; signIn?: boolean }

async function run<T>(
  work: (userId: number) => Promise<T>
): Promise<ActionResult<T>> {
  const userId = userIdOf(await getSession())
  if (!userId) return { ok: false, error: "Sign in to generate.", signIn: true }
  try {
    return { ok: true, value: await work(userId) }
  } catch (error) {
    if (error instanceof UserFacingError)
      return { ok: false, error: error.message }
    if (error instanceof GenerationUnavailableError) {
      console.error(error.message)
      return { ok: false, error: "Generation is temporarily unavailable." }
    }
    console.error(
      "[generations] action failed",
      error instanceof Error ? error.name : typeof error
    )
    return { ok: false, error: "Something went wrong. Try again." }
  }
}

export async function submitGeneration(
  plane: GenerationPlane,
  projectId?: string
): Promise<ActionResult<GenerationDTO>> {
  const project =
    typeof projectId === "string" && projectId.length <= 64
      ? projectId
      : undefined
  return run((userId) =>
    createGeneration(getGenerationDeps(), userId, plane, project)
  )
}

export async function cancelGeneration(
  id: string
): Promise<ActionResult<GenerationDTO>> {
  return run((userId) =>
    cancelInService(getGenerationDeps(), userId, String(id))
  )
}

export async function deleteGeneration(
  id: string
): Promise<ActionResult<null>> {
  return run(async (userId) => {
    await deleteInService(getGenerationDeps(), userId, String(id))
    return null
  })
}
