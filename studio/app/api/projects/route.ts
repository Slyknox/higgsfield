import { createProject, listProjects } from "@/lib/projects/service"
import { getPool } from "@/lib/server/db"
import { json, readObject, withUser } from "@/lib/server/http"

/** The signed-in user's projects, most recently used first. */
export function GET(request: Request) {
  return withUser(request, async (userId) =>
    json({ projects: await listProjects(getPool(), userId) })
  )
}

/** Creates a project: `{ id?: uuid, name, createdAt? }`. */
export function POST(request: Request) {
  return withUser(request, async (userId) => {
    const body = await readObject(request)
    return json({ project: await createProject(getPool(), userId, body) }, 201)
  })
}
