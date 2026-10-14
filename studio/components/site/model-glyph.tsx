/* eslint-disable @next/next/no-img-element -- Static SVG logos do not need an image proxy. */
import { Clapperboard, ImageIcon } from "lucide-react"

import type { ModelEntry } from "@/generation/catalog"
import { cn } from "@/lib/utils"

/** A model's provider logo on a raised square tile. */
export function ModelGlyph({
  model,
  className,
}: {
  model: Pick<ModelEntry, "icon" | "surface">
  className?: string
}) {
  const Fallback = model.surface === "image" ? ImageIcon : Clapperboard
  return (
    <span
      className={cn(
        "inline-flex size-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5",
        className
      )}
    >
      {model.icon ? (
        <img
          src={`/model-icons/${model.icon}.svg`}
          alt=""
          className="size-1/2 brightness-0 invert"
        />
      ) : (
        <Fallback aria-hidden className="size-1/2 text-muted-foreground" />
      )}
    </span>
  )
}
