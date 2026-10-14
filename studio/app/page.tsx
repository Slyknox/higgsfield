import { ExplorePage } from "@/components/site/explore/explore-page"
import { TopNav } from "@/components/site/top-nav"
import { NoModels } from "@/components/studio/no-models"
import { MODELS } from "@/generation/catalog"

export default function Page() {
  if (MODELS.length === 0) return <NoModels />
  return (
    <>
      <TopNav />
      <ExplorePage />
    </>
  )
}
