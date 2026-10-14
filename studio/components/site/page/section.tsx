import type { ReactNode } from "react"

/** A titled panel used by the account and admin pages. */
export function Section({
  title,
  description,
  children,
  tone = "default",
}: {
  title: string
  description?: ReactNode
  children: ReactNode
  tone?: "default" | "danger"
}) {
  return (
    <section
      aria-label={title}
      className={
        tone === "danger"
          ? "flex flex-col gap-4 rounded-2xl border border-destructive/30 bg-destructive/5 p-5"
          : "flex flex-col gap-4 rounded-2xl border border-white/10 bg-white/[0.03] p-5"
      }
    >
      <div className="flex flex-col gap-1">
        <h2 className="text-q-label-md-semi-bold">{title}</h2>
        {description ? (
          <p className="text-q-body-sm-regular text-q-text-secondary">
            {description}
          </p>
        ) : null}
      </div>
      {children}
    </section>
  )
}

/** A label and a value, stacked. */
export function Stat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-q-caption-sm-regular text-q-text-secondary">
        {label}
      </dt>
      <dd className="text-q-body-md-medium tabular-nums">{value}</dd>
    </div>
  )
}
