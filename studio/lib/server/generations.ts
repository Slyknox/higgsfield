import "server-only"

import { createPlatformClient } from "@/generation/platform"
import type { GenerationDeps } from "@/lib/generations/service"
import {
  createLocalStorage,
  createR2Storage,
  type MediaStorage,
} from "@/lib/generations/storage"
import { webhookUrl } from "@/lib/generations/webhook-token"

import { getBillingConfig } from "./billing-env"
import { getPool } from "./db"
import { getGenerationEnv } from "./generation-env"

let deps: GenerationDeps | undefined

function storageFor(env: ReturnType<typeof getGenerationEnv>): MediaStorage {
  if (env.STORAGE_DRIVER === "r2")
    return createR2Storage({
      accountId: env.R2_ACCOUNT_ID!,
      accessKeyId: env.R2_ACCESS_KEY_ID!,
      secretAccessKey: env.R2_SECRET_ACCESS_KEY!,
      bucket: env.R2_BUCKET!,
      publicBaseUrl: env.R2_PUBLIC_BASE_URL!,
    })
  return createLocalStorage({
    dir: env.LOCAL_MEDIA_DIR,
    publicBaseUrl: new URL(
      "/api/media",
      env.AUTH_URL ?? "http://localhost:3000"
    ).toString(),
  })
}

/** Database, Higgsfield client and storage, built once per server process. */
export function getGenerationDeps(): GenerationDeps {
  if (deps) return deps
  const env = getGenerationEnv()
  const client = createPlatformClient({
    apiKey: env.HF_API_KEY,
    baseUrl: env.HF_API_BASE_URL,
  })
  deps = {
    db: getPool(),
    platform: {
      submit: (path, body, options) => client.submit(path, body, options),
      status: (requestId) => client.status(requestId),
      cancel: (requestId) => client.cancel(requestId),
    },
    storage: storageFor(env),
    webhookUrlFor:
      env.HF_WEBHOOK_BASE_URL && env.HF_WEBHOOK_SECRET
        ? (id) =>
            webhookUrl(env.HF_WEBHOOK_BASE_URL!, env.HF_WEBHOOK_SECRET!, id)
        : undefined,
    maxConcurrent: env.MAX_CONCURRENT_GENERATIONS,
    billing: getBillingConfig(),
    log: (message, details) => console.warn(message, details ?? {}),
  }
  return deps
}

/** The signed-in user's numeric id, or null. */
export function userIdOf(
  session: { user?: { id?: string } } | null
): number | null {
  const id = Number(session?.user?.id)
  return Number.isInteger(id) && id > 0 ? id : null
}
