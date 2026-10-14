import type { Surface } from "@/generation/catalog"

export type RunStatus = "running" | "completed" | "failed"

/** One generation and everything the studio shows about it. History lives in Postgres. */
export interface RunRecord {
  id: string
  /** Same as `id`: the server never exposes the Higgsfield request id. */
  requestId: string
  surface: Surface
  modelId: string
  modelLabel: string
  prompt: string
  settings: Record<string, unknown>
  /** Owning project, when generated from a project view. */
  projectId?: string
  /** Aspect ratio as width / height, used by the justified feed before media loads. */
  aspect: number
  status: RunStatus
  /** Result URLs: one video or N images. */
  urls: string[]
  error?: string
  createdAt: number
}

/** Parses "16:9" / "9:16" / "1:1" style enum values; 1 when unknown. */
export function aspectFromSettings(settings: Record<string, unknown>): number {
  const raw = settings.aspect_ratio ?? settings.aspectRatio ?? settings.ratio
  if (typeof raw !== "string") return 1
  const [w, h] = raw.split(/[:x/]/).map(Number)
  return w && h ? w / h : 1
}
