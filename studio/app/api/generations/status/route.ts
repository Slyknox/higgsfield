import { NextResponse } from "next/server"

import { getGenerations, reconcile } from "@/lib/generations/service"
import { getPool } from "@/lib/server/db"
import { GenerationUnavailableError } from "@/lib/server/generation-env"
import { getGenerationDeps, userIdOf } from "@/lib/server/generations"
import { getSession } from "@/lib/server/session"

/**
 * Status of the caller's generations by id (`?ids=a,b`). The browser polls this
 * route, never Higgsfield. It also refreshes the caller's own stale in-flight
 * rows, so results arrive even where no webhook or cron can reach the app.
 */
export async function GET(request: Request) {
  const userId = userIdOf(await getSession())
  if (!userId)
    return NextResponse.json({ error: "Sign in required" }, { status: 401 })
  const ids = (new URL(request.url).searchParams.get("ids") ?? "")
    .split(",")
    .filter(Boolean)
  try {
    await reconcile(getGenerationDeps(), { userId, staleSeconds: 3, limit: 8 })
  } catch (error) {
    if (!(error instanceof GenerationUnavailableError)) throw error
  }
  const generations = await getGenerations({ db: getPool() }, userId, ids)
  return NextResponse.json(
    { generations },
    { headers: { "Cache-Control": "no-store" } }
  )
}
