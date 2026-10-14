import "server-only"

import { notFound } from "next/navigation"

import { userIdOf } from "./generations"
import { getSession } from "./session"

/**
 * The signed-in admin's user id. Anyone else gets a 404, so the admin area
 * doesn't advertise itself. The role is read from the database on every
 * request (database sessions), so a demoted admin loses access at once.
 */
export async function requireAdmin(): Promise<number> {
  const session = await getSession()
  const userId = userIdOf(session)
  if (!userId || session?.user?.role !== "admin") notFound()
  return userId
}
