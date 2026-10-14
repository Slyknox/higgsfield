"use client"

import { useActionState } from "react"
import { Mail } from "lucide-react"

import { Input } from "@/components/ui/input"

import { requestMagicLink, type LoginState } from "./actions"

export function LoginForm({ callbackUrl }: { callbackUrl: string }) {
  const [state, action, pending] = useActionState<LoginState, FormData>(requestMagicLink, {})
  return (
    <form action={action} className="flex flex-col gap-3" noValidate>
      <input type="hidden" name="callbackUrl" value={callbackUrl} />
      <label htmlFor="email" className="text-q-caption-sm-medium text-q-text-secondary">
        Email
      </label>
      <Input
        id="email"
        name="email"
        type="email"
        autoComplete="email"
        inputMode="email"
        autoFocus
        required
        placeholder="you@example.com"
        defaultValue={state.email}
        invalid={state.error != null}
        aria-describedby={state.error ? "email-error" : undefined}
      />
      {state.error ? (
        <p id="email-error" role="alert" className="text-q-caption-sm-regular text-q-state-error-fg">
          {state.error}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className="mt-1 inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-primary text-q-label-md-semi-bold text-primary-foreground outline-none transition-colors hover:bg-primary/85 focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50"
      >
        <Mail aria-hidden className="size-4" />
        {pending ? "Sending link…" : "Email me a sign-in link"}
      </button>
    </form>
  )
}
