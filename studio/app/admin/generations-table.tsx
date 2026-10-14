import Link from "next/link"

import type { AdminGenerationRow } from "@/lib/admin/service"
import { IN_FLIGHT_STATUSES } from "@/lib/generations/types"

import { dateTime, STATUS_LABEL } from "./format"
import { RefreshGenerationButton } from "./forms"

/** Generations across users; in-flight rows get a "Check now" button. */
export function GenerationsTable({
  rows,
  showUser = true,
}: {
  rows: AdminGenerationRow[]
  showUser?: boolean
}) {
  if (rows.length === 0)
    return (
      <p className="text-q-body-sm-regular text-q-text-secondary">
        Nothing here.
      </p>
    )
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] text-q-body-sm-regular">
        <thead className="text-left text-q-caption-sm-regular text-q-text-secondary">
          <tr>
            <th className="pb-2 font-normal">Created</th>
            {showUser ? <th className="pb-2 font-normal">User</th> : null}
            <th className="pb-2 font-normal">Model</th>
            <th className="pb-2 font-normal">Prompt</th>
            <th className="pb-2 font-normal">Status</th>
            <th className="pb-2 text-right font-normal">Cost</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((g) => (
            <tr key={g.id} className="border-t border-white/5 align-top">
              <td className="py-2 pr-3 whitespace-nowrap text-q-text-secondary">
                {dateTime(g.createdAt)}
              </td>
              {showUser ? (
                <td className="max-w-[200px] truncate py-2 pr-3">
                  <Link
                    href={`/admin/users/${g.userId}`}
                    className="underline-offset-2 hover:underline"
                  >
                    {g.email}
                  </Link>
                </td>
              ) : null}
              <td className="py-2 pr-3 whitespace-nowrap">{g.modelId}</td>
              <td className="max-w-[320px] py-2 pr-3">
                <p className="line-clamp-2">{g.prompt || "—"}</p>
                {g.error ? (
                  <p className="text-q-caption-sm-regular text-q-state-error-fg">
                    {g.error}
                  </p>
                ) : null}
                {g.outputUrl ? (
                  <a
                    href={g.outputUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-q-caption-sm-regular text-q-text-secondary underline underline-offset-2"
                  >
                    Open output
                  </a>
                ) : null}
              </td>
              <td className="py-2 pr-3 whitespace-nowrap">
                <div className="flex flex-col gap-1">
                  {STATUS_LABEL[g.status] ?? g.status}
                  {(IN_FLIGHT_STATUSES as readonly string[]).includes(
                    g.status
                  ) ? (
                    <RefreshGenerationButton id={g.id} />
                  ) : null}
                </div>
              </td>
              <td className="py-2 text-right tabular-nums">{g.cost || "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
