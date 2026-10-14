import { createHmac, timingSafeEqual } from "node:crypto"

// Higgsfield doesn't sign webhooks, so the URL we hand it carries an HMAC of
// the generation id. A request without a matching token is rejected, and even
// a valid one is only a hint: the handler re-fetches the status itself.

export function webhookToken(secret: string, generationId: string): string {
  return createHmac("sha256", secret)
    .update(`hf-webhook:${generationId}`)
    .digest("hex")
}

export function verifyWebhookToken(
  secret: string,
  generationId: string,
  token: unknown
): boolean {
  if (typeof token !== "string" || !/^[0-9a-f]{64}$/.test(token)) return false
  const expected = Buffer.from(webhookToken(secret, generationId), "hex")
  return timingSafeEqual(expected, Buffer.from(token, "hex"))
}

export function webhookUrl(
  baseUrl: string,
  secret: string,
  generationId: string
): string {
  const url = new URL("/api/webhooks/higgsfield", baseUrl)
  url.searchParams.set("gid", generationId)
  url.searchParams.set("t", webhookToken(secret, generationId))
  return url.toString()
}
