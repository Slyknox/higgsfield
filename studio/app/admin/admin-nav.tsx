"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

import { cn } from "@/lib/utils"

const LINKS = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/users", label: "Users" },
  { href: "/admin/generations", label: "Generations" },
]

export function AdminNav() {
  const pathname = usePathname()
  return (
    <nav aria-label="Admin" className="flex items-center gap-1">
      {LINKS.map((l) => {
        const active =
          l.href === "/admin"
            ? pathname === "/admin"
            : pathname.startsWith(l.href)
        return (
          <Link
            key={l.href}
            href={l.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "inline-flex h-8 items-center rounded-lg px-3 text-q-body-sm-medium outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
              active
                ? "bg-white/10 text-foreground"
                : "text-q-text-secondary hover:text-foreground"
            )}
          >
            {l.label}
          </Link>
        )
      })}
    </nav>
  )
}
