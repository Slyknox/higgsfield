import "server-only"

import { NextResponse } from "next/server"

import { UserFacingError } from "@/lib/generations/types"

import { userIdOf } from "./generations"
import { getSession } from "./session"

const NO_STORE = { "Cache-Control": "no-store" }

export function json(body: unknown, status = 200): NextResponse {
  return NextResponse.json(body, { status, headers: NO_STORE })
}

/** Refuses state-changing requests sent from another site. */
export function crossOrigin(request: Request): boolean {
  const origin = request.headers.get("origin")
  return origin != null && origin !== new URL(request.url).origin
}

const STATUS: Record<UserFacingError["code"], number> = {
  invalid_input: 400,
  too_many_running: 429,
  not_found: 404,
  cannot_cancel: 409,
  unavailable: 503,
  insufficient_credits: 402,
}

/**
 * Runs a route handler for the signed-in user. Mutations from other origins,
 * missing sessions and user-facing errors become plain JSON errors.
 */
export async function withUser(
  request: Request,
  work: (userId: number) => Promise<NextResponse>
): Promise<NextResponse> {
  if (request.method !== "GET" && crossOrigin(request))
    return json({ error: "Cross-origin requests are not allowed." }, 403)
  const userId = userIdOf(await getSession())
  if (!userId) return json({ error: "Sign in required" }, 401)
  try {
    return await work(userId)
  } catch (error) {
    if (error instanceof UserFacingError)
      return json({ error: error.message }, STATUS[error.code])
    console.error(
      "[api] request failed",
      new URL(request.url).pathname,
      error instanceof Error ? error.name : typeof error
    )
    return json({ error: "Something went wrong. Try again." }, 500)
  }
}

/** The JSON body as an object, or an empty one when it isn't. */
export async function readObject(
  request: Request
): Promise<Record<string, unknown>> {
  try {
    const body: unknown = await request.json()
    return body && typeof body === "object" && !Array.isArray(body)
      ? (body as Record<string, unknown>)
      : {}
  } catch {
    throw new UserFacingError("invalid_input", "Invalid request body.")
  }
}
