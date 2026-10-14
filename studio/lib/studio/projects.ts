import { create } from "zustand"

export interface Project {
  id: string
  name: string
  createdAt: number
  updatedAt: number
}

type ProjectsState = {
  projects: Project[]
  loaded: boolean
  error: string | null
  /** Fetches the signed-in user's projects and imports any old browser-only ones. */
  load: () => Promise<void>
  create: (name: string) => Project
  rename: (id: string, name: string) => void
  remove: (id: string) => void
  touch: (id: string) => void
}

/** Where projects lived before they moved to the server. Imported once, then cleared. */
const LEGACY_KEY = "hf.projects.v1"

function newId(): string {
  return crypto.randomUUID()
}

async function send(
  path: string,
  init: { method: string; body?: unknown }
): Promise<Response> {
  const res = await fetch(path, {
    method: init.method,
    headers:
      init.body === undefined
        ? undefined
        : { "Content-Type": "application/json" },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  })
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as {
      error?: string
    } | null
    throw new Error(body?.error ?? "Couldn't save your project. Try again.")
  }
  return res
}

function legacyProjects(): Project[] {
  try {
    const raw = window.localStorage.getItem(LEGACY_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as { state?: { projects?: unknown } }
    const list = parsed.state?.projects
    return Array.isArray(list)
      ? list.filter(
          (p): p is Project =>
            !!p &&
            typeof p === "object" &&
            typeof (p as Project).id === "string" &&
            typeof (p as Project).name === "string"
        )
      : []
  } catch {
    return []
  }
}

/**
 * Projects stored on the server. Changes show at once and are saved in the
 * background; a failed save reloads the list and shows the error.
 */
export const useProjects = create<ProjectsState>()((set, get) => {
  const fail = (error: unknown) => {
    set({
      error:
        error instanceof Error ? error.message : "Couldn't save your project.",
    })
    void get().load()
  }

  return {
    projects: [],
    loaded: false,
    error: null,
    load: async () => {
      try {
        const res = await send("/api/projects", { method: "GET" })
        const { projects } = (await res.json()) as { projects: Project[] }
        const legacy = legacyProjects().filter(
          (p) => !projects.some((s) => s.id === p.id)
        )
        const imported: Project[] = []
        for (const p of legacy) {
          try {
            const created = await send("/api/projects", {
              method: "POST",
              body: { id: p.id, name: p.name, createdAt: p.createdAt },
            })
            imported.push(
              ((await created.json()) as { project: Project }).project
            )
          } catch {
            // Ids that aren't UUIDs can't be imported; the rest still are.
          }
        }
        if (legacy.length) window.localStorage.removeItem(LEGACY_KEY)
        set({ projects: [...imported, ...projects], loaded: true })
      } catch (error) {
        set({
          loaded: true,
          error:
            error instanceof Error ? error.message : "Couldn't load projects.",
        })
      }
    },
    create: (name) => {
      const now = Date.now()
      const project: Project = {
        id: newId(),
        name: name.trim().slice(0, 80) || "Untitled",
        createdAt: now,
        updatedAt: now,
      }
      set({ projects: [project, ...get().projects], error: null })
      send("/api/projects", {
        method: "POST",
        body: { id: project.id, name: project.name },
      }).catch(fail)
      return project
    },
    rename: (id, name) => {
      const next = name.trim().slice(0, 80)
      if (!next) return
      set((state) => ({
        error: null,
        projects: state.projects.map((p) =>
          p.id === id ? { ...p, name: next, updatedAt: Date.now() } : p
        ),
      }))
      send(`/api/projects/${encodeURIComponent(id)}`, {
        method: "PATCH",
        body: { name: next },
      }).catch(fail)
    },
    remove: (id) => {
      set((state) => ({
        error: null,
        projects: state.projects.filter((p) => p.id !== id),
      }))
      send(`/api/projects/${encodeURIComponent(id)}`, {
        method: "DELETE",
      }).catch(fail)
    },
    // The server bumps a project when a generation is submitted to it.
    touch: (id) =>
      set((state) => ({
        projects: state.projects.map((p) =>
          p.id === id ? { ...p, updatedAt: Date.now() } : p
        ),
      })),
  }
})
