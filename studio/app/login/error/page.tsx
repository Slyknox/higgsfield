import type { Metadata } from "next"
import Link from "next/link"

import { AuthCard } from "@/components/site/auth-card"
import { SiteHeader } from "@/components/site/site-header"
import { BRAND } from "@/lib/site/brand"

export const metadata: Metadata = { title: `Sign-in problem · ${BRAND.name}` }

const MESSAGES: Record<string, string> = {
  Verification:
    "This sign-in link has expired or was already used. Request a new one.",
  AccessDenied: "This account can't sign in.",
  Configuration:
    "Sign-in isn't available right now. Try again in a few minutes.",
}

export default async function AuthErrorPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const code = (await searchParams).error ?? ""
  return (
    <>
      <SiteHeader />
      <AuthCard title="We couldn't sign you in">
        <p className="text-q-body-sm-regular text-q-text-secondary">
          {MESSAGES[code] ??
            "Something went wrong while signing in. Request a new link and try again."}
        </p>
        <Link
          href="/login"
          className="inline-flex h-11 items-center justify-center rounded-xl bg-white text-q-label-md-semi-bold text-black hover:bg-white/85"
        >
          Back to sign in
        </Link>
      </AuthCard>
    </>
  )
}
