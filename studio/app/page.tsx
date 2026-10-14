import { ExplorePage } from "@/components/site/explore/explore-page"
import { SiteHeader } from "@/components/site/site-header"
import { NoModels } from "@/components/studio/no-models"
import { MODELS } from "@/generation/catalog"

export default function Page() {
  if (MODELS.length === 0) return <NoModels />
  return (
    <>
      <SiteHeader />
      <ExplorePage />
    </>
  )
}
