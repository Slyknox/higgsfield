"use client"

import Link from "next/link"
import { useState } from "react"
import { Clapperboard, ImageIcon, ImagePlus } from "lucide-react"

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  EFFECT_CATEGORIES,
  effectHref,
  type Effect,
  type EffectCategory,
} from "@/lib/site/effects"

type Filter = "All" | EffectCategory

/** The Effects grid with category tabs. Each card opens the generator filled in. */
export function EffectsGallery({ effects }: { effects: Effect[] }) {
  const [filter, setFilter] = useState<Filter>("All")
  const categories = EFFECT_CATEGORIES.filter((c) =>
    effects.some((e) => e.category === c)
  )
  const shown =
    filter === "All" ? effects : effects.filter((e) => e.category === filter)
  return (
    <div className="flex flex-col gap-6">
      <Tabs
        variant="segmented"
        shape="pill"
        value={filter}
        onValueChange={(v) => setFilter(v as Filter)}
      >
        <TabsList aria-label="Effect categories">
          {(["All", ...categories] as Filter[]).map((c) => (
            <TabsTrigger key={c} value={c}>
              {c}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {shown.map((e) => {
          const Kind = e.surface === "video" ? Clapperboard : ImageIcon
          return (
            <li key={e.id}>
              <Link
                href={effectHref(e)}
                className="group flex flex-col gap-3 rounded-2xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <span
                  className="relative flex aspect-[4/3] items-end overflow-hidden rounded-2xl border border-white/5 p-4 transition-transform duration-300 group-hover:-translate-y-0.5 motion-reduce:group-hover:translate-y-0"
                  style={{ backgroundImage: e.art }}
                >
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-black/40 px-2.5 py-1 text-q-caption-sm-medium backdrop-blur">
                    <Kind aria-hidden className="size-3.5" />
                    {e.surface === "video" ? "Video" : "Image"}
                    {e.input === "photo" ? (
                      <>
                        <span aria-hidden>·</span>
                        <ImagePlus aria-hidden className="size-3.5" />
                        Your photo
                      </>
                    ) : null}
                  </span>
                </span>
                <span className="flex flex-col gap-0.5 px-1">
                  <span className="text-q-body-md-medium">{e.title}</span>
                  <span className="text-q-body-sm-regular text-q-text-secondary">
                    {e.description}
                  </span>
                </span>
              </Link>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
