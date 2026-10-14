"use client"

import { useActionState } from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

import {
  grantCreditsAction,
  reconcileNowAction,
  refreshGenerationAction,
  type AdminFormState,
} from "./actions"

function Result({ state }: { state: AdminFormState }) {
  if (state.error)
    return (
      <p role="alert" className="text-q-caption-sm-medium text-q-state-error-fg">
        {state.error}
      </p>
    )
  if (state.message)
    return (
      <p role="status" className="text-q-caption-sm-medium text-q-text-secondary">
        {state.message}
      </p>
    )
  return null
}

export function GrantCreditsForm({ userId }: { userId: number }) {
  const [state, action, pending] = useActionState(grantCreditsAction, {})
  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="userId" value={userId} />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[140px_minmax(0,1fr)]">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="grant-delta">Credits</Label>
          <Input
            id="grant-delta"
            name="delta"
            type="number"
            step={1}
            required
            placeholder="500 or -200"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="grant-note">Reason (the user sees this)</Label>
          <Input
            id="grant-note"
            name="note"
            required
            maxLength={200}
            placeholder="Support credit for a failed run"
          />
        </div>
      </div>
      <Result state={state} />
      <Button type="submit" disabled={pending} className="self-start">
        {pending ? "Saving…" : "Adjust credits"}
      </Button>
    </form>
  )
}

export function RefreshGenerationButton({ id }: { id: string }) {
  const [state, action, pending] = useActionState(refreshGenerationAction, {})
  return (
    <form action={action} className="flex items-center gap-2">
      <input type="hidden" name="id" value={id} />
      <Button type="submit" size="sm" variant="outline" disabled={pending}>
        {pending ? "Checking…" : "Check now"}
      </Button>
      <Result state={state} />
    </form>
  )
}

export function ReconcileButton() {
  const [state, action, pending] = useActionState(reconcileNowAction, {})
  return (
    <form action={action} className="flex flex-wrap items-center gap-3">
      <Button type="submit" variant="outline" disabled={pending}>
        {pending ? "Running…" : "Run reconciler now"}
      </Button>
      <Result state={state} />
    </form>
  )
}
