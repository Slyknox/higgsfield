import type { Metadata } from "next"
import { redirect } from "next/navigation"

import { GeneratorRoute } from "@/components/site/generator-route"
import { SiteHeader } from "@/components/site/site-header"
import { NoModels } from "@/components/studio/no-models"
import { MODELS } from "@/generation/catalog"
import { BRAND } from "@/lib/site/brand"
import { getSession } from "@/lib/server/session"

export const metadata: Metadata = {
  title: `Assets · ${BRAND.name}`,
}

export default async function Page() {
  if (MODELS.length === 0) return <NoModels />
  if (!(await getSession())) redirect("/login?callbackUrl=/assets")
  return (
    <>
      <SiteHeader />
      <GeneratorRoute initialView="all" signedIn />
    </>
  )
}
