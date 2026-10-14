import Link from "next/link"
import {
  ArrowRight,
  Clapperboard,
  Film,
  FolderOpen,
  ImageIcon,
  MoveRight,
  Repeat,
  Scissors,
  Sparkles,
  type LucideIcon,
} from "lucide-react"

import { Badge } from "@/components/site/badge"
import { ModelDirectory } from "@/components/site/explore/model-directory"
import { ModelGlyph } from "@/components/site/model-glyph"
import { MODELS, type ModelEntry } from "@/generation/catalog"
import { BRAND } from "@/lib/site/brand"
import { modelArt as art } from "@/lib/site/model-art"
import { cn } from "@/lib/utils"

const installed = (id: string): ModelEntry | undefined =>
  MODELS.find((m) => m.id === id)

const href = (m: ModelEntry) =>
  `/${m.surface}?model=${encodeURIComponent(m.id)}`

const SPOTLIGHT: { id: string; title: string; subtitle: string }[] = [
  {
    id: "seedance-2.5",
    title: "Seedance 2.5",
    subtitle: "Up to 30-second videos from text, frames, video or audio",
  },
  {
    id: "kling-3-std",
    title: "Kling 3.0",
    subtitle: "Cinematic multi-shot video with native audio",
  },
  {
    id: "soul-2",
    title: "Soul 2",
    subtitle: "Photoreal people, fashion and culture-native imagery",
  },
  {
    id: "wan-3",
    title: "Wan 3.0",
    subtitle: "Videos from text, keyframes or multimodal references",
  },
  {
    id: "minimax-h3",
    title: "MiniMax H3",
    subtitle: "2K video from text, keyframes or references",
  },
]

type Feature = {
  title: string
  description: string
  href: string
  icon: LucideIcon
  tag?: string
  badge?: string
}

function features(): Feature[] {
  const list: Feature[] = []
  const add = (id: string, f: Omit<Feature, "href">) => {
    const m = installed(id)
    if (m) list.push({ ...f, href: href(m) })
  }
  add("seedance-2.5", {
    title: "Seedance 2.5",
    description: "The most advanced video model",
    icon: Clapperboard,
    tag: "Video",
    badge: "TOP",
  })
  add("seedance-2.5-edit", {
    title: "Edit Video",
    description: "Change scenes and elements with a prompt",
    icon: Scissors,
    tag: "Video",
  })
  add("seedance-2.5-extend", {
    title: "Extend Video",
    description: "Continue any clip with matching motion",
    icon: MoveRight,
    tag: "Video",
  })
  add("kling-3-motion-std", {
    title: "Motion Control",
    description: "Transfer motion from a video onto an image",
    icon: Repeat,
    tag: "Video",
  })
  add("soul-2", {
    title: "Soul 2",
    description: "Photoreal images for fashion and people",
    icon: ImageIcon,
    tag: "Image",
  })
  add("soul-cinema", {
    title: "Cinematic Stills",
    description: "Film-grade frames with cinematic grading",
    icon: Film,
    tag: "Image",
  })
  list.push({
    title: "Assets",
    description: "Every generation you have made, in one library",
    href: "/assets",
    icon: FolderOpen,
  })
  return list.slice(0, 6)
}

function SpotlightCard({
  model,
  title,
  subtitle,
  accent,
}: {
  model: ModelEntry
  title: string
  subtitle: string
  accent: boolean
}) {
  return (
    <Link
      href={href(model)}
      className="group flex w-[min(78vw,420px)] shrink-0 snap-start flex-col gap-3 rounded-2xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      <span
        className="relative flex aspect-[16/9] items-end overflow-hidden rounded-2xl border border-white/5 p-5"
        style={{ backgroundImage: art(model) }}
      >
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-40"
          style={{
            backgroundImage:
              "radial-gradient(rgba(255,255,255,0.25) 1px, transparent 1px)",
            backgroundSize: "14px 14px",
          }}
        />
        <ModelGlyph
          model={model}
          className="relative size-14 rounded-2xl bg-black/30 backdrop-blur transition-transform duration-300 group-hover:scale-105"
        />
      </span>
      <span className="flex flex-col gap-1 px-1">
        <span
          className={cn(
            "text-q-accent-sm-bold uppercase",
            accent ? "text-primary" : "text-foreground"
          )}
        >
          {title}
        </span>
        <span className="text-q-body-sm-regular text-q-text-secondary">
          {subtitle}
        </span>
      </span>
    </Link>
  )
}

const FOOTER: { heading: string; links: { label: string; href: string }[] }[] =
  [
    {
      heading: "Create",
      links: [
        { label: "AI Video", href: "/video" },
        { label: "AI Image", href: "/image" },
        { label: "Assets", href: "/assets" },
      ],
    },
    {
      heading: "Video models",
      links: MODELS.filter((m) => m.surface === "video")
        .slice(0, 6)
        .map((m) => ({ label: m.label, href: href(m) })),
    },
    {
      heading: "Image models",
      links: MODELS.filter((m) => m.surface === "image")
        .slice(0, 6)
        .map((m) => ({ label: m.label, href: href(m) })),
    },
  ]

/** The Explore home page: spotlight carousel, feature grid, model directory. */
export function ExplorePage() {
  const spotlight = SPOTLIGHT.flatMap((s) => {
    const m = installed(s.id)
    return m ? [{ ...s, model: m }] : []
  })
  const hero = installed("seedance-2.5")
  const grid = features()

  return (
    <main className="flex flex-col">
      {hero ? (
        <Link
          href={href(hero)}
          className="flex items-center justify-center gap-2 bg-white/[0.04] px-4 py-2 text-center text-q-caption-sm-medium text-q-text-secondary transition-colors hover:text-foreground"
        >
          <Sparkles aria-hidden className="size-3.5 text-primary" />
          Seedance 2.5 is live: cinematic video up to 30 seconds, with audio
          <ArrowRight aria-hidden className="size-3.5" />
        </Link>
      ) : null}

      <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-14 px-4 pt-6 pb-16 md:px-6">
        <h1 className="sr-only">
          {BRAND.name}: {BRAND.tagline}
        </h1>

        <section aria-label="Featured models">
          <div className="-mx-4 flex snap-x snap-mandatory scroll-px-4 [scrollbar-width:none] gap-4 overflow-x-auto px-4 pb-2 md:-mx-6 md:scroll-px-6 md:px-6">
            {spotlight.map((s, i) => (
              <SpotlightCard key={s.id} {...s} accent={i === 0} />
            ))}
          </div>
        </section>

        <section
          aria-label="Start creating"
          className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)]"
        >
          {hero ? (
            <div
              className="relative flex min-h-[300px] flex-col justify-between overflow-hidden rounded-2xl border border-white/5 p-6 md:p-8"
              style={{ backgroundImage: art(hero) }}
            >
              <div className="flex flex-col gap-3">
                <p className="text-q-accent-xl-bold leading-none uppercase">
                  <span className="text-primary">Seedance 2.5</span>
                  <br />
                  Video up to 30 seconds
                </p>
                <p className="max-w-md text-q-body-sm-regular text-white/75">
                  Text, start and end frames, or up to 30 image, 10 video and 10
                  audio references. Native audio included.
                </p>
              </div>
              <Link
                href={href(hero)}
                className="inline-flex h-11 w-fit items-center gap-2 rounded-xl bg-white px-5 text-q-body-sm-medium text-black transition-colors hover:bg-white/85"
              >
                Try Seedance 2.5
                <ArrowRight aria-hidden className="size-4" />
              </Link>
            </div>
          ) : null}

          <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {grid.map((f) => (
              <li key={f.href}>
                <Link
                  href={f.href}
                  className="flex h-full min-h-[140px] flex-col justify-between gap-6 rounded-2xl border border-white/5 bg-white/[0.03] p-5 transition-colors outline-none hover:border-white/15 hover:bg-white/[0.06] focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  <span className="flex items-start justify-between">
                    <f.icon aria-hidden className="size-5" />
                    {f.tag ? (
                      <span className="rounded-full bg-white/5 px-2.5 py-1 text-[11px] text-q-text-secondary">
                        {f.tag}
                      </span>
                    ) : null}
                  </span>
                  <span className="flex flex-col gap-1">
                    <span className="flex items-center gap-2 text-q-body-sm-medium">
                      {f.title}
                      {f.badge ? <Badge>{f.badge}</Badge> : null}
                    </span>
                    <span className="text-q-caption-sm-regular text-q-text-secondary">
                      {f.description}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <ModelDirectory />
      </div>

      <footer className="border-t border-white/5">
        <div className="mx-auto grid w-full max-w-[1600px] grid-cols-2 gap-8 px-4 py-12 md:grid-cols-4 md:px-6">
          <div className="col-span-2 flex flex-col gap-2 md:col-span-1">
            <span className="text-q-label-md-semi-bold">{BRAND.name}</span>
            <span className="text-q-caption-sm-regular text-q-text-secondary">
              {BRAND.tagline}
            </span>
          </div>
          {FOOTER.map((col) => (
            <nav
              key={col.heading}
              aria-label={col.heading}
              className="flex flex-col gap-2"
            >
              <span className="text-q-caption-sm-medium text-q-text-secondary">
                {col.heading}
              </span>
              {col.links.map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  className="text-q-body-sm-regular text-foreground/80 hover:text-foreground"
                >
                  {l.label}
                </Link>
              ))}
            </nav>
          ))}
        </div>
        <p className="mx-auto w-full max-w-[1600px] px-4 pb-8 text-q-caption-sm-regular text-q-text-secondary md:px-6">
          © {new Date().getFullYear()} {BRAND.name}. Generations run on the
          Higgsfield API.
        </p>
      </footer>
    </main>
  )
}
