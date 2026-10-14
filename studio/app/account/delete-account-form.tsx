"use client"

import { useActionState, useState } from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

import { deleteAccountAction, type DeleteState } from "./actions"

/** Deletion needs the user's email typed back, so it can't happen by a stray click. */
export function DeleteAccountForm({ email }: { email: string }) {
  const [state, action, pending] = useActionState<DeleteState, FormData>(
    deleteAccountAction,
    {}
  )
  const [typed, setTyped] = useState("")
  const matches = typed.trim().toLowerCase() === email.toLowerCase()
  return (
    <form action={action} className="flex flex-col gap-3">
      <Label htmlFor="confirm-delete">
        Type <span className="font-semibold">{email}</span> to confirm
      </Label>
      <Input
        id="confirm-delete"
        name="confirm"
        autoComplete="off"
        value={typed}
        onChange={(e) => setTyped(e.target.value)}
        aria-invalid={state.error ? true : undefined}
      />
      {state.error ? (
        <p
          role="alert"
          className="text-q-caption-sm-medium text-q-state-error-fg"
        >
          {state.error}
        </p>
      ) : null}
      <Button
        type="submit"
        variant="destructive"
        disabled={!matches || pending}
        className="self-start"
      >
        {pending ? "Deleting…" : "Delete my account"}
      </Button>
    </form>
  )
}
