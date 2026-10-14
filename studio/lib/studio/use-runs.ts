"use client"

import { useCallback, useEffect, useRef, useState } from "react"

import {
  cancelGeneration,
  deleteGeneration,
  submitGeneration,
} from "@/generation/actions"
import { MODELS } from "@/generation/catalog"
import type { GenerationPlane } from "@/generation/catalog"
import { IN_FLIGHT_STATUSES, type GenerationDTO } from "@/lib/generations/types"

import { aspectFromSettings, type RunRecord } from "./history"

const POLL_MS = 3500

export function toRunRecord(g: GenerationDTO): RunRecord {
  const inFlight = (IN_FLIGHT_STATUSES as readonly string[]).includes(g.status)
  return {
    id: g.id,
    requestId: g.id,
    surface: g.surface,
    modelId: g.modelId,
    modelLabel: MODELS.find((m) => m.id === g.modelId)?.label ?? g.modelId,
    prompt: g.prompt,
    settings: g.settings,
    ...(g.projectId ? { projectId: g.projectId } : {}),
    aspect: aspectFromSettings(g.settings),
    status: inFlight
      ? "running"
      : g.status === "completed"
        ? "completed"
        : "failed",
    urls: g.outputs.map((o) => o.url),
    ...(g.error ? { error: g.error } : {}),
    createdAt: g.createdAt,
  }
}

async function fetchJson<T>(url: string): Promise<T | null> {
  const response = await fetch(url, { cache: "no-store" })
  if (response.status === 401) return null
  if (!response.ok) throw new Error(`Request failed (${response.status})`)
  return (await response.json()) as T
}

/**
 * The studio's generation controller. History lives in Postgres: it loads the
 * user's generations, submits and cancels through server actions, and polls
 * our status route (never Higgsfield) while anything is in flight.
 */
export function useRuns() {
  const [records, setRecords] = useState<RunRecord[]>([])
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const polling = useRef(false)

  const merge = useCallback((updates: GenerationDTO[]) => {
    if (updates.length === 0) return
    const byId = new Map(updates.map((g) => [g.id, toRunRecord(g)]))
    setRecords((current) => current.map((r) => byId.get(r.id) ?? r))
  }, [])

  useEffect(() => {
    let alive = true
    fetchJson<{ generations: GenerationDTO[] }>("/api/generations?limit=100")
      .then((data) => {
        if (alive && data) setRecords(data.generations.map(toRunRecord))
      })
      .catch(
        () =>
          alive &&
          setError("Couldn't load your generations. Refresh to try again.")
      )
      .finally(() => alive && setLoaded(true))
    return () => {
      alive = false
    }
  }, [])

  const runningIds = records
    .filter((r) => r.status === "running")
    .map((r) => r.id)
  const runningKey = runningIds.join(",")

  useEffect(() => {
    if (!runningKey) return
    const timer = setInterval(() => {
      if (polling.current) return
      polling.current = true
      fetchJson<{ generations: GenerationDTO[] }>(
        `/api/generations/status?ids=${runningKey}`
      )
        .then((data) => data && merge(data.generations))
        .catch(() => undefined) // A dropped poll is retried on the next tick.
        .finally(() => {
          polling.current = false
        })
    }, POLL_MS)
    return () => clearInterval(timer)
  }, [runningKey, merge])

  const submit = useCallback(
    async (
      plane: GenerationPlane,
      projectId?: string
    ): Promise<RunRecord | null> => {
      setError(null)
      const result = await submitGeneration(plane, projectId)
      if (!result.ok) {
        setError(result.error)
        return null
      }
      const record = toRunRecord(result.value)
      setRecords((current) => [record, ...current])
      return record
    },
    []
  )

  const cancel = useCallback(
    async (id: string) => {
      const result = await cancelGeneration(id)
      if (result.ok) merge([result.value])
      else setError(result.error)
    },
    [merge]
  )

  const remove = useCallback(async (id: string) => {
    let removed: RunRecord | undefined
    setRecords((current) => {
      removed = current.find((r) => r.id === id)
      return current.filter((r) => r.id !== id)
    })
    const result = await deleteGeneration(id)
    if (!result.ok) {
      setError(result.error)
      if (removed) {
        const restore = removed
        setRecords((current) =>
          [restore, ...current].sort((a, b) => b.createdAt - a.createdAt)
        )
      }
    }
  }, [])

  const running = records.filter((r) => r.status === "running")

  return { records, running, loaded, error, submit, cancel, remove, setError }
}
