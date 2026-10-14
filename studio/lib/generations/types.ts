import type { Surface } from "@/generation/catalog"

export type GenerationStatus =
  | "pending_submit"
  | "queued"
  | "in_progress"
  | "completed"
  | "failed"
  | "nsfw"
  | "canceled"

export const TERMINAL_STATUSES: readonly GenerationStatus[] = [
  "completed",
  "failed",
  "nsfw",
  "canceled",
]
export const IN_FLIGHT_STATUSES: readonly GenerationStatus[] = [
  "pending_submit",
  "queued",
  "in_progress",
]

export const isTerminal = (status: string): boolean =>
  (TERMINAL_STATUSES as readonly string[]).includes(status)

export type OutputKind = "image" | "video" | "audio"

export type GenerationOutput = { kind: OutputKind; url: string; key: string }

/** What the browser sees of one generation. Never includes request ids or model paths. */
export type GenerationDTO = {
  id: string
  surface: Surface
  modelId: string
  prompt: string
  settings: Record<string, unknown>
  projectId: string | null
  status: GenerationStatus
  outputs: { kind: OutputKind; url: string }[]
  error: string | null
  createdAt: number
}

/** An error whose message is safe and useful to show the user. */
export class UserFacingError extends Error {
  readonly code:
    | "invalid_input"
    | "too_many_running"
    | "not_found"
    | "cannot_cancel"
    | "unavailable"

  constructor(code: UserFacingError["code"], message: string) {
    super(message)
    this.name = "UserFacingError"
    this.code = code
  }
}
