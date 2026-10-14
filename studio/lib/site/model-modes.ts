import type { ModelEntry, Surface } from "@/generation/catalog"

// The generator's top tabs. A model's mode comes from what it needs: a source
// clip makes it an editor, motion-control models transfer motion.
export type ModeId = "create" | "edit" | "motion"

const ORDER: ModeId[] = ["create", "edit", "motion"]

const LABEL: Record<Surface, Record<ModeId, string>> = {
  video: {
    create: "Create Video",
    edit: "Edit Video",
    motion: "Motion Control",
  },
  image: { create: "Create Image", edit: "Edit Image", motion: "Motion" },
}

export function modeOf(
  model: Pick<ModelEntry, "id" | "requiredRoles">
): ModeId {
  if (/(^|-)motion(-|$)/.test(model.id)) return "motion"
  if (model.requiredRoles?.includes("source")) return "edit"
  return "create"
}

export function modeLabel(surface: Surface, mode: ModeId): string {
  return LABEL[surface][mode]
}

/** Modes that have at least one model, in tab order. */
export function modesFor(models: readonly ModelEntry[]): ModeId[] {
  const present = new Set(models.map(modeOf))
  return ORDER.filter((mode) => present.has(mode))
}

/** Provider family for grouping, from the model's logo name. */
export function familyOf(model: Pick<ModelEntry, "icon" | "label">): string {
  const names: Record<string, string> = {
    seedance: "Seedance",
    kling: "Kling",
    higgsfield: "Higgsfield",
    wan: "Wan",
    minimax: "MiniMax",
    flux: "Flux",
    grok: "Grok",
    ltx: "LTX",
    pixverse: "PixVerse",
    "happy-horse": "Happy Horse",
    ideogram: "Ideogram",
    recraft: "Recraft",
    qwen: "Qwen",
    "z-image": "Z-Image",
  }
  return (
    (model.icon && names[model.icon]) || model.label.split(" ")[0] || "Other"
  )
}
