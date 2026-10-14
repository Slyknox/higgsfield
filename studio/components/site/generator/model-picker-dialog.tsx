"use client"

import { useMemo, useState, type ReactElement } from "react"
import { Search } from "lucide-react"

import { Badge } from "@/components/site/badge"
import { ModelGlyph } from "@/components/site/model-glyph"
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import type { ModelEntry } from "@/generation/catalog"
import { familyOf } from "@/lib/site/model-modes"
import { modelMeta } from "@/lib/site/model-meta"
import { cn } from "@/lib/utils"

/** Searchable model grid grouped by provider family. */
export function ModelPickerDialog({
  models,
  activeId,
  onSelect,
  trigger,
  title = "Choose a model",
}: {
  models: readonly ModelEntry[]
  activeId: string
  onSelect: (id: string) => void
  trigger: ReactElement
  title?: string
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase()
    const map = new Map<string, ModelEntry[]>()
    for (const model of models) {
      const meta = modelMeta(model)
      const family = familyOf(model)
      if (
        q &&
        ![model.label, family, meta.description].some((t) =>
          t.toLowerCase().includes(q)
        )
      )
        continue
      map.set(family, [...(map.get(family) ?? []), model])
    }
    return [...map.entries()]
  }, [models, query])

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) setQuery("")
      }}
    >
      <DialogTrigger render={trigger} />
      <DialogContent size="xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <DialogBody>
          <div className="flex flex-col gap-5">
            <div className="relative">
              <Search
                aria-hidden
                className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-q-icon-secondary"
              />
              <Input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search models"
                aria-label="Search models"
                className="pl-9"
              />
            </div>
            <div className="flex max-h-[60vh] flex-col gap-5 overflow-y-auto pr-1">
              {groups.length === 0 ? (
                <p className="py-8 text-center text-q-body-sm-regular text-q-text-secondary">
                  No models match “{query}”.
                </p>
              ) : null}
              {groups.map(([family, entries]) => (
                <section
                  key={family}
                  aria-label={family}
                  className="flex flex-col gap-2"
                >
                  <h3 className="text-q-caption-sm-medium text-q-text-secondary">
                    {family}
                  </h3>
                  <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {entries.map((model) => {
                      const meta = modelMeta(model)
                      const active = model.id === activeId
                      return (
                        <li key={model.id}>
                          <button
                            type="button"
                            aria-pressed={active}
                            onClick={() => {
                              onSelect(model.id)
                              setOpen(false)
                              setQuery("")
                            }}
                            className={cn(
                              "flex w-full items-center gap-3 rounded-xl border p-2.5 text-left transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                              active
                                ? "border-primary/60 bg-primary/10"
                                : "border-white/5 bg-white/[0.03] hover:border-white/15 hover:bg-white/[0.06]"
                            )}
                          >
                            <ModelGlyph model={model} />
                            <span className="flex min-w-0 flex-col">
                              <span className="flex items-center gap-2 text-q-body-sm-medium">
                                <span className="truncate">{model.label}</span>
                                {meta.badge ? (
                                  <Badge>{meta.badge}</Badge>
                                ) : null}
                              </span>
                              <span className="line-clamp-2 text-q-caption-sm-regular text-q-text-secondary">
                                {meta.description}
                              </span>
                            </span>
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                </section>
              ))}
            </div>
          </div>
        </DialogBody>
      </DialogContent>
    </Dialog>
  )
}
