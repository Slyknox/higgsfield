import { after, NextResponse } from "next/server"

import { finalizeGeneration } from "@/lib/generations/service"
import { verifyWebhookToken } from "@/lib/generations/webhook-token"
import { getGenerationEnv } from "@/lib/server/generation-env"
import { getGenerationDeps } from "@/lib/server/generations"

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Higgsfield calls this when a request reaches a terminal status. The payload
 * is never trusted: the token proves the URL is ours, and finalize re-fetches
 * the status from Higgsfield. Replies at once; the R2 copy runs after.
 */
export async function POST(request: Request) {
  const params = new URL(request.url).searchParams
  const gid = params.get("gid") ?? ""
  const secret = getGenerationEnv().HF_WEBHOOK_SECRET
  if (
    !secret ||
    !UUID.test(gid) ||
    !verifyWebhookToken(secret, gid, params.get("t"))
  )
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  let requestId = ""
  let status = ""
  try {
    const body = (await request.json()) as {
      request_id?: unknown
      status?: unknown
    }
    requestId = typeof body.request_id === "string" ? body.request_id : ""
    status = typeof body.status === "string" ? body.status : ""
  } catch {
    // A body we can't read still triggers a refresh below.
  }

  const deps = getGenerationDeps()
  const row = await deps.db.query<{ hf_request_id: string | null }>(
    "select hf_request_id from generations where id = $1",
    [gid]
  )
  if (!row.rows[0]) return NextResponse.json({ ok: true })
  if (
    requestId &&
    row.rows[0].hf_request_id &&
    requestId !== row.rows[0].hf_request_id
  )
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  if (requestId && status) {
    const fresh = await deps.db.query(
      "insert into hf_webhook_events (request_id, status) values ($1, $2) on conflict do nothing",
      [requestId, status]
    )
    if (fresh.rowCount === 0)
      return NextResponse.json({ ok: true, duplicate: true })
  }

  after(async () => {
    try {
      await finalizeGeneration(deps, gid)
    } catch (error) {
      console.error("[webhook] finalize failed", {
        gid,
        reason: String(error).slice(0, 200),
      })
    }
  })
  return NextResponse.json({ ok: true })
}
