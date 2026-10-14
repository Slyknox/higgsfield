import type { Metadata } from "next"
import { redirect } from "next/navigation"

import { auth } from "@/auth"
import { AuthCard } from "@/components/site/auth-card"
import { SiteHeader } from "@/components/site/site-header"
import { safeCallbackUrl } from "@/lib/auth/policy"
import { BRAND } from "@/lib/site/brand"

import { LoginForm } from "./login-form"

export const metadata: Metadata = { title: `Sign in · ${BRAND.name}` }

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string }>
}) {
  const callbackUrl = safeCallbackUrl((await searchParams).callbackUrl)
  if (await auth()) redirect(callbackUrl)
  return (
    <>
      <SiteHeader />
      <AuthCard title={`Sign in to ${BRAND.name}`}>
        <p className="text-q-body-sm-regular text-q-text-secondary">
          Enter your email and we&apos;ll send you a link to sign in. No password needed. New here? The same
          link creates your account.
        </p>
        <LoginForm callbackUrl={callbackUrl} />
      </AuthCard>
    </>
  )
}
