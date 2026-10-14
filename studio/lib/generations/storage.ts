import { mkdir, rm, writeFile } from "node:fs/promises"
import { dirname, join, resolve, sep } from "node:path"

import { AwsClient } from "aws4fetch"

// Where finished outputs live. Higgsfield keeps them only about seven days, so
// every completed generation is copied here and served from our own URL.

export interface MediaStorage {
  /** Copies `sourceUrl` to `key` and returns the public URL. */
  putFromUrl(
    key: string,
    sourceUrl: string
  ): Promise<{ url: string; contentType: string }>
  remove(keys: string[]): Promise<void>
}

const KEY = /^u\/\d+\/[0-9a-f-]{36}\/\d+\.[a-z0-9]{2,5}$/
const MAX_BYTES = 512 * 1024 * 1024

export function assertKey(key: string): void {
  if (!KEY.test(key)) throw new Error("Invalid storage key")
}

/** Fetches an output, refusing anything that isn't http(s) or is too large. */
async function download(
  sourceUrl: string,
  fetchImpl: typeof fetch,
  allowHttp: boolean
): Promise<{ bytes: ArrayBuffer; contentType: string }> {
  const url = new URL(sourceUrl)
  if (url.protocol !== "https:" && !(allowHttp && url.protocol === "http:"))
    throw new Error(`Refusing to copy from ${url.protocol} URL`)
  const response = await fetchImpl(url, { redirect: "follow" })
  if (!response.ok)
    throw new Error(`Output download failed (${response.status})`)
  const length = Number(response.headers.get("content-length") ?? 0)
  if (length > MAX_BYTES)
    throw new Error("Output is larger than the storage limit")
  const bytes = await response.arrayBuffer()
  if (bytes.byteLength > MAX_BYTES)
    throw new Error("Output is larger than the storage limit")
  return {
    bytes,
    contentType:
      response.headers.get("content-type") ?? "application/octet-stream",
  }
}

/** Local disk, served by /api/media. Development and tests only. */
export function createLocalStorage(options: {
  dir: string
  publicBaseUrl: string
  fetchImpl?: typeof fetch
}): MediaStorage {
  const root = resolve(options.dir)
  const pathFor = (key: string) => {
    assertKey(key)
    const path = resolve(join(root, key))
    if (!path.startsWith(root + sep)) throw new Error("Invalid storage key")
    return path
  }
  return {
    async putFromUrl(key, sourceUrl) {
      const path = pathFor(key)
      const { bytes, contentType } = await download(
        sourceUrl,
        options.fetchImpl ?? fetch,
        true
      )
      await mkdir(dirname(path), { recursive: true })
      await writeFile(path, Buffer.from(bytes))
      return {
        url: `${options.publicBaseUrl.replace(/\/$/, "")}/${key}`,
        contentType,
      }
    },
    async remove(keys) {
      await Promise.all(keys.map((key) => rm(pathFor(key), { force: true })))
    },
  }
}

/** Cloudflare R2 through its S3 API. Objects are served from R2_PUBLIC_BASE_URL. */
export function createR2Storage(options: {
  accountId: string
  accessKeyId: string
  secretAccessKey: string
  bucket: string
  publicBaseUrl: string
  fetchImpl?: typeof fetch
}): MediaStorage {
  const client = new AwsClient({
    accessKeyId: options.accessKeyId,
    secretAccessKey: options.secretAccessKey,
    service: "s3",
    region: "auto",
  })
  const endpoint = `https://${options.accountId}.r2.cloudflarestorage.com/${encodeURIComponent(options.bucket)}`
  const objectUrl = (key: string) => {
    assertKey(key)
    return `${endpoint}/${key}`
  }
  return {
    async putFromUrl(key, sourceUrl) {
      const { bytes, contentType } = await download(
        sourceUrl,
        options.fetchImpl ?? fetch,
        false
      )
      const response = await client.fetch(objectUrl(key), {
        method: "PUT",
        body: bytes,
        headers: {
          "Content-Type": contentType,
          "Cache-Control": "public, max-age=31536000, immutable",
        },
      })
      if (!response.ok) throw new Error(`R2 upload failed (${response.status})`)
      return {
        url: `${options.publicBaseUrl.replace(/\/$/, "")}/${key}`,
        contentType,
      }
    },
    async remove(keys) {
      await Promise.all(
        keys.map(async (key) => {
          const response = await client.fetch(objectUrl(key), {
            method: "DELETE",
          })
          if (!response.ok && response.status !== 404)
            throw new Error(`R2 delete failed (${response.status})`)
        })
      )
    },
  }
}
