import { z } from "zod"

// Sign-in rules that need no server or database, kept pure so they're tested directly.

export const EMAIL = z
  .string()
  .trim()
  .toLowerCase()
  .max(254)
  .pipe(z.email({ message: "Enter a valid email address." }))

/** Normalised email, or null when it isn't a valid address. */
export function parseEmail(raw: unknown): string | null {
  const result = EMAIL.safeParse(raw)
  return result.success ? result.data : null
}

/**
 * Where to send the user after sign-in. Only same-site paths are allowed, so a
 * crafted link can't bounce a fresh session to another site.
 */
export function safeCallbackUrl(raw: unknown, fallback = "/"): string {
  if (typeof raw !== "string") return fallback
  const value = raw.trim()
  if (
    !value.startsWith("/") ||
    value.startsWith("//") ||
    value.startsWith("/\\")
  )
    return fallback
  if (/[\u0000-\u001f]/.test(value)) return fallback
  try {
    const parsed = new URL(value, "http://local.invalid")
    if (parsed.origin !== "http://local.invalid") return fallback
    return `${parsed.pathname}${parsed.search}${parsed.hash}`
  } catch {
    return fallback
  }
}

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]"])

/** The outbox transport writes magic links to the database: local use only. */
export function outboxAllowed(authUrl: string | undefined): boolean {
  if (!authUrl) return false
  try {
    return LOCAL_HOSTS.has(new URL(authUrl).hostname)
  } catch {
    return false
  }
}

/**
 * Whether Auth.js's `signIn(..., { redirect: false })` result means the email
 * was not sent. It returns a URL; failures carry an `error` query parameter.
 */
export function sendFailed(result: unknown): boolean {
  if (typeof result !== "string" || !result) return true
  try {
    return new URL(result, "http://local.invalid").searchParams.has("error")
  } catch {
    return true
  }
}

/** How long a magic link works. */
export const MAGIC_LINK_MINUTES = 15

export const MAGIC_LINK_LIMITS = {
  /** Emails one address can receive per hour. */
  perEmail: { limit: 5, windowSeconds: 3600 },
  /** Sign-in requests one IP can make per hour. */
  perIp: { limit: 20, windowSeconds: 3600 },
} as const
