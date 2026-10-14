"use client"

import Link from "next/link"
import { useState } from "react"
import { Clapperboard, ImageIcon, LayoutGrid } from "lucide-react"

import { Badge } from "@/components/site/badge"
import { ModelGlyph } from "@/components/site/model-glyph"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { MODELS, type Surface } from "@/generation/catalog"
import { modelMeta } from "@/lib/site/model-meta"

type Filter = "all" | Surface

/** Every installed model as a card linking into its generator. */
export function ModelDirectory() {
  const [filter, setFilter] = useState<Filter>("all")
  const models = MODELS.filter((m) => filter === "all" || m.surface === filter)

  return (
    <section aria-labelledby="models-heading" className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h2 id="models-heading" className="text-q-headline-md-semi-bold">
            Every model, one studio
          </h2>
          <p className="text-q-body-sm-regular text-q-text-secondary">
            {MODELS.length} image and video models. Pick one to start creating.
          </p>
        </div>
        <Tabs
          variant="segmented"
          shape="pill"
          value={filter}
          onValueChange={(v) => setFilter(v as Filter)}
        >
          <TabsList>
            <TabsTrigger value="all" start={<LayoutGrid />}>
              All models
            </TabsTrigger>
            <TabsTrigger value="image" start={<ImageIcon />}>
              Image
            </TabsTrigger>
            <TabsTrigger value="video" start={<Clapperboard />}>
              Video
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {models.map((m) => {
          const meta = modelMeta(m)
          return (
            <li key={m.id}>
              <Link
                href={`/${m.surface}?model=${encodeURIComponent(m.id)}`}
                className="flex h-full items-center gap-3 rounded-2xl border border-white/5 bg-white/[0.03] p-3 outline-none transition-colors hover:border-white/15 hover:bg-white/[0.06] focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <ModelGlyph model={m} />
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className="flex items-center gap-2 text-q-body-sm-medium">
                    <span className="truncate">{m.label}</span>
                    {meta.badge ? <Badge>{meta.badge}</Badge> : null}
                  </span>
                  <span className="line-clamp-2 text-q-caption-sm-regular text-q-text-secondary">
                    {meta.description}
                  </span>
                </span>
                <span className="ml-auto shrink-0 rounded-full border border-white/10 px-2 py-0.5 text-[11px] text-q-text-secondary capitalize">
                  {m.surface}
                </span>
              </Link>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
