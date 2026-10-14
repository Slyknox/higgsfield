import Link from "next/link"

import { Section, Stat } from "@/components/site/page/section"
import {
  getOverview,
  listGenerations,
  STUCK_MINUTES,
} from "@/lib/admin/service"
import { getBillingConfig } from "@/lib/server/billing-env"
import { requireAdmin } from "@/lib/server/admin"
import { getPool } from "@/lib/server/db"

import { ReconcileButton } from "./forms"
import { GenerationsTable } from "./generations-table"

export const dynamic = "force-dynamic"

export default async function AdminOverviewPage() {
  // Checked per page: a client can skip the layout by claiming its segment.
  await requireAdmin()
  const pool = getPool()
  const [o, stuck] = await Promise.all([
    getOverview(pool),
    listGenerations(pool, { stuck: true, limit: 10 }),
  ])
  const billing = getBillingConfig()
  return (
    <main className="flex flex-col gap-5">
      <h1 className="text-q-headline-md-semi-bold">Admin</h1>
      <Section title="At a glance">
        <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Stat label="Users" value={o.users} />
          <Stat label="New this week" value={o.newUsers7d} />
          <Stat label="Generations, 24 h" value={o.generations24h} />
          <Stat label="Failed or blocked, 24 h" value={o.failed24h} />
          <Stat label="Running now" value={o.inFlight} />
          <Stat label={`Stuck over ${STUCK_MINUTES} min`} value={o.stuck} />
          <Stat
            label="Billing"
            value={billing.enabled ? `On, ${billing.markup}× markup` : "Off"}
          />
          <Stat
            label="Unspent credits"
            value={o.creditsOutstanding.toLocaleString("en-US")}
          />
        </dl>
      </Section>
      <Section
        title="Stuck generations"
        description={
          <>
            Running for more than {STUCK_MINUTES} minutes. The reconciler times
            them out after 15 minutes and refunds their credits.{" "}
            <Link
              href="/admin/generations?stuck=1"
              className="underline underline-offset-2"
            >
              See all
            </Link>
          </>
        }
      >
        <GenerationsTable rows={stuck} />
        <ReconcileButton />
      </Section>
    </main>
  )
}
