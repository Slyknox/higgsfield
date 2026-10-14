// Content Security Policy and other security headers, built from the
// environment at build time (next.config.ts). Pure, so it's tested directly.

export type HeaderOptions = {
  /** Public base URL of our media bucket (R2_PUBLIC_BASE_URL). */
  mediaBaseUrl?: string
  /**
   * Origins of Higgsfield's upload storage (CSP_UPLOAD_ORIGINS, comma
   * separated): the browser PUTs reference files there and previews them.
   * Unset allows any https origin for those two uses, until the hosts are known.
   */
  uploadOrigins?: string
  dev?: boolean
}

function origin(value: string | undefined): string | null {
  if (!value) return null
  try {
    const url = new URL(value.trim())
    return url.protocol === "https:" || url.protocol === "http:"
      ? url.origin
      : null
  } catch {
    return null
  }
}

export function contentSecurityPolicy(options: HeaderOptions): string {
  const media = origin(options.mediaBaseUrl)
  const uploads = (options.uploadOrigins ?? "")
    .split(",")
    .map((o) => origin(o))
    .filter((o): o is string => o !== null)
  const uploadSources = uploads.length ? uploads : ["https:"]
  const list = (...sources: (string | null | undefined)[]) =>
    [...new Set(sources.filter(Boolean))].join(" ")

  const directives: Record<string, string> = {
    "default-src": "'self'",
    // Next.js injects inline bootstrap scripts; a nonce-based policy needs
    // every page rendered dynamically. 'unsafe-eval' only for dev tooling.
    "script-src": list(
      "'self'",
      "'unsafe-inline'",
      options.dev ? "'unsafe-eval'" : null
    ),
    "style-src": "'self' 'unsafe-inline'",
    "img-src": list("'self'", "data:", "blob:", media, ...uploadSources),
    "media-src": list("'self'", "blob:", media, ...uploadSources),
    "connect-src": list("'self'", ...uploadSources, options.dev ? "ws:" : null),
    "font-src": "'self' data:",
    "frame-src": "'none'",
    "frame-ancestors": "'none'",
    "object-src": "'none'",
    "base-uri": "'self'",
    "form-action": "'self'",
    "worker-src": "'self' blob:",
  }
  // No upgrade-insecure-requests: it would break E2E runs on http://localhost.
  // HSTS keeps production on https instead (browsers ignore it over http).
  return Object.entries(directives)
    .map(([k, v]) => `${k} ${v}`)
    .join("; ")
}

export function securityHeaders(
  options: HeaderOptions
): { key: string; value: string }[] {
  const headers = [
    { key: "Content-Security-Policy", value: contentSecurityPolicy(options) },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "X-Frame-Options", value: "DENY" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    {
      key: "Permissions-Policy",
      value: "camera=(), microphone=(), geolocation=(), payment=()",
    },
  ]
  if (!options.dev)
    headers.push({
      key: "Strict-Transport-Security",
      value: "max-age=63072000; includeSubDomains",
    })
  return headers
}
