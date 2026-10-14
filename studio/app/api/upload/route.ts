import { NextResponse } from "next/server"

import { createPlatformClient, PlatformError } from "@/generation/platform"
import { requireUploadContentType } from "@/generation/upload-contract"
import { hitRateLimit } from "@/lib/auth/rate-limit"
import { getPool } from "@/lib/server/db"
import {
  GenerationUnavailableError,
  getGenerationEnv,
} from "@/lib/server/generation-env"
import { userIdOf } from "@/lib/server/generations"
import { getSession } from "@/lib/server/session"

/** Reference uploads one user can start per hour. */
const UPLOADS_PER_HOUR = 60

export async function POST(request: Request): Promise<NextResponse> {
  const origin = request.headers.get("origin")
  if (origin && origin !== new URL(request.url).origin)
    return failure(403, "Cross-origin upload requests are not allowed.")

  let contentType: string
  try {
    const body: unknown = await request.json()
    contentType = requireUploadContentType(
      body && typeof body === "object" && "contentType" in body
        ? body.contentType
        : null
    )
  } catch (error) {
    return failure(
      400,
      error instanceof SyntaxError
        ? "Invalid upload request."
        : "Unsupported file type. Use JPEG, PNG, WebP, GIF, MP4, or WAV."
    )
  }

  const userId = userIdOf(await getSession())
  if (!userId) return failure(401, "Sign in to upload references.")

  let env: ReturnType<typeof getGenerationEnv>
  try {
    env = getGenerationEnv()
  } catch (error) {
    if (error instanceof GenerationUnavailableError) {
      console.error(error.message)
      return failure(503, "Uploads are temporarily unavailable.")
    }
    throw error
  }

  const limit = await hitRateLimit(
    getPool(),
    `upload:user:${userId}`,
    UPLOADS_PER_HOUR,
    3600
  )
  if (!limit.allowed)
    return failure(
      429,
      "You've reached the hourly upload limit. Try again later."
    )

  try {
    const ticket = await createPlatformClient({
      apiKey: env.HF_API_KEY,
      baseUrl: env.HF_API_BASE_URL,
    }).createUpload(contentType)
    // Ownership record; the signed upload URL itself is never stored or logged.
    await getPool().query(
      "insert into uploads (user_id, public_url, content_type) values ($1, $2, $3)",
      [userId, ticket.public_url, contentType]
    )
    return NextResponse.json(ticket, {
      headers: { "Cache-Control": "no-store" },
    })
  } catch (error) {
    const status = error instanceof PlatformError ? error.status : 502
    console.error("[upload] Could not prepare reference upload", { status })
    if (status === 401 || status === 403)
      return failure(503, "Uploads are temporarily unavailable.")
    if (status === 429)
      return failure(
        429,
        "Higgsfield upload rate limit reached. Wait a moment and try again."
      )
    return failure(
      502,
      "Could not prepare reference upload with Higgsfield. Try again."
    )
  }
}

function failure(status: number, error: string): NextResponse {
  return NextResponse.json(
    { error },
    { status, headers: { "Cache-Control": "no-store" } }
  )
}
