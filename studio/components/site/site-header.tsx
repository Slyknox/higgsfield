import { getSession } from "@/lib/server/session"
import { TopNav, type NavUser } from "@/components/site/top-nav"

/** Server wrapper: reads the session once and hands the nav a plain user. */
export async function SiteHeader() {
  const session = await getSession()
  const user: NavUser | null = session?.user?.email
    ? { email: session.user.email, name: session.user.name ?? null, role: session.user.role }
    : null
  return <TopNav user={user} />
}
