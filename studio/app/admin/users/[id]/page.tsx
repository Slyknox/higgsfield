import { notFound } from "next/navigation"

import { Section, Stat } from "@/components/site/page/section"
import { getUser, listGenerations } from "@/lib/admin/service"
import { listLedger } from "@/lib/billing/credits"
import { LEDGER_LABELS, formatCredits } from "@/lib/billing/labels"
import { getPool } from "@/lib/server/db"

import { dateTime, day } from "../../format"
import { GrantCreditsForm } from "../../forms"
import { GenerationsTable } from "../../generations-table"

export const dynamic = "force-dynamic"

export default async function AdminUserPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const id = Number((await params).id)
  const pool = getPool()
  const user = await getUser(pool, id)
  if (!user) notFound()
  const [ledger, generations] = await Promise.all([
    listLedger(pool, user.id, 50),
    listGenerations(pool, { userId: user.id, limit: 50 }),
  ])
  return (
    <main className="flex flex-col gap-5">
      <h1 className="truncate text-q-headline-md-semi-bold">{user.email}</h1>
      <Section title="Account">
        <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Stat label="Role" value={user.role} />
          <Stat label="Joined" value={day(user.createdAt)} />
          <Stat label="Generations" value={user.generations} />
          <Stat label="Credits" value={user.balance} />
        </dl>
      </Section>
      <Section
        title="Adjust credits"
        description="Use a negative number to take credits away. Every change is logged with your account and the reason."
      >
        <GrantCreditsForm userId={user.id} />
      </Section>
      <Section title="Credit history">
        {ledger.length === 0 ? (
          <p className="text-q-body-sm-regular text-q-text-secondary">
            No credit activity.
          </p>
        ) : (
          <table className="w-full text-q-body-sm-regular">
            <tbody>
              {ledger.map((e) => (
                <tr
                  key={e.id}
                  className="border-t border-white/5 first:border-0"
                >
                  <td className="py-2 pr-3 whitespace-nowrap text-q-text-secondary">
                    {dateTime(e.createdAt)}
                  </td>
                  <td className="py-2 pr-3">
                    {LEDGER_LABELS[e.reason]}
                    {e.note ? (
                      <span className="text-q-text-secondary"> · {e.note}</span>
                    ) : null}
                  </td>
                  <td className="py-2 text-right tabular-nums">
                    {formatCredits(e.delta)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>
      <Section title="Generations">
        <GenerationsTable rows={generations} showUser={false} />
      </Section>
    </main>
  )
}
