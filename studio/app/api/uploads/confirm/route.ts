import { getPool } from "@/lib/server/db"
import { json, readObject, withUser } from "@/lib/server/http"
import { confirmUpload } from "@/lib/uploads/service"

/** Called after the browser's PUT succeeds: `{ url, name? }`. */
export function POST(request: Request) {
  return withUser(request, async (userId) => {
    const body = await readObject(request)
    return json({
      upload: await confirmUpload(getPool(), userId, body.url, body.name),
    })
  })
}
