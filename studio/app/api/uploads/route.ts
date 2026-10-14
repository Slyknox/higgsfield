import { getPool } from "@/lib/server/db"
import { json, withUser } from "@/lib/server/http"
import { listUploads } from "@/lib/uploads/service"

/** The signed-in user's confirmed reference uploads, newest first. */
export function GET(request: Request) {
  return withUser(request, async (userId) =>
    json({ uploads: await listUploads(getPool(), userId) })
  )
}
