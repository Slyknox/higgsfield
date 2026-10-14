"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import type { ComponentProps } from "react"

import type { StudioPromptBox } from "@/components/studio/studio-prompt-box"
import type { TemplateItem } from "@/components/studio/template-picker"
import { MODELS, getModel, parseSettings } from "@/generation/catalog"
import type {
  GenerationPlane,
  MediaItem,
  MediaRole,
  ModelEntry,
  Surface,
} from "@/generation/catalog"
import {
  changeImageRole,
  groupMedia,
  inferInputMode,
  inputRoles,
  mergeMedia,
  mergeReferences,
} from "@/generation/catalog/media-inputs"
import { useActive } from "@/generation/stores/active"
import { useSettings } from "@/generation/stores/settings"
import { toPlatform } from "@/generation/to-platform"
import {
  runToGalleryItems,
  runToLibraryItems,
} from "@/lib/studio/gallery-items"
import {
  uploadAsset,
  useUploads,
  type AssetSelection,
} from "@/lib/studio/uploads"
import { useRuns } from "@/lib/studio/use-runs"

export type DockProps = Omit<
  ComponentProps<typeof StudioPromptBox>,
  "className" | "skin"
>

type SubmittedRun = NonNullable<
  Awaited<ReturnType<ReturnType<typeof useRuns>["submit"]>>
>

export interface UseStudioDockOptions {
  /** Model to select when mounted or when it changes (e.g. from `?model=`). */
  initialModel?: string
  /** Surface the route is for; switches to its first model when the active one differs. */
  routeSurface?: Surface
  /** Called when the user picks a model (picker, surface rail, template). */
  onUserModelChange?: (model: ModelEntry) => void
  /** Project new generations belong to. */
  projectId?: string
  /** Called after a run was accepted by the platform. */
  onSubmitted?: (run: SubmittedRun) => void
}

/**
 * The prompt dock's state and actions: active model and settings, prompt,
 * attachments, validation, generate and cancel. Shared by
 * every layout that generates, so they never fork the dock logic.
 */
export function useStudioDock({
  initialModel,
  routeSurface,
  onUserModelChange,
  projectId,
  onSubmitted,
}: UseStudioDockOptions = {}) {
  const [prompt, setPrompt] = useState("")
  const [media, setMedia] = useState<MediaItem[]>([])
  const [canceling, setCanceling] = useState(false)
  const [localError, setLocalError] = useState<string | null>(null)

  const surface = useActive((s) => s.surface)
  const modelId = useActive((s) => s.model)
  const setActiveModel = useActive((s) => s.setModel)
  const settingsByModel = useSettings((s) => s.byModel)
  const setSetting = useSettings((s) => s.set)
  const uploads = useUploads((s) => s.items)
  const runs = useRuns()

  const surfaces = useMemo(
    () =>
      (["video", "image"] as Surface[]).filter((s) =>
        MODELS.some((m) => m.surface === s)
      ),
    []
  )
  const models = useMemo(
    () => MODELS.filter((m) => m.surface === surface),
    [surface]
  )
  const model = useMemo(() => {
    try {
      return getModel(modelId)
    } catch {
      return models[0] ?? MODELS[0]!
    }
  }, [modelId, models])
  const settings = useMemo(
    () => settingsByModel[model.id] ?? {},
    [settingsByModel, model.id]
  )
  const inputMode = inferInputMode(model, media)
  const prepared = useMemo(() => {
    try {
      const plane: GenerationPlane = {
        model: model.id,
        inputMode,
        prompt: { text: prompt.trim() },
        media: groupMedia(media),
        settings: parseSettings(model, settings),
      }
      toPlatform(plane)
      return { plane, error: null }
    } catch (caught) {
      return {
        plane: null,
        error: caught instanceof Error ? caught.message : String(caught),
      }
    }
  }, [inputMode, media, model, prompt, settings])

  // The URL picks the model: an explicit model wins, else the route's surface.
  useEffect(() => {
    if (initialModel && MODELS.some((m) => m.id === initialModel)) {
      setActiveModel(initialModel)
      return
    }
    if (routeSurface && useActive.getState().surface !== routeSurface) {
      const first = MODELS.find((m) => m.surface === routeSurface)
      if (first) setActiveModel(first.id)
    }
  }, [initialModel, routeSurface, setActiveModel])

  const pickModel = useCallback(
    (id: string) => {
      setLocalError(null)
      setActiveModel(id)
      onUserModelChange?.(getModel(id))
    },
    [onUserModelChange, setActiveModel]
  )

  const galleryItems = useMemo(
    () => runs.records.flatMap(runToGalleryItems),
    [runs.records]
  )
  const libraryItems = useMemo(
    () => [...uploads, ...runs.records.flatMap(runToLibraryItems)],
    [runs.records, uploads]
  )

  const generating = runs.running.length > 0
  const canGenerate =
    prepared.plane !== null && (prompt.trim().length > 0 || media.length > 0)
  const missingRequiredInput =
    model.requiredRoles?.some(
      (role) => !media.some((item) => item.role === role)
    ) ||
    (model.requirePrompt && !prompt.trim())

  const generate = useCallback(() => {
    if (!canGenerate || generating || !prepared.plane) return
    setLocalError(null)
    void runs.submit(prepared.plane, projectId).then((record) => {
      if (record) onSubmitted?.(record)
    })
  }, [canGenerate, generating, onSubmitted, prepared.plane, projectId, runs])

  const cancel = useCallback(() => {
    if (!generating || canceling) return
    setCanceling(true)
    void Promise.all(runs.running.map((r) => runs.cancel(r.id))).finally(() =>
      setCanceling(false)
    )
  }, [canceling, generating, runs])

  // setModel derives the surface from the model, so switching surface = picking its first model.
  const changeSurface = useCallback(
    (next: Surface) => {
      const first = MODELS.find((m) => m.surface === next)
      if (first) pickModel(first.id)
    },
    [pickModel]
  )

  const applyTemplate = (t: TemplateItem) => {
    setPrompt(t.prompt)
    if (t.modelId && MODELS.some((m) => m.id === t.modelId)) {
      const target = getModel(t.modelId)
      pickModel(target.id)
      if (t.settings) setSetting(target.id, t.settings)
    } else if (t.kind !== surface && surfaces.includes(t.kind)) {
      changeSurface(t.kind)
    }
  }

  const dock: DockProps = {
    surfaces,
    surface,
    onSurfaceChange: changeSurface,
    models,
    model,
    onModelChange: pickModel,
    settings,
    onSettingChange: (key, value) => setSetting(model.id, { [key]: value }),
    inputMode,
    media,
    onMediaAdd: (role: MediaRole | "auto", selection: AssetSelection[]) => {
      const selected = selection.map((item) => ({
        id: item.id,
        url: item.src,
        kind: item.kind,
        name: item.name,
      }))
      const roles = inputRoles(model, inputMode)
      const next =
        role === "auto"
          ? mergeReferences(media, selected, roles)
          : mergeMedia(
              media,
              role,
              selected.map((item) => ({ ...item, role })),
              roles[role] ?? 0
            )
      setLocalError(null)
      setMedia(next)
    },
    onMediaRemove: (id) => {
      setLocalError(null)
      setMedia((current) => current.filter((item) => item.id !== id))
    },
    onMediaRoleChange: (id, role) => {
      try {
        setMedia(changeImageRole(model, media, id, role))
        setLocalError(null)
      } catch (caught) {
        setLocalError(
          caught instanceof Error
            ? caught.message
            : "Could not change the image role."
        )
      }
    },
    library: { items: libraryItems, onUpload: uploadAsset },
    prompt,
    onPromptChange: setPrompt,
    onGenerate: generate,
    onCancel: cancel,
    generating,
    canceling,
    generateDisabled: !canGenerate,
    disabledReason: prepared.error ?? undefined,
    error:
      localError ??
      runs.error ??
      (!missingRequiredInput && media.length > 0 ? prepared.error : null) ??
      undefined,
  }

  return {
    dock,
    runs,
    galleryItems,
    libraryItems,
    applyTemplate,
  }
}
