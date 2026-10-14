import type { Metadata } from "next"

import { GeneratorRoute } from "@/components/site/generator-route"
import { SiteHeader } from "@/components/site/site-header"
import { NoModels } from "@/components/studio/no-models"
import { MODELS } from "@/generation/catalog"
import { BRAND } from "@/lib/site/brand"
import { getCreditSummary } from "@/lib/server/credits"
import { userIdOf } from "@/lib/server/generations"
import { getSession } from "@/lib/server/session"

export const metadata: Metadata = {
  title: `AI Image Generator · ${BRAND.name}`,
}

export default async function Page() {
  if (!MODELS.some((m) => m.surface === "image")) return <NoModels />
  const session = await getSession()
  const credits = await getCreditSummary(userIdOf(session))
  return (
    <>
      <SiteHeader />
      <GeneratorRoute
        surface="image"
        signedIn={session != null}
        credits={credits}
      />
    </>
  )
}
