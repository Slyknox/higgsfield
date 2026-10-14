import type { Pool } from "pg"

import { getModel, parseSettings } from "@/generation/catalog"
import type { GenerationPlane, ModelEntry } from "@/generation/catalog"
import type { GenerationStatus as PlatformStatus } from "@/generation/platform"
import { PlatformError } from "@/generation/platform"
import { toPlatform } from "@/generation/to-platform"

import {
  debitForGeneration,
  ensureAccount,
  refundGeneration,
} from "@/lib/billing/credits"
import { priceOf } from "@/lib/billing/pricing"

import type { MediaStorage } from "./storage"
import {
  IN_FLIGHT_STATUSES,
  TERMINAL_STATUSES,
  UserFacingError,
  isTerminal,
  type GenerationDTO,
  type GenerationOutput,
  type GenerationStatus,
  type OutputKind,
} from "./types"

/** The Higgsfield calls the service needs; the real client and test fakes both fit. */
export interface PlatformPort {
  submit(
    path: string,
    body: Record<string, unknown>,
    options?: { webhookUrl?: string }
  ): Promise<{ requestId: string }>
  status(requestId: string): Promise<PlatformStatus>
  cancel(requestId: string): Promise<void>
}

export interface GenerationDeps {
  db: Pool
  platform: PlatformPort
  storage: MediaStorage
  /** Webhook URL for a generation, or undefined to rely on polling. */
  webhookUrlFor?: (generationId: string) => string | undefined
  maxConcurrent?: number
  /** Unset or `enabled: false`: generations are free and nothing is debited. */
  billing?: BillingConfig
  log?: (message: string, details?: Record<string, unknown>) => void
}

export type BillingConfig = {
  enabled: boolean
  /** Retail price = Higgsfield's cost × markup. */
  markup: number
  /** Credits a new account starts with. */
  signupCredits: number
}

const MAX_PROMPT = 5000
const MAX_MEDIA_URL = 2048
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

type Row = {
  id: string
  user_id: number
  project_id: string | null
  surface: GenerationDTO["surface"]
  model_id: string
  prompt: string
  settings: Record<string, unknown>
  status: GenerationStatus
  hf_request_id: string | null
  outputs: GenerationOutput[]
  error: string | null
  created_at: Date
  updated_at: Date
}

const COLUMNS =
  "id, user_id, project_id, surface, model_id, prompt, settings, status, hf_request_id, outputs, error, created_at, updated_at"

export function toDTO(row: Row): GenerationDTO {
  return {
    id: row.id,
    surface: row.surface,
    modelId: row.model_id,
    prompt: row.prompt,
    settings: row.settings,
    projectId: row.project_id,
    status: row.status,
    outputs: row.outputs.map(({ kind, url }) => ({ kind, url })),
    error: row.error,
    createdAt: row.created_at.getTime(),
  }
}

/** Re-validates a plane from the browser against the catalog. Returns the platform request. */
export function prepare(plane: GenerationPlane): {
  model: ModelEntry
  path: string
  body: Record<string, unknown>
} {
  let model: ModelEntry
  try {
    model = getModel(String(plane?.model ?? ""))
  } catch {
    throw new UserFacingError("invalid_input", "That model isn't available.")
  }
  const prompt =
    typeof plane.prompt?.text === "string" ? plane.prompt.text.trim() : ""
  if (prompt.length > MAX_PROMPT)
    throw new UserFacingError(
      "invalid_input",
      `Prompts can be up to ${MAX_PROMPT} characters.`
    )
  for (const items of Object.values(plane.media ?? {})) {
    for (const item of items ?? []) {
      const url = String(item?.url ?? "")
      if (url.length > MAX_MEDIA_URL || !/^https?:\/\//.test(url))
        throw new UserFacingError(
          "invalid_input",
          "One of the attachments has an invalid address."
        )
    }
  }
  try {
    const parsed: GenerationPlane = {
      model: model.id,
      ...(plane.inputMode ? { inputMode: plane.inputMode } : {}),
      prompt: { text: prompt },
      media: plane.media ?? {},
      settings: parseSettings(model, plane.settings ?? {}),
    }
    const { path, body } = toPlatform(parsed)
    return { model, path, body }
  } catch (error) {
    throw new UserFacingError(
      "invalid_input",
      error instanceof Error ? error.message : "Invalid settings."
    )
  }
}

/** Plain-language reason for a failed submit. */
function submitFailure(error: unknown): string {
  if (error instanceof PlatformError) {
    if (error.status === 422 || error.status === 400)
      return error.message || "The generator rejected these settings."
    if (error.status === 401 || error.status === 403)
      return "Generation is temporarily unavailable."
    if (error.status === 429)
      return "The generator is busy. Try again in a minute."
  }
  return "Couldn't reach the generator. Try again."
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

export async function createGeneration(
  deps: GenerationDeps,
  userId: number,
  plane: GenerationPlane,
  projectId?: string
): Promise<GenerationDTO> {
  const { model, path, body } = prepare(plane)
  const settings = parseSettings(model, plane.settings ?? {})
  const billing = deps.billing?.enabled ? deps.billing : undefined
  const cost = billing ? priceOf(model, settings, billing.markup).credits : 0
  if (billing) await ensureAccount(deps.db, userId, billing.signupCredits)
  const max = deps.maxConcurrent ?? 4
  const client = await deps.db.connect()
  let row: Row
  try {
    await client.query("begin")
    // Serialises one user's submits so two tabs can't both slip under the limit.
    await client.query("select pg_advisory_xact_lock($1, $2)", [7301, userId])
    const running = await client.query<{ n: number }>(
      "select count(*)::int as n from generations where user_id = $1 and status = any($2)",
      [userId, IN_FLIGHT_STATUSES]
    )
    if ((running.rows[0]?.n ?? 0) >= max)
      throw new UserFacingError(
        "too_many_running",
        `You can run ${max} generations at once. Wait for one to finish.`
      )
    const inserted = await client.query<Row>(
      `insert into generations (user_id, project_id, surface, model_id, model_path, prompt, settings, media, status, cost)
       values ($1, $2, $3, $4, $5, $6, $7, $8, 'pending_submit', $9) returning ${COLUMNS}`,
      [
        userId,
        projectId ?? null,
        model.surface,
        model.id,
        path,
        String(plane.prompt?.text ?? "").trim(),
        JSON.stringify(settings),
        JSON.stringify(plane.media ?? {}),
        cost,
      ]
    )
    row = inserted.rows[0]!
    // Debit in the same transaction: no credits, no row, nothing submitted.
    await debitForGeneration(client, userId, row.id, cost)
    await client.query("commit")
  } catch (error) {
    await client.query("rollback")
    throw error
  } finally {
    client.release()
  }

  // Only a 429 is retried: the request was refused, so it wasn't created. Any
  // other failure might have created it, and resubmitting could bill twice.
  let lastError: unknown
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const queued = await deps.platform.submit(path, body, {
        webhookUrl: deps.webhookUrlFor?.(row.id),
      })
      const updated = await deps.db.query<Row>(
        `update generations set status = 'queued', hf_request_id = $2, updated_at = now()
         where id = $1 and status = 'pending_submit' returning ${COLUMNS}`,
        [row.id, queued.requestId]
      )
      return toDTO(updated.rows[0] ?? row)
    } catch (error) {
      lastError = error
      if (
        !(error instanceof PlatformError && error.status === 429) ||
        attempt === 2
      )
        break
      await sleep(500 * 2 ** attempt + Math.random() * 250)
    }
  }
  deps.log?.("[generations] submit failed", {
    id: row.id,
    status: lastError instanceof PlatformError ? lastError.status : "network",
  })
  const failed = await deps.db.query<Row>(
    `update generations set status = 'failed', error = $2, updated_at = now(), finished_at = now()
     where id = $1 and status = 'pending_submit' returning ${COLUMNS}`,
    [row.id, submitFailure(lastError)]
  )
  await refund(deps, row.id)
  return toDTO(failed.rows[0] ?? row)
}

function describe(status: PlatformStatus): string {
  if (status.status === "nsfw") return "Blocked by the content filter"
  if (status.status === "canceled") return "Canceled"
  const error = status.error
  if (typeof error === "string" && error) return error
  if (error && typeof error === "object") {
    const detail =
      (error as { detail?: unknown; message?: unknown }).detail ??
      (error as { message?: unknown }).message
    if (typeof detail === "string" && detail) return detail
  }
  return "The generation failed"
}

function extensionFor(url: string, kind: OutputKind): string {
  const match = /\.([a-z0-9]{2,5})$/i.exec(new URL(url).pathname)
  if (match) return match[1]!.toLowerCase()
  return kind === "video" ? "mp4" : kind === "audio" ? "wav" : "png"
}

/**
 * Brings one generation up to date with Higgsfield. Safe to call any number of
 * times from the webhook, the reconciler and the status route at once: the
 * final write only lands while the row is still in flight.
 */
export async function finalizeGeneration(
  deps: GenerationDeps,
  id: string
): Promise<GenerationDTO | null> {
  const found = await deps.db.query<Row>(
    `select ${COLUMNS} from generations where id = $1`,
    [id]
  )
  const row = found.rows[0]
  if (!row) return null
  if (isTerminal(row.status) || !row.hf_request_id) return toDTO(row)

  const status = await deps.platform.status(row.hf_request_id)

  if (status.status === "queued" || status.status === "in_progress") {
    const touched = await deps.db.query<Row>(
      `update generations set status = $2, updated_at = now()
       where id = $1 and status = any($3) returning ${COLUMNS}`,
      [id, status.status, IN_FLIGHT_STATUSES]
    )
    return toDTO(touched.rows[0] ?? row)
  }

  if (status.status === "completed") {
    const sources: { kind: OutputKind; url: string }[] = [
      ...(status.images ?? []).map((i) => ({
        kind: "image" as const,
        url: i.url,
      })),
      ...(status.video
        ? [{ kind: "video" as const, url: status.video.url }]
        : []),
    ]
    if (sources.length === 0)
      return settle(
        deps,
        row,
        "failed",
        "The generation finished without media"
      )
    const outputs: GenerationOutput[] = []
    for (const [index, source] of sources.entries()) {
      const key = `u/${row.user_id}/${row.id}/${index}.${extensionFor(source.url, source.kind)}`
      const stored = await deps.storage.putFromUrl(key, source.url)
      outputs.push({ kind: source.kind, url: stored.url, key })
    }
    const done = await deps.db.query<Row>(
      `update generations set status = 'completed', outputs = $2, error = null, updated_at = now(), finished_at = now()
       where id = $1 and status = any($3) returning ${COLUMNS}`,
      [id, JSON.stringify(outputs), IN_FLIGHT_STATUSES]
    )
    if (done.rows[0]) return toDTO(done.rows[0])
    // Another finalizer won the race; ours are duplicates under the same keys.
    return toDTO(
      (
        await deps.db.query<Row>(
          `select ${COLUMNS} from generations where id = $1`,
          [id]
        )
      ).rows[0]!
    )
  }

  const terminal: GenerationStatus =
    status.status === "nsfw"
      ? "nsfw"
      : status.status === "canceled"
        ? "canceled"
        : "failed"
  return settle(deps, row, terminal, describe(status))
}

async function settle(
  deps: GenerationDeps,
  row: Row,
  status: GenerationStatus,
  error: string
): Promise<GenerationDTO> {
  const updated = await deps.db.query<Row>(
    `update generations set status = $2, error = $3, updated_at = now(), finished_at = now()
     where id = $1 and status = any($4) returning ${COLUMNS}`,
    [row.id, status, error, IN_FLIGHT_STATUSES]
  )
  await refund(deps, row.id)
  return toDTO(updated.rows[0] ?? row)
}

/** Refunds a generation that ended without a result. A no-op otherwise, and safe to repeat. */
async function refund(deps: Pick<GenerationDeps, "db" | "log">, id: string) {
  try {
    await refundGeneration(deps.db, id)
  } catch (error) {
    // The reconciler retries refunds, so a failure here isn't lost.
    deps.log?.("[credits] refund failed", {
      id,
      reason: String(error).slice(0, 200),
    })
  }
}

/**
 * Catches generations whose webhook never came: refreshes stale in-flight rows
 * and fails any that have run too long. `userId` limits it to one user's rows.
 */
export async function reconcile(
  deps: GenerationDeps,
  options: {
    staleSeconds?: number
    timeoutMinutes?: number
    limit?: number
    userId?: number
  } = {}
): Promise<{ refreshed: number; timedOut: number }> {
  const { staleSeconds = 30, timeoutMinutes = 15, limit = 25, userId } = options
  const timedOut = await deps.db.query<{ id: string }>(
    `update generations set status = 'failed', error = 'Timed out waiting for the generator',
       updated_at = now(), finished_at = now()
     where status = any($1) and created_at < now() - make_interval(mins => $2)
       and ($3::int is null or user_id = $3)
     returning id`,
    [IN_FLIGHT_STATUSES, timeoutMinutes, userId ?? null]
  )
  // Includes refunds an earlier pass couldn't make (the ledger keeps them to one each).
  const unrefunded = await deps.db.query<{ id: string }>(
    `select g.id from generations g
     where g.cost > 0 and g.status in ('failed', 'nsfw', 'canceled')
       and g.finished_at > now() - interval '1 day'
       and ($1::int is null or g.user_id = $1)
       and not exists (select 1 from credit_ledger l where l.generation_id = g.id and l.reason = 'refund')
     limit $2`,
    [userId ?? null, limit]
  )
  for (const { id } of [...timedOut.rows, ...unrefunded.rows])
    await refund(deps, id)
  const stale = await deps.db.query<{ id: string }>(
    `select id from generations
     where status in ('queued', 'in_progress') and hf_request_id is not null
       and updated_at < now() - make_interval(secs => $1)
       and ($2::int is null or user_id = $2)
     order by updated_at asc limit $3`,
    [staleSeconds, userId ?? null, limit]
  )
  const results = await Promise.allSettled(
    stale.rows.map((r) => finalizeGeneration(deps, r.id))
  )
  for (const result of results)
    if (result.status === "rejected")
      deps.log?.("[generations] refresh failed", {
        reason: String(result.reason).slice(0, 200),
      })
  return { refreshed: stale.rows.length, timedOut: timedOut.rowCount ?? 0 }
}

export async function listGenerations(
  deps: Pick<GenerationDeps, "db">,
  userId: number,
  options: { before?: number; limit?: number } = {}
): Promise<GenerationDTO[]> {
  const limit = Math.min(Math.max(options.limit ?? 60, 1), 200)
  const { rows } = await deps.db.query<Row>(
    `select ${COLUMNS} from generations
     where user_id = $1 and ($2::timestamptz is null or created_at < $2)
     order by created_at desc limit $3`,
    [userId, options.before ? new Date(options.before) : null, limit]
  )
  return rows.map(toDTO)
}

export async function getGenerations(
  deps: Pick<GenerationDeps, "db">,
  userId: number,
  ids: string[]
): Promise<GenerationDTO[]> {
  const valid = ids.filter((id) => UUID.test(id)).slice(0, 50)
  if (valid.length === 0) return []
  const { rows } = await deps.db.query<Row>(
    `select ${COLUMNS} from generations where user_id = $1 and id = any($2::uuid[])`,
    [userId, valid]
  )
  return rows.map(toDTO)
}

async function owned(
  deps: Pick<GenerationDeps, "db">,
  userId: number,
  id: string
): Promise<Row> {
  if (!UUID.test(id))
    throw new UserFacingError("not_found", "Generation not found.")
  const { rows } = await deps.db.query<Row>(
    `select ${COLUMNS} from generations where id = $1 and user_id = $2`,
    [id, userId]
  )
  if (!rows[0]) throw new UserFacingError("not_found", "Generation not found.")
  return rows[0]
}

/** Cancels on Higgsfield, which only accepts it while the request is queued. */
export async function cancelGeneration(
  deps: GenerationDeps,
  userId: number,
  id: string
): Promise<GenerationDTO> {
  const row = await owned(deps, userId, id)
  if (isTerminal(row.status)) return toDTO(row)
  if (row.hf_request_id) {
    try {
      await deps.platform.cancel(row.hf_request_id)
    } catch (error) {
      if (error instanceof PlatformError && error.status === 400)
        throw new UserFacingError(
          "cannot_cancel",
          "It has already started and can't be canceled."
        )
      throw error
    }
  }
  return settle(deps, row, "canceled", "Canceled")
}

/** Deletes the row and its stored files. Running generations are canceled first when possible. */
export async function deleteGeneration(
  deps: GenerationDeps,
  userId: number,
  id: string
): Promise<void> {
  const row = await owned(deps, userId, id)
  if (!isTerminal(row.status) && row.hf_request_id) {
    // Refund only when Higgsfield accepted the cancel; otherwise it still bills us.
    const canceled = await deps.platform
      .cancel(row.hf_request_id)
      .then(() => true)
      .catch(() => false)
    if (canceled) await settle(deps, row, "canceled", "Canceled")
  }
  await deps.db.query(
    "delete from generations where id = $1 and user_id = $2",
    [id, userId]
  )
  const keys = row.outputs.map((o) => o.key)
  if (keys.length)
    await deps.storage.remove(keys).catch((error: unknown) => {
      deps.log?.("[generations] storage cleanup failed", {
        id,
        reason: String(error).slice(0, 200),
      })
    })
}

export { TERMINAL_STATUSES }
