import type { Pool, PoolClient } from "pg"

import { UserFacingError } from "@/lib/generations/types"

// Projects in Postgres. Every query filters by user_id, so another user's
// project simply isn't found.

type Queryable = Pool | PoolClient

export type ProjectDTO = {
  id: string
  name: string
  createdAt: number
  updatedAt: number
}

export const MAX_PROJECT_NAME = 80
const MAX_PROJECTS = 500
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

type Row = { id: string; name: string; created_at: Date; updated_at: Date }

const toDTO = (r: Row): ProjectDTO => ({
  id: r.id,
  name: r.name,
  createdAt: r.created_at.getTime(),
  updatedAt: r.updated_at.getTime(),
})

export const isProjectId = (value: unknown): value is string =>
  typeof value === "string" && UUID.test(value)

function cleanName(raw: unknown): string {
  const name = typeof raw === "string" ? raw.replace(/\s+/g, " ").trim() : ""
  if (!name) return "Untitled"
  return name.slice(0, MAX_PROJECT_NAME)
}

export async function listProjects(
  db: Queryable,
  userId: number
): Promise<ProjectDTO[]> {
  const { rows } = await db.query<Row>(
    `select id, name, created_at, updated_at from projects
     where user_id = $1 order by updated_at desc limit $2`,
    [userId, MAX_PROJECTS]
  )
  return rows.map(toDTO)
}

/** Creates a project. `id` may come from the browser; a taken id is refused. */
export async function createProject(
  db: Queryable,
  userId: number,
  input: { id?: unknown; name?: unknown; createdAt?: unknown }
): Promise<ProjectDTO> {
  const id = input.id === undefined ? crypto.randomUUID() : input.id
  if (!isProjectId(id))
    throw new UserFacingError("invalid_input", "Invalid project id.")
  const count = await db.query<{ n: number }>(
    "select count(*)::int as n from projects where user_id = $1",
    [userId]
  )
  if ((count.rows[0]?.n ?? 0) >= MAX_PROJECTS)
    throw new UserFacingError(
      "invalid_input",
      `You can have up to ${MAX_PROJECTS} projects.`
    )
  // Imported browser projects keep their original creation time.
  const created =
    typeof input.createdAt === "number" &&
    input.createdAt > 0 &&
    input.createdAt <= Date.now()
      ? new Date(input.createdAt)
      : new Date()
  const { rows } = await db.query<Row>(
    `insert into projects (id, user_id, name, created_at, updated_at)
     values ($1, $2, $3, $4, $4)
     on conflict (id) do nothing
     returning id, name, created_at, updated_at`,
    [id, userId, cleanName(input.name), created]
  )
  if (rows[0]) return toDTO(rows[0])
  // Same id again from the same user (a retried request) is fine; anyone else's isn't.
  const mine = await db.query<Row>(
    "select id, name, created_at, updated_at from projects where id = $1 and user_id = $2",
    [id, userId]
  )
  if (mine.rows[0]) return toDTO(mine.rows[0])
  throw new UserFacingError("invalid_input", "Invalid project id.")
}

export async function renameProject(
  db: Queryable,
  userId: number,
  id: string,
  name: unknown
): Promise<ProjectDTO> {
  if (!isProjectId(id))
    throw new UserFacingError("not_found", "Project not found.")
  const { rows } = await db.query<Row>(
    `update projects set name = $3, updated_at = now()
     where id = $1 and user_id = $2 returning id, name, created_at, updated_at`,
    [id, userId, cleanName(name)]
  )
  if (!rows[0]) throw new UserFacingError("not_found", "Project not found.")
  return toDTO(rows[0])
}

/** Deletes the project. Its generations stay, under All. */
export async function deleteProject(
  db: Pool,
  userId: number,
  id: string
): Promise<void> {
  if (!isProjectId(id))
    throw new UserFacingError("not_found", "Project not found.")
  const client = await db.connect()
  try {
    await client.query("begin")
    const deleted = await client.query(
      "delete from projects where id = $1 and user_id = $2",
      [id, userId]
    )
    if (deleted.rowCount !== 1)
      throw new UserFacingError("not_found", "Project not found.")
    await client.query(
      "update generations set project_id = null where user_id = $1 and project_id = $2",
      [userId, id]
    )
    await client.query("commit")
  } catch (error) {
    await client.query("rollback")
    throw error
  } finally {
    client.release()
  }
}

/**
 * The project id to store on a new generation: the user's own project, bumped
 * to the top of their list, or null when it isn't theirs.
 */
export async function claimProjectForGeneration(
  db: Queryable,
  userId: number,
  projectId: string | undefined
): Promise<string | null> {
  if (!isProjectId(projectId)) return null
  const { rows } = await db.query<{ id: string }>(
    "update projects set updated_at = now() where id = $1 and user_id = $2 returning id",
    [projectId, userId]
  )
  return rows[0]?.id ?? null
}
