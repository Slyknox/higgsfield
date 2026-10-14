import { create } from "zustand"

import { uploadMedia } from "@/generation/upload"
import { mediaKindFromMime } from "@/generation/upload-contract"
import type { MediaKind } from "@/generation/catalog/types"

export type AssetKind = MediaKind

/** A durable, submit-ready media reference: `src` is a public URL the platform can fetch. */
export interface AssetSelection {
  id: string
  src: string
  kind: AssetKind
  name?: string
}

export interface AssetLibraryItem extends AssetSelection {
  source: "upload" | "generation"
  createdAt: number
}

type ServerUpload = {
  id: string
  url: string
  contentType: string
  name: string | null
  createdAt: number
}

type UploadsState = {
  items: AssetLibraryItem[]
  loaded: boolean
  /** Loads the signed-in user's library. Signed-out visitors keep an empty one. */
  load: () => Promise<void>
  add: (item: AssetLibraryItem) => void
}

function toItem(u: ServerUpload): AssetLibraryItem {
  return {
    id: u.url,
    src: u.url,
    kind: mediaKindFromMime(u.contentType),
    ...(u.name ? { name: u.name } : {}),
    source: "upload",
    createdAt: u.createdAt,
  }
}

/** The user's uploaded references, kept on the server so every device sees them. */
export const useUploads = create<UploadsState>()((set) => ({
  items: [],
  loaded: false,
  load: async () => {
    try {
      const res = await fetch("/api/uploads", { cache: "no-store" })
      if (!res.ok) return set({ loaded: true })
      const { uploads } = (await res.json()) as { uploads: ServerUpload[] }
      set((s) => {
        const server = uploads.map(toItem)
        // Keep anything uploaded while the list was loading.
        const pending = s.items.filter(
          (i) => !server.some((u) => u.id === i.id)
        )
        return { items: [...pending, ...server], loaded: true }
      })
    } catch {
      set({ loaded: true })
    }
  },
  add: (item) =>
    set((s) => ({
      items: [item, ...s.items.filter((i) => i.id !== item.id)].slice(0, 200),
    })),
}))

export function kindOf(file: File): AssetKind {
  return mediaKindFromMime(file.type)
}

/** Record a reference only after the Higgsfield storage upload succeeds. */
export async function uploadAsset(file: File): Promise<AssetLibraryItem> {
  const { url } = await uploadMedia(file)
  const item: AssetLibraryItem = {
    id: url,
    src: url,
    kind: kindOf(file),
    name: file.name,
    source: "upload",
    createdAt: Date.now(),
  }
  useUploads.getState().add(item)
  // The file is usable already; confirming only adds it to the saved library.
  void fetch("/api/uploads/confirm", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url, name: file.name }),
  }).catch(() => undefined)
  return item
}
