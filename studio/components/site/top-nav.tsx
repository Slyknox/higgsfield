"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useTransition } from "react"
import { NavigationMenu } from "@base-ui/react/navigation-menu"
import {
  ChevronDown,
  Clapperboard,
  Film,
  FolderOpen,
  ImageIcon,
  LogOut,
  Menu,
  MoveRight,
  Repeat,
  Scissors,
  ShieldCheck,
  UserRound,
  type LucideIcon,
} from "lucide-react"

import { Badge } from "@/components/site/badge"
import { ModelGlyph } from "@/components/site/model-glyph"
import { buttonVariants } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { signOutAction } from "@/app/login/actions"
import { MODELS, type Surface } from "@/generation/catalog"
import { BRAND } from "@/lib/site/brand"
import { modelMeta } from "@/lib/site/model-meta"
import { cn } from "@/lib/utils"

export const TOP_NAV_HEIGHT = 56

/** The signed-in user as the nav needs it; null when signed out. */
export type NavUser = {
  email: string
  name: string | null
  role: "user" | "admin"
}

type Feature = {
  label: string
  description: string
  href: string
  icon: LucideIcon
}

const has = (id: string) => MODELS.some((m) => m.id === id)

// Features only list modes whose model is installed, so no link dead-ends.
const FEATURES: Record<Surface, Feature[]> = {
  video: [
    {
      label: "Create Video",
      description: "Generate video from text, frames or references",
      href: "/video",
      icon: Clapperboard,
    },
    ...(has("seedance-2.5-edit")
      ? [
          {
            label: "Edit Video",
            description: "Change scenes, shots and elements with a prompt",
            href: "/video?model=seedance-2.5-edit",
            icon: Scissors,
          },
        ]
      : []),
    ...(has("seedance-2.5-extend")
      ? [
          {
            label: "Extend Video",
            description: "Continue a clip with matching motion",
            href: "/video?model=seedance-2.5-extend",
            icon: MoveRight,
          },
        ]
      : []),
    ...(has("kling-3-motion-std")
      ? [
          {
            label: "Motion Control",
            description: "Transfer motion from a video to an image",
            href: "/video?model=kling-3-motion-std",
            icon: Repeat,
          },
        ]
      : []),
  ],
  image: [
    {
      label: "Create Image",
      description: "Generate images from text or references",
      href: "/image",
      icon: ImageIcon,
    },
    ...(has("soul-cinema")
      ? [
          {
            label: "Cinematic Stills",
            description: "Film-grade frames with cinematic grading",
            href: "/image?model=soul-cinema",
            icon: Film,
          },
        ]
      : []),
  ],
}

const SURFACES: { surface: Surface; label: string; href: string }[] = [
  { surface: "image", label: "Image", href: "/image" },
  { surface: "video", label: "Video", href: "/video" },
]

function BrandMark() {
  return (
    <Link
      href="/"
      className="flex items-center gap-2 rounded-lg outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      <span
        aria-hidden
        className="inline-flex size-7 items-center justify-center rounded-lg bg-primary text-[13px] font-black text-primary-foreground"
      >
        d
      </span>
      <span className="text-q-label-md-semi-bold">{BRAND.name}</span>
    </Link>
  )
}

function MegaMenu({ surface }: { surface: Surface }) {
  const models = MODELS.filter((m) => m.surface === surface)
  return (
    <div className="grid w-[min(92vw,1040px)] grid-cols-[minmax(0,1fr)_minmax(0,2fr)] gap-6 p-5">
      <section aria-label="Features" className="flex flex-col gap-1">
        <p className="px-2 pb-2 text-q-caption-sm-medium text-q-text-secondary">
          Features
        </p>
        {FEATURES[surface].map((f) => (
          <NavigationMenu.Link
            key={f.href}
            render={<Link href={f.href} />}
            className="flex items-center gap-3 rounded-xl p-2 outline-none hover:bg-white/5 focus-visible:bg-white/5"
          >
            <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5">
              <f.icon aria-hidden className="size-5" />
            </span>
            <span className="flex min-w-0 flex-col">
              <span className="text-q-body-sm-medium">{f.label}</span>
              <span className="truncate text-q-caption-sm-regular text-q-text-secondary">
                {f.description}
              </span>
            </span>
          </NavigationMenu.Link>
        ))}
      </section>
      <section aria-label="Models" className="flex min-h-0 flex-col">
        <p className="px-2 pb-2 text-q-caption-sm-medium text-q-text-secondary">
          Models
        </p>
        <div className="grid max-h-[min(70vh,560px)] grid-cols-2 gap-1 overflow-y-auto pr-1">
          {models.map((m) => {
            const meta = modelMeta(m)
            return (
              <NavigationMenu.Link
                key={m.id}
                render={
                  <Link
                    href={`/${surface}?model=${encodeURIComponent(m.id)}`}
                  />
                }
                className="flex items-center gap-3 rounded-xl p-2 outline-none hover:bg-white/5 focus-visible:bg-white/5"
              >
                <ModelGlyph model={m} />
                <span className="flex min-w-0 flex-col">
                  <span className="flex items-center gap-2 text-q-body-sm-medium">
                    <span className="truncate">{m.label}</span>
                    {meta.badge ? <Badge>{meta.badge}</Badge> : null}
                  </span>
                  <span className="truncate text-q-caption-sm-regular text-q-text-secondary">
                    {meta.description}
                  </span>
                </span>
              </NavigationMenu.Link>
            )
          })}
        </div>
      </section>
    </div>
  )
}

const linkClass = (active: boolean) =>
  cn(
    "inline-flex h-8 items-center gap-1 rounded-lg px-2.5 text-q-body-sm-medium transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
    active ? "text-primary" : "text-q-text-secondary hover:text-foreground"
  )

/**
 * TopNav — the site header: brand, Explore, Image and Video (each opening a
 * features + models menu), Effects and Assets. Collapses into one menu on narrow screens.
 */
function AccountMenu({ user }: { user: NavUser }) {
  const [pending, startTransition] = useTransition()
  const initial = (user.name || user.email).trim().charAt(0).toUpperCase()
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={`Account menu for ${user.email}`}
        className="inline-flex size-8 items-center justify-center rounded-full bg-white/10 text-q-caption-sm-semi-bold outline-none hover:bg-white/15 focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        {initial}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-56">
        {/* Base UI requires a group label to sit inside a group. */}
        <DropdownMenuGroup>
          <DropdownMenuLabel className="truncate">
            {user.email}
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem render={<Link href="/assets" />}>
          <FolderOpen aria-hidden />
          Assets
        </DropdownMenuItem>
        <DropdownMenuItem render={<Link href="/account" />}>
          <UserRound aria-hidden />
          Account
        </DropdownMenuItem>
        {user.role === "admin" ? (
          <DropdownMenuItem render={<Link href="/admin" />}>
            <ShieldCheck aria-hidden />
            Admin
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuItem
          disabled={pending}
          onClick={() => startTransition(() => signOutAction())}
        >
          <LogOut aria-hidden />
          {pending ? "Signing out…" : "Sign out"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export function TopNav({ user }: { user: NavUser | null }) {
  const pathname = usePathname()
  const surfaces = SURFACES.filter((s) =>
    MODELS.some((m) => m.surface === s.surface)
  )
  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href)

  return (
    <header
      className="sticky top-0 z-40 flex shrink-0 items-center gap-4 border-b border-white/5 bg-background/90 px-4 backdrop-blur"
      style={{ height: TOP_NAV_HEIGHT }}
    >
      <BrandMark />

      <NavigationMenu.Root className="hidden md:block">
        <NavigationMenu.List className="flex items-center gap-1">
          <NavigationMenu.Item>
            <NavigationMenu.Link
              render={<Link href="/" />}
              className={linkClass(isActive("/"))}
            >
              Explore
            </NavigationMenu.Link>
          </NavigationMenu.Item>
          {surfaces.map((s) => (
            <NavigationMenu.Item key={s.surface}>
              <NavigationMenu.Trigger className={linkClass(isActive(s.href))}>
                {s.label}
                <NavigationMenu.Icon className="transition-transform duration-200 data-[popup-open]:rotate-180">
                  <ChevronDown aria-hidden className="size-3.5" />
                </NavigationMenu.Icon>
              </NavigationMenu.Trigger>
              <NavigationMenu.Content className="transition-opacity duration-200 data-[ending-style]:opacity-0 data-[starting-style]:opacity-0">
                <MegaMenu surface={s.surface} />
              </NavigationMenu.Content>
            </NavigationMenu.Item>
          ))}
          <NavigationMenu.Item>
            <NavigationMenu.Link
              render={<Link href="/effects" />}
              className={linkClass(isActive("/effects"))}
            >
              Effects
            </NavigationMenu.Link>
          </NavigationMenu.Item>
        </NavigationMenu.List>
        <NavigationMenu.Portal>
          <NavigationMenu.Positioner
            sideOffset={10}
            align="start"
            collisionPadding={12}
            className="z-50"
          >
            <NavigationMenu.Popup className="rounded-2xl border border-white/10 bg-[#1a1b1e] shadow-2xl transition-[opacity,transform] duration-200 data-[ending-style]:scale-[0.98] data-[ending-style]:opacity-0 data-[starting-style]:scale-[0.98] data-[starting-style]:opacity-0">
              <NavigationMenu.Viewport />
            </NavigationMenu.Popup>
          </NavigationMenu.Positioner>
        </NavigationMenu.Portal>
      </NavigationMenu.Root>

      <div className="ml-auto flex items-center gap-2">
        <Link
          href="/assets"
          className={cn(
            buttonVariants({ variant: "ghost", size: "default" }),
            "hidden md:inline-flex",
            isActive("/assets") && "text-primary"
          )}
        >
          <FolderOpen aria-hidden />
          Assets
        </Link>

        {user ? (
          <AccountMenu user={user} />
        ) : (
          <>
            <Link
              href={`/login?callbackUrl=${encodeURIComponent(pathname)}`}
              className={cn(
                buttonVariants({ variant: "ghost", size: "default" }),
                "hidden sm:inline-flex"
              )}
            >
              Log in
            </Link>
            <Link
              href={`/login?callbackUrl=${encodeURIComponent(pathname)}`}
              className="inline-flex h-8 items-center rounded-lg bg-white px-3 text-q-body-sm-medium text-black transition-colors hover:bg-white/85"
            >
              Sign up
            </Link>
          </>
        )}

        <DropdownMenu>
          <DropdownMenuTrigger
            aria-label="Open menu"
            className={cn(
              buttonVariants({ variant: "ghost", size: "icon" }),
              "md:hidden"
            )}
          >
            <Menu aria-hidden />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-48">
            <DropdownMenuItem render={<Link href="/" />}>
              Explore
            </DropdownMenuItem>
            {surfaces.map((s) => (
              <DropdownMenuItem key={s.surface} render={<Link href={s.href} />}>
                {s.label}
              </DropdownMenuItem>
            ))}
            {FEATURES.video.slice(1).map((f) => (
              <DropdownMenuItem key={f.href} render={<Link href={f.href} />}>
                {f.label}
              </DropdownMenuItem>
            ))}
            <DropdownMenuItem render={<Link href="/effects" />}>
              Effects
            </DropdownMenuItem>
            <DropdownMenuItem render={<Link href="/assets" />}>
              Assets
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
