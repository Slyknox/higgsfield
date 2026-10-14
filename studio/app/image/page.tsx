import type { Metadata } from "next"

import { GeneratorRoute } from "@/components/site/generator-route"
import { TopNav } from "@/components/site/top-nav"
import { NoModels } from "@/components/studio/no-models"
import { MODELS } from "@/generation/catalog"
import { BRAND } from "@/lib/site/brand"

export const metadata: Metadata = {
  title: `AI Image Generator · ${BRAND.name}`,
}

export default function Page() {
  if (!MODELS.some((m) => m.surface === "image")) return <NoModels />
  return (
    <>
      <TopNav />
      <GeneratorRoute surface="image" />
    </>
  )
}
