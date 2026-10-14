import type { Metadata } from "next"

import { EffectsGallery } from "@/components/site/effects/effects-gallery"
import { SiteHeader } from "@/components/site/site-header"
import { MODELS } from "@/generation/catalog"
import { BRAND } from "@/lib/site/brand"
import { availableEffects } from "@/lib/site/effects"

export const metadata: Metadata = {
  title: `Effects · ${BRAND.name}`,
  description: "Ready-made camera moves, product shots, portraits and styles.",
}

export default function EffectsPage() {
  const effects = availableEffects(MODELS)
  return (
    <>
      <SiteHeader />
      <main className="mx-auto flex w-full max-w-[1600px] flex-col gap-6 px-4 pt-8 pb-16 md:px-6">
        <div className="flex flex-col gap-2">
          <h1 className="text-q-headline-md-semi-bold">Effects</h1>
          <p className="max-w-2xl text-q-body-sm-regular text-q-text-secondary">
            Pick an effect to open the generator with the model, prompt and
            settings filled in. Change anything you like before you generate.
          </p>
        </div>
        {effects.length ? (
          <EffectsGallery effects={effects} />
        ) : (
          <p className="text-q-body-sm-regular text-q-text-secondary">
            No effects are available right now.
          </p>
        )}
      </main>
    </>
  )
}
