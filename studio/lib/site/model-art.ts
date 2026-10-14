import type { ModelEntry } from "@/generation/catalog"

// Abstract art per provider family. These stand in until the product has its
// own generated cover media (Phase 7); they are not fake screenshots.
const ART: Record<string, string> = {
  seedance:
    "radial-gradient(120% 90% at 20% 10%, rgba(209,254,23,0.35) 0%, transparent 55%), radial-gradient(90% 90% at 90% 90%, rgba(56,189,248,0.45) 0%, transparent 60%), linear-gradient(135deg,#0f172a,#111827)",
  kling:
    "radial-gradient(100% 80% at 80% 0%, rgba(244,114,182,0.5) 0%, transparent 60%), radial-gradient(80% 80% at 10% 100%, rgba(129,140,248,0.45) 0%, transparent 60%), linear-gradient(135deg,#1e1b4b,#111827)",
  higgsfield:
    "radial-gradient(110% 90% at 30% 20%, rgba(251,146,60,0.45) 0%, transparent 55%), radial-gradient(80% 80% at 90% 80%, rgba(244,63,94,0.4) 0%, transparent 60%), linear-gradient(135deg,#1c1917,#0c0a09)",
  wan: "radial-gradient(110% 90% at 70% 10%, rgba(45,212,191,0.45) 0%, transparent 55%), radial-gradient(80% 80% at 10% 90%, rgba(59,130,246,0.4) 0%, transparent 60%), linear-gradient(135deg,#042f2e,#0f172a)",
  minimax:
    "radial-gradient(110% 90% at 20% 80%, rgba(168,85,247,0.45) 0%, transparent 55%), radial-gradient(80% 80% at 90% 10%, rgba(236,72,153,0.35) 0%, transparent 60%), linear-gradient(135deg,#2e1065,#0f172a)",
}

/** Background art for a model's cards: its provider family, else Seedance's. */
export function modelArt(model: Pick<ModelEntry, "icon">): string {
  return ART[model.icon ?? ""] ?? ART.seedance!
}
