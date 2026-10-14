import Link from "next/link"

import { Section } from "@/components/site/page/section"
import {
  isGenerationStatus,
  listGenerations,
  STUCK_MINUTES,
} from "@/lib/admin/service"
import { requireAdmin } from "@/lib/server/admin"
import { getPool } from "@/lib/server/db"
import { cn } from "@/lib/utils"

import { STATUS_LABEL } from "../format"
import { GenerationsTable } from "../generations-table"

export const dynamic = "force-dynamic"

const FILTERS: { label: string; query: string }[] = [
  { label: "All", query: "" },
  { label: `Stuck (${STUCK_MINUTES}+ min)`, query: "stuck=1" },
  ...["in_progress", "completed", "failed", "nsfw", "canceled"].map((s) => ({
    label: STATUS_LABEL[s]!,
    query: `status=${s}`,
  })),
]

export default async function AdminGenerationsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; stuck?: string }>
}) {
  // Checked per page: a client can skip the layout by claiming its segment.
  await requireAdmin()
  const sp = await searchParams
  const status = isGenerationStatus(sp.status) ? sp.status : undefined
  const stuck = sp.stuck === "1"
  const current = stuck ? "stuck=1" : status ? `status=${status}` : ""
  const rows = await listGenerations(getPool(), { status, stuck, limit: 100 })
  return (
    <main className="flex flex-col gap-5">
      <h1 className="text-q-headline-md-semi-bold">Generations</h1>
      <nav aria-label="Filter generations" className="flex flex-wrap gap-1">
        {FILTERS.map((f) => (
          <Link
            key={f.label}
            href={
              f.query ? `/admin/generations?${f.query}` : "/admin/generations"
            }
            aria-current={f.query === current ? "page" : undefined}
            className={cn(
              "inline-flex h-8 items-center rounded-full px-3 text-q-caption-sm-medium",
              f.query === current
                ? "bg-white/10 text-foreground"
                : "text-q-text-secondary hover:text-foreground"
            )}
          >
            {f.label}
          </Link>
        ))}
      </nav>
      <Section title="Newest first" description="Shows the latest 100.">
        <GenerationsTable rows={rows} />
      </Section>
    </main>
  )
}
