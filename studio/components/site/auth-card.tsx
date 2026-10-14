import type { ReactNode } from "react"

/** Centered card used by the login, check-email and error pages. */
export function AuthCard({
  title,
  children,
}: {
  title: ReactNode
  children: ReactNode
}) {
  return (
    <main className="flex min-h-[calc(100dvh-56px)] items-center justify-center px-4 py-12">
      <div className="flex w-full max-w-[400px] flex-col gap-6 rounded-2xl border border-white/10 bg-white/[0.03] p-6 sm:p-8">
        <h1 className="text-q-headline-md-semi-bold">{title}</h1>
        {children}
      </div>
    </main>
  )
}
