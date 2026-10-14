import { timingSafeEqual } from "node:crypto"

import { NextResponse } from "next/server"

import { reconcile } from "@/lib/generations/service"
import { getGenerationDeps } from "@/lib/server/generations"

function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret || secret.length < 16) return false
  const header = Buffer.from(request.headers.get("authorization") ?? "")
  const expected = Buffer.from(`Bearer ${secret}`)
  return header.length === expected.length && timingSafeEqual(header, expected)
}

/** Vercel Cron: finishes or fails generations whose webhook never arrived. */
export async function GET(request: Request) {
  if (!authorized(request))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  const result = await reconcile(getGenerationDeps(), {
    staleSeconds: 60,
    limit: 50,
  })
  return NextResponse.json(result)
}
