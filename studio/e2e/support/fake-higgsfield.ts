import { randomUUID } from "node:crypto"
import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http"

// A stand-in for api.higgsfield.ai with the documented request lifecycle, so
// tests never spend credits or depend on the network. The prompt picks the
// outcome: [nsfw], [fail], [slow] (stays queued), [reject] (422 on submit),
// [busy] (one 429, then accepted). Anything else completes after ~1.2 s.

export const FAKE_KEY = "fake-test-key"

type Job = {
  id: string
  path: string
  prompt: string
  createdAt: number
  canceled: boolean
  webhookUrl: string | null
}

const PNG_1X1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64"
)
const VIDEO_PATH =
  /video|seedance|kling|wan|minimax|ltx|pixverse|happy-horse|dop|flux-3/

function statusOf(job: Job): string {
  if (job.canceled) return "canceled"
  if (job.prompt.includes("[slow]")) return "queued"
  const age = Date.now() - job.createdAt
  if (job.prompt.includes("[nsfw]")) return age > 600 ? "nsfw" : "queued"
  if (job.prompt.includes("[fail]")) return age > 600 ? "failed" : "queued"
  if (age < 400) return "queued"
  if (age < 1200) return "in_progress"
  return "completed"
}

async function readBody(req: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = []
  for await (const chunk of req) chunks.push(chunk as Buffer)
  return Buffer.concat(chunks).toString("utf8")
}

function json(res: ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { "Content-Type": "application/json" })
  res.end(JSON.stringify(body))
}

export async function startFakeHiggsfield(port = 0): Promise<{
  url: string
  jobs: Map<string, Job>
  submits: { path: string; webhookUrl: string | null }[]
  close: () => Promise<void>
}> {
  const jobs = new Map<string, Job>()
  const submits: { path: string; webhookUrl: string | null }[] = []
  const busyOnce = new Set<string>()
  let base = ""

  const server = createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", base)
    const path = url.pathname

    if (req.method === "GET" && path.startsWith("/media/")) {
      const video = path.endsWith(".mp4")
      res.writeHead(200, { "Content-Type": video ? "video/mp4" : "image/png" })
      res.end(video ? Buffer.from("fake-mp4-bytes") : PNG_1X1)
      return
    }
    if (req.method === "PUT" && path.startsWith("/upload/")) {
      await readBody(req)
      res.writeHead(200)
      res.end()
      return
    }

    if (req.headers.authorization !== `Key ${FAKE_KEY}`)
      return json(res, 401, { detail: "Invalid credentials" })

    if (req.method === "POST" && path === "/files/generate-upload-url") {
      const body = JSON.parse((await readBody(req)) || "{}") as {
        content_type?: string
      }
      const id = randomUUID()
      return json(res, 200, {
        upload_url: `${base}/upload/${id}`,
        public_url: `${base}/files/${id}`,
        content_type: body.content_type,
        upload_headers: { "Content-Type": body.content_type },
      })
    }

    const statusMatch = /^\/requests\/([^/]+)\/status$/.exec(path)
    if (req.method === "GET" && statusMatch) {
      const job = jobs.get(statusMatch[1]!)
      if (!job) return json(res, 404, { detail: "Not found" })
      const status = statusOf(job)
      const ext = VIDEO_PATH.test(job.path) ? "mp4" : "png"
      return json(res, 200, {
        status,
        request_id: job.id,
        ...(status === "completed"
          ? ext === "mp4"
            ? { video: { url: `${base}/media/${job.id}.mp4` } }
            : { images: [{ url: `${base}/media/${job.id}.png` }] }
          : {}),
        ...(status === "failed" ? { error: { detail: "Fake failure" } } : {}),
      })
    }

    const cancelMatch = /^\/requests\/([^/]+)\/cancel$/.exec(path)
    if (req.method === "POST" && cancelMatch) {
      const job = jobs.get(cancelMatch[1]!)
      if (!job) return json(res, 404, { detail: "Not found" })
      if (statusOf(job) !== "queued")
        return json(res, 400, { detail: "Request is not queued" })
      job.canceled = true
      return json(res, 202, { status: "canceled" })
    }

    if (req.method === "POST") {
      const body = JSON.parse((await readBody(req)) || "{}") as {
        prompt?: string
      }
      const prompt = body.prompt ?? ""
      const webhookUrl = url.searchParams.get("hf_webhook")
      submits.push({ path, webhookUrl })
      if (prompt.includes("[reject]"))
        return json(res, 422, { detail: "Prompt rejected by the fake" })
      if (prompt.includes("[busy]") && !busyOnce.has(prompt)) {
        busyOnce.add(prompt)
        return json(res, 429, { detail: "Too many requests" })
      }
      const id = randomUUID()
      jobs.set(id, {
        id,
        path,
        prompt,
        createdAt: Date.now(),
        canceled: false,
        webhookUrl,
      })
      return json(res, 200, {
        status: "queued",
        request_id: id,
        status_url: `${base}/requests/${id}/status`,
        cancel_url: `${base}/requests/${id}/cancel`,
      })
    }

    json(res, 404, { detail: "Not found" })
  })

  await new Promise<void>((resolve) =>
    server.listen(port, "127.0.0.1", resolve)
  )
  const address = server.address()
  base = `http://127.0.0.1:${typeof address === "object" && address ? address.port : port}`
  return {
    url: base,
    jobs,
    submits,
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  }
}
