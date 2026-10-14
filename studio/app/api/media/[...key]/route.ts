import { readFile } from "node:fs/promises"
import { join, resolve, sep } from "node:path"

import { assertKey } from "@/lib/generations/storage"
import { getGenerationEnv } from "@/lib/server/generation-env"

const TYPES: Record<string, string> = {
  mp4: "video/mp4",
  webm: "video/webm",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
  wav: "audio/wav",
  mp3: "audio/mpeg",
}

/** Serves locally stored outputs. Only exists with STORAGE_DRIVER=local (localhost). */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ key: string[] }> }
) {
  const env = getGenerationEnv()
  if (env.STORAGE_DRIVER !== "local")
    return new Response("Not found", { status: 404 })
  const key = (await params).key.join("/")
  try {
    assertKey(key)
  } catch {
    return new Response("Not found", { status: 404 })
  }
  const root = resolve(env.LOCAL_MEDIA_DIR)
  const path = resolve(join(root, key))
  if (!path.startsWith(root + sep))
    return new Response("Not found", { status: 404 })
  try {
    const bytes = await readFile(path)
    const ext = key.split(".").pop() ?? ""
    return new Response(bytes, {
      headers: {
        "Content-Type": TYPES[ext] ?? "application/octet-stream",
        "Cache-Control": "private, max-age=3600",
      },
    })
  } catch {
    return new Response("Not found", { status: 404 })
  }
}
