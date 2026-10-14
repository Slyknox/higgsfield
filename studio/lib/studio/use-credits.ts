"use client"

import { useCallback, useEffect, useState } from "react"

/** Credit balance for the generator. `null` while billing is off. */
export type Credits = { markup: number; balance: number } | null

/** Starts from the server-rendered value and refreshes after submits and on focus. */
export function useCredits(initial: Credits, signedIn: boolean) {
  const [credits, setCredits] = useState<Credits>(initial)
  const refresh = useCallback(async () => {
    if (!initial || !signedIn) return
    try {
      const res = await fetch("/api/credits", { cache: "no-store" })
      if (!res.ok) return
      const body = (await res.json()) as { credits: Credits }
      setCredits(body.credits)
    } catch {
      // Keep the last known balance; the server still enforces it.
    }
  }, [initial, signedIn])
  useEffect(() => {
    window.addEventListener("focus", refresh)
    return () => window.removeEventListener("focus", refresh)
  }, [refresh])
  return { credits, refresh }
}
