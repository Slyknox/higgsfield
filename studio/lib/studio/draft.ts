import type { Surface } from "@/generation/catalog"

// The prompt a signed-out user typed before being sent to sign in. Kept in
// localStorage so it survives the magic link opening a new tab. Per-viewer
// convenience only: a failed read or write just loses the draft.
const KEY = "studio.draft.v1"
const MAX_AGE_MS = 60 * 60 * 1000

type Draft = { surface: Surface; prompt: string; savedAt: number }

export function saveDraft(surface: Surface, prompt: string): void {
  if (!prompt.trim()) return
  try {
    localStorage.setItem(KEY, JSON.stringify({ surface, prompt, savedAt: Date.now() } satisfies Draft))
  } catch {
    // Storage blocked (private mode, quota): nothing to keep.
  }
}

/** Returns and clears the draft for this surface, if one is fresh. */
export function takeDraft(surface: Surface): string | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const draft = JSON.parse(raw) as Partial<Draft>
    if (draft.surface !== surface) return null
    localStorage.removeItem(KEY)
    if (typeof draft.prompt !== "string" || typeof draft.savedAt !== "number") return null
    return Date.now() - draft.savedAt <= MAX_AGE_MS ? draft.prompt : null
  } catch {
    return null
  }
}
