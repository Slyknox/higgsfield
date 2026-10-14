import type { Metadata } from "next"
import Link from "next/link"
import { MailCheck } from "lucide-react"

import { AuthCard } from "@/components/site/auth-card"
import { SiteHeader } from "@/components/site/site-header"
import { BRAND } from "@/lib/site/brand"
import { MAGIC_LINK_MINUTES } from "@/lib/auth/policy"

export const metadata: Metadata = { title: `Check your email · ${BRAND.name}` }

export default function CheckEmailPage() {
  return (
    <>
      <SiteHeader />
      <AuthCard title="Check your email">
        <MailCheck aria-hidden className="size-8 text-primary" />
        <p className="text-q-body-sm-regular text-q-text-secondary">
          We sent you a sign-in link. Open it on this device to continue. It
          works once and expires in {MAGIC_LINK_MINUTES} minutes.
        </p>
        <p className="text-q-caption-sm-regular text-q-text-secondary">
          No email? Check spam, or{" "}
          <Link
            href="/login"
            className="text-foreground underline underline-offset-4"
          >
            try again
          </Link>
          .
        </p>
      </AuthCard>
    </>
  )
}
