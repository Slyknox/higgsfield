// The platform key lives in the server environment (HF_API_KEY). These helpers
// only shape it into the `Key` authorization header and reject malformed keys.

export function toAuthorizationHeader(apiKey: string): string {
  return `Key ${requireApiKey(apiKey)}`
}

function requireApiKey(apiKey: string): string {
  const key = apiKey.trim()
  if (!key) throw new Error("Enter an API key")
  if (/[^\x21-\x7E]/.test(key))
    throw new Error(
      "Paste the API key exactly as copied from open.higgsfield.ai"
    )
  return key
}
