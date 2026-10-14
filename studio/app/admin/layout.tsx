import type { Metadata } from "next"
import type { ReactNode } from "react"

import { SiteHeader } from "@/components/site/site-header"
import { requireAdmin } from "@/lib/server/admin"
import { BRAND } from "@/lib/site/brand"

import { AdminNav } from "./admin-nav"

export const metadata: Metadata = {
  title: `Admin · ${BRAND.name}`,
  robots: { index: false, follow: false },
}

export default async function AdminLayout({
  children,
}: {
  children: ReactNode
}) {
  await requireAdmin()
  return (
    <>
      <SiteHeader />
      <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-6 px-4 py-8 md:px-6">
        <AdminNav />
        {children}
      </div>
    </>
  )
}
