import { NextResponse } from "next/server"

import { listGenerations } from "@/lib/generations/service"
import { getPool } from "@/lib/server/db"
import { userIdOf } from "@/lib/server/generations"
import { getSession } from "@/lib/server/session"

/** The signed-in user's generations, newest first. `?before=<ms>` pages back. */
export async function GET(request: Request) {
  const userId = userIdOf(await getSession())
  if (!userId)
    return NextResponse.json({ error: "Sign in required" }, { status: 401 })
  const params = new URL(request.url).searchParams
  const before = Number(params.get("before")) || undefined
  const limit = Number(params.get("limit")) || undefined
  const generations = await listGenerations({ db: getPool() }, userId, {
    before,
    limit,
  })
  return NextResponse.json(
    { generations },
    { headers: { "Cache-Control": "no-store" } }
  )
}
