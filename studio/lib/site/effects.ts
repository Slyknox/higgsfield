import type { Surface } from "@/generation/catalog"

// Effects: ready-made recipes (model + prompt + settings) that open the
// generator filled in. The user still reviews and presses Generate.
// Cover art is abstract until the studio generates its own previews.

export type EffectCategory = "Camera" | "Product" | "Portrait" | "Stylize"

export type Effect = {
  id: string
  title: string
  description: string
  category: EffectCategory
  surface: Surface
  modelId: string
  prompt: string
  settings?: Record<string, unknown>
  /** What the user adds before generating. */
  input: "prompt" | "photo"
  art: string
}

const glow = (a: string, b: string, base: string) =>
  `radial-gradient(110% 90% at 20% 15%, ${a} 0%, transparent 55%), radial-gradient(90% 90% at 90% 90%, ${b} 0%, transparent 60%), linear-gradient(135deg, ${base}, #0b0c0e)`

export const EFFECTS: readonly Effect[] = [
  {
    id: "dolly-zoom",
    title: "Dolly zoom",
    description: "The background stretches while the subject holds still",
    category: "Camera",
    surface: "video",
    modelId: "seedance-2.5",
    input: "photo",
    prompt:
      "Dolly zoom: the camera pushes in while zooming out, the subject stays the same size and the background stretches away behind them. Smooth, cinematic, no cuts.",
    settings: { duration: 5 },
    art: glow("rgba(209,254,23,0.4)", "rgba(56,189,248,0.4)", "#0f172a"),
  },
  {
    id: "orbit-360",
    title: "360° orbit",
    description: "One slow orbit all the way around the subject",
    category: "Camera",
    surface: "video",
    modelId: "kling-3-std",
    input: "photo",
    prompt:
      "The camera makes one slow, steady 360-degree orbit around the subject at eye level, keeping it centered and in focus. Even lighting, no cuts.",
    settings: { duration: 10 },
    art: glow("rgba(129,140,248,0.5)", "rgba(244,114,182,0.4)", "#1e1b4b"),
  },
  {
    id: "drone-reveal",
    title: "Drone reveal",
    description: "Rise up and pull back to reveal the whole scene",
    category: "Camera",
    surface: "video",
    modelId: "seedance-2.5",
    input: "prompt",
    prompt:
      "Aerial drone shot that starts low behind a ridge, rises and pulls back to reveal a coastal town at golden hour. Smooth ascent, wide lens, gentle haze.",
    settings: { duration: 8 },
    art: glow("rgba(251,191,36,0.45)", "rgba(45,212,191,0.35)", "#1c1917"),
  },
  {
    id: "product-spin",
    title: "Product turntable",
    description: "Your product turning on a clean studio backdrop",
    category: "Product",
    surface: "video",
    modelId: "kling-3-std",
    input: "photo",
    prompt:
      "The product turns slowly on a turntable against a seamless dark studio backdrop. Soft key light, crisp rim light, subtle reflections on the floor.",
    settings: { duration: 5 },
    art: glow("rgba(56,189,248,0.45)", "rgba(209,254,23,0.3)", "#0c1220"),
  },
  {
    id: "liquid-splash",
    title: "Liquid splash",
    description: "A slow-motion splash bursts around the product",
    category: "Product",
    surface: "video",
    modelId: "seedance-2.5",
    input: "photo",
    prompt:
      "High-speed slow-motion shot: a wave of clear liquid splashes up and around the product, droplets frozen mid-air, backlit, dark background.",
    settings: { duration: 5 },
    art: glow("rgba(14,165,233,0.5)", "rgba(99,102,241,0.4)", "#0a1628"),
  },
  {
    id: "studio-packshot",
    title: "Studio packshot",
    description: "A clean e-commerce still on a soft gradient",
    category: "Product",
    surface: "image",
    modelId: "flux-2",
    input: "prompt",
    prompt:
      "Studio packshot of a minimalist ceramic water bottle on a soft pastel gradient background, centered, soft shadow, high detail, e-commerce style.",
    art: glow("rgba(244,114,182,0.4)", "rgba(251,191,36,0.35)", "#1f1320"),
  },
  {
    id: "golden-hour-portrait",
    title: "Golden hour portrait",
    description: "Warm, low sun and a soft film look",
    category: "Portrait",
    surface: "image",
    modelId: "soul-2",
    input: "prompt",
    prompt:
      "Portrait of a person laughing in a field at golden hour, warm low sun behind them, soft lens flare, 85mm, shallow depth of field, film grain.",
    art: glow("rgba(251,146,60,0.5)", "rgba(244,63,94,0.35)", "#1c1310"),
  },
  {
    id: "cinematic-still",
    title: "Cinematic still",
    description: "A frame that looks lifted from a film",
    category: "Portrait",
    surface: "image",
    modelId: "soul-cinema",
    input: "prompt",
    prompt:
      "Cinematic film still of a detective in a rain-soaked neon alley at night, anamorphic lens, teal and orange grade, shallow depth of field.",
    art: glow("rgba(45,212,191,0.4)", "rgba(251,146,60,0.4)", "#0d1b1e"),
  },
  {
    id: "photo-to-life",
    title: "Bring a photo to life",
    description: "Subtle, natural motion from a single picture",
    category: "Portrait",
    surface: "video",
    modelId: "kling-3-std",
    input: "photo",
    prompt:
      "Bring the photo to life with subtle natural motion: the person breathes, blinks and smiles slightly, hair moves in a light breeze. Camera stays still.",
    settings: { duration: 5 },
    art: glow("rgba(168,85,247,0.45)", "rgba(236,72,153,0.35)", "#1e1030"),
  },
  {
    id: "claymation",
    title: "Claymation",
    description: "Turn a scene into stop-motion clay",
    category: "Stylize",
    surface: "video",
    modelId: "seedance-2.5",
    input: "prompt",
    prompt:
      "Stop-motion claymation of a small fox baking bread in a cozy kitchen, visible fingerprints in the clay, slightly choppy frame rate, warm practical lights.",
    settings: { duration: 5 },
    art: glow("rgba(234,179,8,0.45)", "rgba(220,38,38,0.35)", "#1f1609"),
  },
  {
    id: "anime-key-visual",
    title: "Anime key visual",
    description: "Bold, cel-shaded poster art",
    category: "Stylize",
    surface: "image",
    modelId: "flux-2",
    input: "prompt",
    prompt:
      "Anime key visual of a girl on a rooftop at sunset over a dense city, cel shading, dramatic sky, crisp line art, vibrant colors.",
    art: glow("rgba(244,114,182,0.5)", "rgba(96,165,250,0.45)", "#1a1030"),
  },
]

export const EFFECT_CATEGORIES: readonly EffectCategory[] = [
  "Camera",
  "Product",
  "Portrait",
  "Stylize",
]

/** Effects whose model is installed, so no card leads to a missing model. */
export function availableEffects(
  installed: readonly { id: string }[]
): Effect[] {
  return EFFECTS.filter((e) => installed.some((m) => m.id === e.modelId))
}

export function findEffect(id: string | null | undefined): Effect | undefined {
  return id ? EFFECTS.find((e) => e.id === id) : undefined
}

/** The generator link that opens this effect. */
export const effectHref = (e: Effect): string =>
  `/${e.surface}?model=${encodeURIComponent(e.modelId)}&effect=${encodeURIComponent(e.id)}`
