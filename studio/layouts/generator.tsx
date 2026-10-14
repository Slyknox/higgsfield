"use client"

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
} from "react"
import Link from "next/link"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import {
  ArrowLeftRight,
  ImagePlus,
  ListVideo,
  Lightbulb,
  SlidersHorizontal,
  Sparkles,
  WandSparkles,
  type LucideIcon,
} from "lucide-react"

import { Badge } from "@/components/site/badge"
import { ModelPickerDialog } from "@/components/site/generator/model-picker-dialog"
import { ModelGlyph } from "@/components/site/model-glyph"
import { PromptBox } from "@/components/studio/prompt-box"
import {
  SettingsDialog,
  settingLabel,
} from "@/components/studio/settings-dialog"
import {
  MediaInputs,
  PillSelect,
  ReferencePicker,
  headlineSetting,
} from "@/components/studio/studio-prompt-box"
import { UserGenerations } from "@/components/studio/user-generations"
import { Button } from "@/components/ui/button"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { ModelEntry, Surface } from "@/generation/catalog"
import { modelArt } from "@/lib/site/model-art"
import { modelMeta } from "@/lib/site/model-meta"
import {
  modeLabel,
  modeOf,
  modesFor,
  type ModeId,
} from "@/lib/site/model-modes"
import { priceOf } from "@/lib/billing/pricing"
import { findEffect } from "@/lib/site/effects"
import { saveDraft, takeDraft } from "@/lib/studio/draft"
import { useCredits, type Credits } from "@/lib/studio/use-credits"
import { useStudioDock } from "@/lib/studio/use-studio-dock"
import { cn } from "@/lib/utils"

const PLACEHOLDER: Record<Surface, string> = {
  video: "Describe the scene: subject, motion, camera and mood",
  image: "Describe the image: subject, setting, light and style",
}

type Step = { icon: LucideIcon; title: string; description: string }

const STEPS: Record<Surface, Step[]> = {
  video: [
    {
      icon: ImagePlus,
      title: "Add an image or describe a scene",
      description:
        "Start from text, a first and last frame, or reference images, video and audio.",
    },
    {
      icon: SlidersHorizontal,
      title: "Pick a model and settings",
      description:
        "Choose the model, duration, aspect ratio and resolution that fit the shot.",
    },
    {
      icon: Sparkles,
      title: "Generate your video",
      description:
        "It appears in History. Cancel it any time while it's still queued.",
    },
  ],
  image: [
    {
      icon: ImagePlus,
      title: "Describe it or add references",
      description:
        "Write what you want, and add reference images to steer the style.",
    },
    {
      icon: SlidersHorizontal,
      title: "Pick a model and settings",
      description: "Choose the model, aspect ratio and resolution.",
    },
    {
      icon: Sparkles,
      title: "Generate your image",
      description: "Results land in History, ready to download or reuse.",
    },
  ],
}

function HowItWorks({ surface }: { surface: Surface }) {
  return (
    <ol className="grid w-full max-w-[880px] grid-cols-1 gap-3 md:grid-cols-3">
      {STEPS[surface].map((step, i) => (
        <li
          key={step.title}
          className="flex flex-col gap-3 rounded-2xl border border-white/5 bg-white/[0.03] p-5"
        >
          <span className="flex items-center gap-2">
            <span className="inline-flex size-7 items-center justify-center rounded-full bg-white/5 text-q-caption-sm-semi-bold">
              {i + 1}
            </span>
            <step.icon aria-hidden className="size-4 text-q-icon-secondary" />
          </span>
          <span className="text-q-body-sm-medium">{step.title}</span>
          <span className="text-q-caption-sm-regular text-q-text-secondary">
            {step.description}
          </span>
        </li>
      ))}
    </ol>
  )
}

function ModelCard({
  model,
  mode,
  surface,
  choices,
  onSelect,
}: {
  model: ModelEntry
  mode: ModeId
  surface: Surface
  choices: readonly ModelEntry[]
  onSelect: (id: string) => void
}) {
  const meta = modelMeta(model)
  return (
    <div
      className="relative flex flex-col gap-3 overflow-hidden rounded-2xl border border-white/5 p-4"
      style={{ backgroundImage: modelArt(model) }}
    >
      <div className="flex items-start justify-between gap-3">
        <ModelGlyph model={model} className="bg-black/30 backdrop-blur" />
        <ModelPickerDialog
          models={choices}
          activeId={model.id}
          onSelect={onSelect}
          title={`${modeLabel(surface, mode)} models`}
          trigger={
            <Button
              variant="secondary"
              size="sm"
              className="bg-black/40 backdrop-blur hover:bg-black/60"
            >
              <ArrowLeftRight aria-hidden />
              Change
            </Button>
          }
        />
      </div>
      <div className="flex flex-col gap-1">
        <span className="flex items-center gap-2 text-[11px] font-semibold tracking-wider text-white/70 uppercase">
          {modeLabel(surface, mode)}
          {meta.badge ? <Badge>{meta.badge}</Badge> : null}
        </span>
        <span className="text-q-headline-sm-semi-bold">{model.label}</span>
        <span className="text-q-caption-sm-regular text-white/75">
          {meta.description}
        </span>
      </div>
    </div>
  )
}

function Section({
  title,
  children,
  aside,
}: {
  title: string
  children: React.ReactNode
  aside?: React.ReactNode
}) {
  return (
    <section aria-label={title} className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <h2 className="text-q-caption-sm-medium text-q-text-secondary">
          {title}
        </h2>
        {aside}
      </div>
      {children}
    </section>
  )
}

export interface GeneratorTemplateProps {
  surface: Surface
  headline: string
  initialModel?: string
  onUserModelChange?: (model: ModelEntry) => void
  /** Signed-out users are sent to sign in when they press Generate. */
  signedIn: boolean
  /** Balance and markup for pricing Generate; null while billing is off. */
  credits?: Credits
  className?: string
}

/**
 * GeneratorTemplate: the higgsfield.ai-style generator. Left control panel
 * (mode tabs, model card, inputs, prompt, settings, sticky Generate) and a
 * right canvas with this surface's history. Shares dock state with the studio.
 */
export function GeneratorTemplate({
  surface,
  headline,
  initialModel,
  onUserModelChange,
  signedIn,
  credits: initialCredits = null,
  className,
}: GeneratorTemplateProps) {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const [tab, setTab] = useState<"history" | "how">("history")
  const { credits, refresh: refreshCredits } = useCredits(
    initialCredits,
    signedIn
  )
  const { dock, runs, galleryItems } = useStudioDock({
    initialModel,
    routeSurface: surface,
    onUserModelChange,
    onSubmitted: () => {
      setTab("history")
      void refreshCredits()
    },
  })
  const { model, models, settings, onSettingChange } = dock
  const surfaceModels = useMemo(
    () => models.filter((m) => m.surface === surface),
    [models, surface]
  )
  const modes = modesFor(surfaceModels)
  const mode = modeOf(model)
  const choices = surfaceModels.filter((m) => modeOf(m) === mode)
  const items = useMemo(
    () => galleryItems.filter((i) => i.kind === surface),
    [galleryItems, surface]
  )

  const headlineKey = headlineSetting(model)
  const pills = [headlineKey, "resolution"]
    .filter((k, i, all): k is string => !!k && all.indexOf(k) === i)
    .filter((k) => model.settings[k]?.type === "enum")
  const mediaProps = {
    model,
    inputMode: dock.inputMode,
    media: dock.media,
    onMediaAdd: dock.onMediaAdd,
    onMediaRemove: dock.onMediaRemove,
    onMediaRoleChange: dock.onMediaRoleChange,
    library: dock.library,
  }
  const { onPromptChange, onSettingChange: changeSetting } = dock
  // An effect link (/video?model=…&effect=…) fills in its prompt and settings
  // once. The model already comes from ?model=. Declared before the draft
  // restore, so a prompt typed before signing in still wins.
  const effect = findEffect(params.get("effect"))
  const activeEffect =
    effect && effect.modelId === model.id && effect.surface === surface
      ? effect
      : undefined
  const appliedEffect = useRef<string | null>(null)
  useEffect(() => {
    if (!activeEffect || appliedEffect.current === activeEffect.id) return
    appliedEffect.current = activeEffect.id
    onPromptChange(activeEffect.prompt)
    for (const [key, value] of Object.entries(activeEffect.settings ?? {}))
      changeSetting(key, value)
  }, [activeEffect, onPromptChange, changeSetting])
  // Bring back the prompt typed before the sign-in detour.
  useEffect(() => {
    const draft = takeDraft(surface)
    if (draft) onPromptChange(draft)
  }, [surface, onPromptChange])

  const generate = useCallback(() => {
    if (!signedIn) {
      saveDraft(surface, dock.prompt)
      const query = params.toString()
      const back = query ? `${pathname}?${query}` : pathname
      router.push(`/login?callbackUrl=${encodeURIComponent(back)}`)
      return
    }
    dock.onGenerate()
  }, [dock, params, pathname, router, signedIn, surface])

  const generating = dock.generating ?? false
  const canceling = dock.canceling ?? false
  const price = credits ? priceOf(model, settings, credits.markup) : null

  return (
    <div
      className={cn(
        "flex flex-col overflow-y-auto bg-background md:flex-row md:overflow-hidden",
        className
      )}
    >
      <aside
        aria-label="Generation settings"
        className="flex w-full shrink-0 flex-col border-white/5 md:w-[380px] md:border-r"
      >
        <div className="flex flex-col gap-5 p-4 md:min-h-0 md:flex-1 md:overflow-y-auto">
          {modes.length > 1 ? (
            <Tabs
              variant="segmented"
              shape="pill"
              value={mode}
              onValueChange={(next) => {
                const first = surfaceModels.find((m) => modeOf(m) === next)
                if (first) dock.onModelChange(first.id)
              }}
            >
              <TabsList className="w-full">
                {modes.map((m) => (
                  <TabsTrigger key={m} value={m} className="flex-1">
                    {modeLabel(surface, m)}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          ) : null}

          {activeEffect ? (
            <p className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-q-caption-sm-regular text-q-text-secondary">
              <span className="text-foreground">
                Effect: {activeEffect.title}.
              </span>{" "}
              {activeEffect.input === "photo"
                ? "Add a photo, adjust the prompt if you like, then press Generate."
                : "Adjust the prompt if you like, then press Generate."}
            </p>
          ) : null}

          <ModelCard
            model={model}
            mode={mode}
            surface={surface}
            choices={choices}
            onSelect={dock.onModelChange}
          />

          <Section title="Inputs">
            {/* A row parent: the shared uploads row aligns itself to the end of its container's cross axis. */}
            <div className="flex">
              <MediaInputs tilesOnly {...mediaProps} />
            </div>
            <ReferencePicker
              {...mediaProps}
              trigger={(remaining) => (
                <button
                  type="button"
                  disabled={!remaining}
                  className="flex w-full items-center gap-3 rounded-xl border border-dashed border-white/15 bg-white/[0.02] p-3 text-left transition-colors outline-none hover:border-white/30 hover:bg-white/[0.05] focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-40"
                >
                  <span className="inline-flex size-9 items-center justify-center rounded-lg bg-white/5">
                    <ImagePlus aria-hidden className="size-4" />
                  </span>
                  <span className="flex flex-col">
                    <span className="text-q-body-sm-medium">
                      Add references
                    </span>
                    <span className="text-q-caption-sm-regular text-q-text-secondary">
                      {remaining
                        ? `Image, video or audio · ${remaining} left`
                        : "Reference limit reached"}
                    </span>
                  </span>
                </button>
              )}
            />
            <MediaInputs {...mediaProps} />
          </Section>

          <Section
            title="Prompt"
            aside={
              <span className="text-q-caption-sm-regular text-q-text-secondary tabular-nums">
                {dock.prompt.length}
              </span>
            }
          >
            <textarea
              value={dock.prompt}
              onChange={(e: ChangeEvent<HTMLTextAreaElement>) =>
                dock.onPromptChange(e.target.value)
              }
              onKeyDown={(e) => {
                if (
                  e.key === "Enter" &&
                  (e.metaKey || e.ctrlKey) &&
                  !generating &&
                  !dock.generateDisabled
                ) {
                  e.preventDefault()
                  generate()
                }
              }}
              placeholder={PLACEHOLDER[surface]}
              aria-label="Prompt"
              rows={5}
              className="min-h-28 w-full resize-y rounded-xl border border-white/10 bg-white/[0.03] p-3 text-q-body-sm-regular outline-none placeholder:text-q-text-secondary focus-visible:border-white/25 focus-visible:ring-3 focus-visible:ring-ring/30"
            />
          </Section>

          <Section title="Settings">
            <div className="flex flex-wrap items-center gap-2">
              {pills.map((k) => {
                const field = model.settings[k]
                if (field?.type !== "enum") return null
                return (
                  <PillSelect
                    key={k}
                    label={settingLabel(k)}
                    value={
                      typeof settings[k] === "string"
                        ? (settings[k] as string)
                        : field.default
                    }
                    onValueChange={(value) => onSettingChange(k, value)}
                    options={field.values.map((value) => ({
                      value,
                      label: value,
                    }))}
                  />
                )
              })}
              <SettingsDialog
                model={model}
                values={settings}
                onChange={onSettingChange}
                trigger={
                  <PromptBox.Pill start={<SlidersHorizontal />}>
                    More
                  </PromptBox.Pill>
                }
              />
            </div>
          </Section>
        </div>

        <div className="sticky bottom-0 flex flex-col gap-2 border-t border-white/5 bg-background/95 p-4 backdrop-blur">
          {dock.error != null ? (
            <p
              role="alert"
              className="text-q-caption-sm-medium text-q-state-error-fg"
            >
              {dock.error}
            </p>
          ) : null}
          <button
            type="button"
            onClick={generating ? dock.onCancel : generate}
            disabled={canceling || (!generating && dock.generateDisabled)}
            title={
              !generating && dock.generateDisabled
                ? dock.disabledReason
                : undefined
            }
            className={cn(
              "inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl text-q-label-md-semi-bold uppercase transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-40",
              generating
                ? "bg-white/10 text-foreground hover:bg-white/15"
                : "bg-primary text-primary-foreground hover:bg-primary/85"
            )}
          >
            {generating ? null : (
              <WandSparkles aria-hidden className="size-4" />
            )}
            {canceling ? "Cancelling…" : generating ? "Cancel" : "Generate"}
            {price && !generating ? (
              <span aria-label={`${price.credits} credits`}>
                ✦ {price.credits}
              </span>
            ) : null}
          </button>
          {credits && signedIn ? (
            <p className="text-q-caption-sm-regular text-q-text-secondary">
              {credits.balance.toLocaleString("en-US")} credits left.{" "}
              <Link href="/account" className="underline underline-offset-2">
                Account
              </Link>
            </p>
          ) : null}
          {!generating &&
          dock.generateDisabled &&
          dock.disabledReason &&
          (dock.prompt.trim() || dock.media.length) ? (
            <p className="text-q-caption-sm-regular text-q-text-secondary">
              {dock.disabledReason}
            </p>
          ) : null}
        </div>
      </aside>

      <section
        aria-label="Canvas"
        className="flex min-h-[70vh] min-w-0 flex-1 flex-col md:min-h-0"
      >
        <div className="flex items-center justify-between gap-3 px-4 py-3">
          <Tabs
            variant="segmented"
            shape="pill"
            value={tab}
            onValueChange={(v) => setTab(v as "history" | "how")}
          >
            <TabsList>
              <TabsTrigger value="history" start={<ListVideo />}>
                History
              </TabsTrigger>
              <TabsTrigger value="how" start={<Lightbulb />}>
                How it works
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {tab === "history" && items.length > 0 ? (
          <div className="flex min-h-0 flex-1 flex-col px-4 pb-4">
            <UserGenerations
              items={items}
              title="History"
              onDelete={(item) => runs.remove(item.runId)}
              emptyState={{
                images: [
                  "/covers/abstract-2.svg",
                  "/covers/abstract-1.svg",
                  "/covers/abstract-3.svg",
                ],
                title: "No generations yet",
                description: "Describe an idea on the left, then generate.",
              }}
            />
          </div>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-8 px-4 py-12 text-center">
            <div className="flex flex-col items-center gap-2">
              <h1 className="max-w-[720px] text-q-accent-xl-bold uppercase">
                {headline}
              </h1>
              <p className="text-q-body-sm-regular text-q-text-secondary">
                {tab === "how"
                  ? "Three steps from idea to result."
                  : `Your ${surface === "video" ? "videos" : "images"} will appear here.`}
              </p>
            </div>
            <HowItWorks surface={surface} />
          </div>
        )}
      </section>
    </div>
  )
}
