import { deleteProject, renameProject } from "@/lib/projects/service"
import { getPool } from "@/lib/server/db"
import { json, readObject, withUser } from "@/lib/server/http"

type Context = { params: Promise<{ id: string }> }

/** Renames a project: `{ name }`. */
export function PATCH(request: Request, { params }: Context) {
  return withUser(request, async (userId) => {
    const { id } = await params
    const body = await readObject(request)
    return json({
      project: await renameProject(getPool(), userId, id, body.name),
    })
  })
}

/** Deletes a project; its generations stay under All. */
export function DELETE(request: Request, { params }: Context) {
  return withUser(request, async (userId) => {
    const { id } = await params
    await deleteProject(getPool(), userId, id)
    return json({ ok: true })
  })
}
