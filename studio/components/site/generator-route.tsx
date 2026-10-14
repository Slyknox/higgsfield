"use client"

import { Suspense, useCallback } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"

import { TOP_NAV_HEIGHT } from "@/components/site/top-nav"
import { MODELS, type ModelEntry, type Surface } from "@/generation/catalog"
import { GeneratorTemplate } from "@/layouts/generator"
import { StudioTemplate } from "@/layouts/studio"
import { resolveModelParam } from "@/lib/site/model-query"

const HEADLINES: Record<Surface, string> = {
  video: "Make videos in one click",
  image: "Create images from any idea",
}

function GeneratorInner({
  surface,
  initialView,
}: {
  surface?: Surface
  initialView: "home" | "all"
}) {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const model = resolveModelParam(MODELS, params.get("model"), surface)

  // Keep the address bar shareable: /video?model=<id> always names the model in use.
  const onUserModelChange = useCallback(
    (next: ModelEntry) => {
      const target = surface ? `/${next.surface}` : pathname
      router.replace(`${target}?model=${encodeURIComponent(next.id)}`, {
        scroll: false,
      })
    },
    [pathname, router, surface]
  )

  const shell = "h-[calc(100dvh-var(--top-nav))]"
  if (surface)
    return (
      <GeneratorTemplate
        surface={surface}
        headline={HEADLINES[surface]}
        initialModel={model?.id}
        onUserModelChange={onUserModelChange}
        className={shell}
      />
    )
  return (
    <StudioTemplate
      title="Studio"
      initialModel={model?.id}
      initialView={initialView}
      onUserModelChange={onUserModelChange}
      className={shell}
    />
  )
}

/** A studio page under the top nav: /image, /video or /assets. */
export function GeneratorRoute({
  surface,
  initialView = "home",
}: {
  surface?: Surface
  initialView?: "home" | "all"
}) {
  return (
    <div style={{ ["--top-nav" as string]: `${TOP_NAV_HEIGHT}px` }}>
      <Suspense>
        <GeneratorInner surface={surface} initialView={initialView} />
      </Suspense>
    </div>
  )
}
