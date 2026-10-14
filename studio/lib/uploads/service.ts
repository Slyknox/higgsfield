import type { Pool } from "pg"

import { UserFacingError } from "@/lib/generations/types"

// A user's reference library: uploads they prepared and confirmed.

export type UploadDTO = {
  id: string
  url: string
  contentType: string
  name: string | null
  createdAt: number
}

type Row = {
  id: string
  public_url: string
  content_type: string
  name: string | null
  created_at: Date
}

const toDTO = (r: Row): UploadDTO => ({
  id: r.id,
  url: r.public_url,
  contentType: r.content_type,
  name: r.name,
  createdAt: r.created_at.getTime(),
})

export async function listUploads(
  db: Pool,
  userId: number,
  limit = 200
): Promise<UploadDTO[]> {
  const { rows } = await db.query<Row>(
    `select id, public_url, content_type, name, created_at from uploads
     where user_id = $1 and confirmed_at is not null
     order by created_at desc limit $2`,
    [userId, Math.min(Math.max(limit, 1), 500)]
  )
  return rows.map(toDTO)
}

/** Adds an upload this user prepared to their library once the file is stored. */
export async function confirmUpload(
  db: Pool,
  userId: number,
  url: unknown,
  name: unknown
): Promise<UploadDTO> {
  if (typeof url !== "string" || !url || url.length > 2048)
    throw new UserFacingError("invalid_input", "Invalid upload.")
  const label =
    typeof name === "string" && name.trim() ? name.trim().slice(0, 200) : null
  const { rows } = await db.query<Row>(
    `update uploads set confirmed_at = coalesce(confirmed_at, now()), name = coalesce($3, name)
     where id = (
       select id from uploads where user_id = $1 and public_url = $2
       order by created_at desc limit 1
     )
     returning id, public_url, content_type, name, created_at`,
    [userId, url, label]
  )
  if (!rows[0]) throw new UserFacingError("not_found", "Upload not found.")
  return toDTO(rows[0])
}
