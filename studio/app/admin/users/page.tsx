import Link from "next/link"

import { Section } from "@/components/site/page/section"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { listUsers } from "@/lib/admin/service"
import { getPool } from "@/lib/server/db"

import { day } from "../format"

export const dynamic = "force-dynamic"

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>
}) {
  const q = (await searchParams).q?.slice(0, 254) ?? ""
  const users = await listUsers(getPool(), { query: q, limit: 100 })
  return (
    <main className="flex flex-col gap-5">
      <h1 className="text-q-headline-md-semi-bold">Users</h1>
      <Section title="Find a user">
        <form className="flex gap-2" role="search">
          <Input
            type="search"
            name="q"
            defaultValue={q}
            placeholder="Part of an email address"
            aria-label="Search by email"
          />
          <Button type="submit" variant="outline">
            Search
          </Button>
        </form>
        {users.length === 0 ? (
          <p className="text-q-body-sm-regular text-q-text-secondary">
            No users match.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-q-body-sm-regular">
              <thead className="text-left text-q-caption-sm-regular text-q-text-secondary">
                <tr>
                  <th className="pb-2 font-normal">Email</th>
                  <th className="pb-2 font-normal">Joined</th>
                  <th className="pb-2 text-right font-normal">Generations</th>
                  <th className="pb-2 text-right font-normal">Credits</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="border-t border-white/5">
                    <td className="py-2 pr-3">
                      <Link
                        href={`/admin/users/${u.id}`}
                        className="underline-offset-2 hover:underline"
                      >
                        {u.email}
                      </Link>
                      {u.role === "admin" ? (
                        <span className="ml-2 text-q-caption-sm-regular text-q-text-secondary">
                          admin
                        </span>
                      ) : null}
                    </td>
                    <td className="py-2 pr-3 whitespace-nowrap text-q-text-secondary">
                      {day(u.createdAt)}
                    </td>
                    <td className="py-2 pr-3 text-right tabular-nums">
                      {u.generations}
                    </td>
                    <td className="py-2 text-right tabular-nums">
                      {u.balance}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>
    </main>
  )
}
