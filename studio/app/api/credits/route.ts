import { NextResponse } from "next/server"

import { getCreditSummary } from "@/lib/server/credits"
import { userIdOf } from "@/lib/server/generations"
import { getSession } from "@/lib/server/session"

/** The signed-in user's credit balance; `{ credits: null }` while billing is off. */
export async function GET() {
  const userId = userIdOf(await getSession())
  if (!userId)
    return NextResponse.json({ error: "Sign in required" }, { status: 401 })
  return NextResponse.json(
    { credits: await getCreditSummary(userId) },
    { headers: { "Cache-Control": "no-store" } }
  )
}
