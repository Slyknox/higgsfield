"use server"

import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { AuthError } from "next-auth"

import { signIn, signOut } from "@/auth"
import {
  MAGIC_LINK_LIMITS,
  parseEmail,
  safeCallbackUrl,
  sendFailed,
} from "@/lib/auth/policy"
import { hitRateLimit } from "@/lib/auth/rate-limit"
import { getPool } from "@/lib/server/db"

export type LoginState = { error?: string; email?: string }

async function clientIp(): Promise<string> {
  const h = await headers()
  return (
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    h.get("x-real-ip") ||
    "unknown"
  )
}

/** Sends a magic link, then redirects to the check-email page. */
export async function requestMagicLink(
  _prev: LoginState,
  formData: FormData
): Promise<LoginState> {
  const raw = formData.get("email")
  const email = parseEmail(raw)
  if (!email)
    return {
      error: "Enter a valid email address.",
      email: typeof raw === "string" ? raw : "",
    }

  const { perIp } = MAGIC_LINK_LIMITS
  const hit = await hitRateLimit(
    getPool(),
    `magic-link:ip:${await clientIp()}`,
    perIp.limit,
    perIp.windowSeconds
  )
  if (!hit.allowed)
    return {
      error:
        "Too many sign-in requests from this network. Try again in an hour.",
      email,
    }

  const failed = {
    error: "We couldn't send the sign-in email. Try again in a few minutes.",
    email,
  }
  let next: unknown
  try {
    // redirect: false returns the URL Auth.js would go to, so the check-email page gets a clean URL.
    next = await signIn("resend", {
      email,
      redirectTo: safeCallbackUrl(formData.get("callbackUrl")),
      redirect: false,
    })
  } catch (error) {
    if (error instanceof AuthError) return failed
    throw error
  }
  // With redirect: false a failed send comes back as an ?error= URL instead of an exception.
  if (sendFailed(next)) return failed
  redirect("/login/check-email")
}

export async function signOutAction(): Promise<void> {
  await signOut({ redirectTo: "/" })
}
