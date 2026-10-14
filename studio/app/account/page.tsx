import type { Metadata } from "next"
import { redirect } from "next/navigation"

import { Section, Stat } from "@/components/site/page/section"
import { SiteHeader } from "@/components/site/site-header"
import { signOutAction } from "@/app/login/actions"
import { Button } from "@/components/ui/button"
import { getAccountSummary } from "@/lib/account/service"
import { listLedger } from "@/lib/billing/credits"
import { LEDGER_LABELS, formatCredits } from "@/lib/billing/labels"
import { getCreditSummary } from "@/lib/server/credits"
import { getPool } from "@/lib/server/db"
import { userIdOf } from "@/lib/server/generations"
import { getSession } from "@/lib/server/session"
import { BRAND } from "@/lib/site/brand"

import { DeleteAccountForm } from "./delete-account-form"

export const metadata: Metadata = { title: `Account · ${BRAND.name}` }

const date = (ms: number) =>
  new Date(ms).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  })

export default async function AccountPage() {
  const userId = userIdOf(await getSession())
  if (!userId) redirect("/login?callbackUrl=/account")
  const pool = getPool()
  const [summary, credits] = await Promise.all([
    getAccountSummary(pool, userId),
    getCreditSummary(userId),
  ])
  if (!summary) redirect("/login?callbackUrl=/account")
  const ledger = credits ? await listLedger(pool, userId, 25) : []

  return (
    <>
      <SiteHeader />
      <main className="mx-auto flex w-full max-w-[720px] flex-col gap-5 px-4 py-10">
        <h1 className="text-q-headline-md-semi-bold">Account</h1>

        <Section title="Profile">
          <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Stat label="Email" value={summary.email} />
            <Stat label="Member since" value={date(summary.memberSince)} />
          </dl>
          <form action={signOutAction}>
            <Button type="submit" variant="outline">
              Sign out
            </Button>
          </form>
        </Section>

        <Section
          title="Credits"
          description={
            credits
              ? "Each generation's price shows on its Generate button. Failed, blocked and canceled generations are refunded automatically."
              : "Generations don't use credits right now."
          }
        >
          {credits ? (
            <>
              <dl>
                <Stat
                  label="Balance"
                  value={`${credits.balance.toLocaleString("en-US")} credits`}
                />
              </dl>
              {ledger.length ? (
                <table className="w-full text-q-body-sm-regular">
                  <caption className="sr-only">Recent credit activity</caption>
                  <thead className="text-left text-q-caption-sm-regular text-q-text-secondary">
                    <tr>
                      <th className="pb-2 font-normal">Date</th>
                      <th className="pb-2 font-normal">Activity</th>
                      <th className="pb-2 text-right font-normal">Credits</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ledger.map((e) => (
                      <tr key={e.id} className="border-t border-white/5">
                        <td className="py-2 pr-3 whitespace-nowrap text-q-text-secondary">
                          {date(e.createdAt)}
                        </td>
                        <td className="py-2 pr-3">
                          {LEDGER_LABELS[e.reason]}
                          {e.reason === "admin" && e.note ? (
                            <span className="text-q-text-secondary">
                              {" "}
                              · {e.note}
                            </span>
                          ) : null}
                        </td>
                        <td className="py-2 text-right tabular-nums">
                          {formatCredits(e.delta)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className="text-q-body-sm-regular text-q-text-secondary">
                  No credit activity yet.
                </p>
              )}
            </>
          ) : null}
        </Section>

        <Section title="Usage">
          <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Stat label="Generations" value={summary.generations.total} />
            <Stat label="This month" value={summary.generations.thisMonth} />
            <Stat label="Projects" value={summary.projects} />
            <Stat label="Uploads" value={summary.uploads} />
          </dl>
        </Section>

        <Section
          title="Delete account"
          tone="danger"
          description="Deletes your account, generations, projects, credits and stored media. This can't be undone. Unused credits are lost."
        >
          <DeleteAccountForm email={summary.email} />
        </Section>
      </main>
    </>
  )
}
