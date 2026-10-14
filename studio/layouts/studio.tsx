"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Compass, Folder } from "lucide-react"

import { StudioPromptBox } from "@/components/studio/studio-prompt-box"
import {
  ExamplePresets,
  TEMPLATES,
  type TemplateItem,
} from "@/components/studio/template-picker"
import { HeroComposition } from "@/components/studio/hero-composition"
import {
  MyProjects,
  type MyProjectsProject,
} from "@/components/studio/my-projects"
import { StudioSidebar, type StudioView } from "@/components/studio/sidebar"
import { UserGenerations } from "@/components/studio/user-generations"
import type { GalleryItem } from "@/components/studio/gallery/gallery-types"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { ModelEntry, Surface } from "@/generation/catalog"
import { useProjects } from "@/lib/studio/projects"
import { useStudioDock, type DockProps } from "@/lib/studio/use-studio-dock"
import { cn } from "@/lib/utils"

/**
 * StudioTemplate — the full creative workspace: projects-first sidebar, hero,
 * the floating prompt dock, Explore / My Projects, and the edge-to-edge
 * generations feed. Generation goes through the model catalog and the
 * platform server actions; history and projects live in the browser.
 *
 * Keep the six structural parts when adapting (see AGENTS.md): sidebar,
 * glow + dot-field atmosphere, HeroComposition, StudioPromptBox, the
 * Explore / My Projects section, and the UserGenerations feed.
 */

// Abstract covers in the site palette, replaced by the user's own outputs once there are three.
const HERO_FALLBACKS = [
  "/covers/abstract-2.svg",
  "/covers/abstract-1.svg",
  "/covers/abstract-3.svg",
] as const

const HERO_GLOW =
  "radial-gradient(60% 80% at 50% 0%, rgba(160,164,170,0.14) 0%, rgba(160,164,170,0.05) 42%, transparent 72%)"
const HERO_DOTS = "radial-gradient(rgba(255,255,255,0.2) 1px, transparent 1px)"
const HERO_DOTS_MASK =
  "radial-gradient(55% 70% at 50% 0%, #000 0%, rgba(0,0,0,0.35) 45%, transparent 75%)"

function heroImages(items: GalleryItem[]): readonly [string, string, string] {
  const ready = items
    .filter((i) => i.status === "ready" && i.src !== "")
    .slice(0, 3)
    .map((i) => i.src)
  return [
    ready[0] ?? HERO_FALLBACKS[0],
    ready[1] ?? HERO_FALLBACKS[1],
    ready[2] ?? HERO_FALLBACKS[2],
  ]
}

function HomeState({
  title,
  items,
  projects,
  dock,
  onCreateProject,
  onOpenAll,
  onOpenProject,
  onUseTemplate,
}: {
  title: string
  items: GalleryItem[]
  projects: MyProjectsProject[]
  dock: DockProps
  onCreateProject: (name: string) => void
  onOpenAll: () => void
  onOpenProject: (project: MyProjectsProject) => void
  onUseTemplate: (template: TemplateItem) => void
}) {
  const [tab, setTab] = useState("explore")
  const promptRef = useRef<HTMLDivElement>(null)
  const images = useMemo(() => heroImages(items), [items])

  return (
    <div className="relative flex min-h-0 flex-1 flex-col items-center overflow-y-auto">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[600px]"
        style={{
          backgroundImage: HERO_DOTS,
          backgroundSize: "14px 14px",
          maskImage: HERO_DOTS_MASK,
          WebkitMaskImage: HERO_DOTS_MASK,
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[600px]"
        style={{ backgroundImage: HERO_GLOW }}
      />

      <div className="relative flex w-full flex-col items-center gap-12 px-6 pt-16 pb-16">
        <div
          ref={promptRef}
          className="flex w-full min-w-0 flex-col items-center gap-8"
        >
          <div className="flex flex-col items-center gap-5">
            <HeroComposition images={images} alt="Recent Studio outputs" />
            <h1 className="max-w-[640px] text-center text-q-accent-lg-bold uppercase">
              {title}
            </h1>
          </div>
          <StudioPromptBox {...dock} />
        </div>

        <div className="flex w-full max-w-[900px] flex-col items-start gap-5">
          <Tabs
            variant="segmented"
            shape="pill"
            value={tab}
            onValueChange={(v) => setTab(String(v))}
          >
            <TabsList>
              <TabsTrigger value="explore" start={<Compass />}>
                Explore
              </TabsTrigger>
              <TabsTrigger value="projects" start={<Folder />}>
                My Projects
              </TabsTrigger>
            </TabsList>
          </Tabs>
          <div key={tab} className="w-full animate-in duration-300 fade-in-0">
            {tab === "projects" ? (
              <MyProjects
                projects={projects}
                generations={items}
                onCreateProject={onCreateProject}
                onOpenAllGenerations={onOpenAll}
                onOpenProject={onOpenProject}
              />
            ) : (
              <ExamplePresets
                items={TEMPLATES}
                onUse={(t) => {
                  onUseTemplate(t)
                  promptRef.current?.scrollIntoView({
                    behavior: "smooth",
                    block: "center",
                  })
                }}
                className="w-full"
              />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function FeedState({
  items,
  previewItems,
  title,
  dock,
  onDelete,
}: {
  items: GalleryItem[]
  previewItems: GalleryItem[]
  title: string
  dock: DockProps
  onDelete: (item: GalleryItem) => void
}) {
  const images = useMemo(() => heroImages(previewItems), [previewItems])
  const dockRef = useRef<HTMLDivElement>(null)
  const [dockHeight, setDockHeight] = useState(180)
  useEffect(() => {
    const node = dockRef.current
    if (!node) return
    const observer = new ResizeObserver(() =>
      setDockHeight(node.getBoundingClientRect().height)
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [])
  return (
    <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
      <div
        className="flex min-h-0 flex-1 flex-col px-4 pt-4"
        style={{ paddingBottom: dockHeight + 24 }}
      >
        <UserGenerations
          items={items}
          title={title}
          onDelete={onDelete}
          emptyState={{
            images,
            title:
              title === "All Generations"
                ? "No generations yet"
                : `No generations in ${title}`,
            description:
              "Describe an idea below, then generate the first result.",
          }}
        />
      </div>
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center px-4 pt-24 pb-4"
        style={{
          backgroundImage:
            "linear-gradient(to bottom, transparent 0%, var(--background) 100%)",
        }}
      >
        <div ref={dockRef} className="w-full max-w-[900px]">
          <StudioPromptBox
            {...dock}
            skin="glass"
            className="pointer-events-auto w-full"
          />
        </div>
      </div>
    </div>
  )
}

export interface StudioTemplateProps {
  /** Product name in the sidebar header. */
  title?: string
  /** Hero headline above the dock. */
  headline?: string
  /** Model to select when mounted or when it changes (e.g. from `?model=`). */
  initialModel?: string
  /** Surface the route is for; switches to its first model when the active one differs. */
  routeSurface?: Surface
  /** Starting view: the Home hero or the full generations feed. */
  initialView?: "home" | "all"
  /** Called when the user picks a model (picker, surface rail, template). */
  onUserModelChange?: (model: ModelEntry) => void
  /** Height of the shell; defaults to the full viewport. */
  className?: string
}

export function StudioTemplate({
  title = "Studio",
  headline = "Turn any idea into images and video",
  initialModel,
  routeSurface,
  initialView = "home",
  onUserModelChange,
  className,
}: StudioTemplateProps) {
  const [view, setView] = useState<StudioView>({ kind: initialView })
  const [collapsed, setCollapsed] = useState(false)
  const projectsStore = useProjects()
  const loadProjects = useProjects((s) => s.load)
  useEffect(() => {
    void loadProjects()
  }, [loadProjects])
  const projectId = view.kind === "project" ? view.projectId : undefined

  const { dock, runs, galleryItems, applyTemplate } = useStudioDock({
    initialModel,
    routeSurface,
    onUserModelChange,
    projectId,
    onSubmitted: () => {
      if (view.kind === "home") setView({ kind: "all" })
      if (projectId) projectsStore.touch(projectId)
    },
  })
  const handleUseTemplate = applyTemplate

  const byProject = useMemo(() => {
    const map = new Map<string, GalleryItem[]>()
    for (const item of galleryItems) {
      if (!item.projectId) continue
      map.set(item.projectId, [...(map.get(item.projectId) ?? []), item])
    }
    return map
  }, [galleryItems])
  const projects = useMemo<MyProjectsProject[]>(
    () =>
      projectsStore.projects.map((p) => {
        const items = byProject.get(p.id) ?? []
        const cover = items.find(
          (i) => i.status === "ready" && i.src !== ""
        )?.src
        return {
          id: p.id,
          name: p.name,
          generationCount: new Set(items.map((i) => i.runId)).size,
          updatedAt: p.updatedAt,
          ...(cover ? { cover } : {}),
        }
      }),
    [byProject, projectsStore.projects]
  )
  const selectedProject =
    view.kind === "project"
      ? projects.find((p) => p.id === view.projectId)
      : undefined
  const visibleItems =
    view.kind === "project"
      ? (byProject.get(view.projectId) ?? [])
      : galleryItems

  return (
    <div
      className={cn("flex h-dvh overflow-hidden bg-background", className)}
    >
      <StudioSidebar
        title={title}
        view={view}
        onViewChange={setView}
        projects={projects}
        onCreateProject={(name) =>
          setView({ kind: "project", projectId: projectsStore.create(name).id })
        }
        onRenameProject={(id, name) => projectsStore.rename(id, name)}
        onDeleteProject={(id) => {
          projectsStore.remove(id)
          if (view.kind === "project" && view.projectId === id)
            setView({ kind: "all" })
        }}
        collapsed={collapsed}
        onCollapsedChange={setCollapsed}
      />
      <main className="relative flex min-w-0 flex-1 flex-col">
        {projectsStore.error ? (
          <p
            role="alert"
            className="mx-4 mt-3 rounded-lg bg-white/5 px-3 py-2 text-q-caption-sm-medium text-q-state-error-fg"
          >
            {projectsStore.error}
          </p>
        ) : null}
        {view.kind === "home" ? (
          <HomeState
            title={headline}
            items={galleryItems}
            projects={projects}
            dock={dock}
            onCreateProject={(name) =>
              setView({
                kind: "project",
                projectId: projectsStore.create(name).id,
              })
            }
            onOpenAll={() => setView({ kind: "all" })}
            onOpenProject={(p) => setView({ kind: "project", projectId: p.id })}
            onUseTemplate={handleUseTemplate}
          />
        ) : (
          <FeedState
            items={visibleItems}
            previewItems={galleryItems}
            title={selectedProject?.name ?? "All Generations"}
            dock={dock}
            onDelete={(item) => runs.remove(item.runId)}
          />
        )}
      </main>
    </div>
  )
}
