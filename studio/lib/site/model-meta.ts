import type { ModelEntry } from "@/generation/catalog"

// Picker and Explore copy, kept apart from generation/catalog/models/* so the
// model files stay refreshable with `shadcn add ... --overwrite`.
export type ModelBadge = "TOP" | "NEW" | "FAST" | "4K" | "AUDIO"

export type ModelMeta = {
  description: string
  badge?: ModelBadge
}

const META: Record<string, ModelMeta> = {
  "soul-2": {
    description: "Photoreal people and fashion imagery",
    badge: "TOP",
  },
  "soul-cinema": { description: "Film-grade stills with cinematic grading" },
  "flux-2": { description: "Precise prompt following and clean typography" },
  "grok-imagine-2": { description: "Bold, stylised images from short prompts" },
  "ideogram-4": {
    description: "Posters and layouts with sharp text rendering",
  },
  "recraft-4.1": { description: "Brand-ready illustration and vector styles" },
  "qwen-image-3": {
    description: "Detailed scenes with strong multilingual text",
  },
  "z-image-turbo": {
    description: "Fast drafts for quick iteration",
    badge: "FAST",
  },

  "seedance-2.5": {
    description: "Cinematic videos up to 30 seconds with audio",
    badge: "TOP",
  },
  "seedance-2.5-edit": {
    description: "Edit an existing clip with a text prompt",
    badge: "NEW",
  },
  "seedance-2.5-extend": {
    description: "Continue a clip forward with matching motion",
    badge: "NEW",
  },
  "seedance-2": { description: "Multi-shot video with native 4K output" },
  "seedance-2-fast": {
    description: "Seedance 2.0 quality at lower latency",
    badge: "FAST",
  },
  "seedance-2-mini": { description: "Affordable Seedance clips for drafts" },
  "kling-3-turbo": {
    description: "Quick Kling 3.0 renders from a frame",
    badge: "FAST",
  },
  "kling-3-std": { description: "Cinematic videos with audio" },
  "kling-3-pro": { description: "Higher-fidelity Kling 3.0 motion" },
  "kling-3-4k": { description: "Kling 3.0 rendered in 4K", badge: "4K" },
  "kling-3-motion-std": {
    description: "Transfer motion from a video onto an image",
  },
  "kling-3-motion-pro": { description: "Pro-quality motion transfer" },
  "kling-2.6": { description: "Reliable image-to-video with natural motion" },
  "kling-2.5": { description: "Fast, affordable Kling motion" },
  "kling-o3": {
    description: "Omni model for first and last frame transitions",
  },
  "kling-o1": { description: "Omni first-to-last frame transitions" },
  "wan-3": { description: "Videos from text, keyframes or references" },
  "wan-3-prime": { description: "Wan 3.0 at its highest quality" },
  "wan-2.7": { description: "Expressive motion from text or a frame" },
  "wan-2.6": { description: "Balanced quality and speed" },
  "flux-3": {
    description: "Text and image to video with synchronized audio",
    badge: "AUDIO",
  },
  "minimax-h3": { description: "2K videos from text, keyframes or references" },
  "minimax-hailuo-2.3": { description: "Dynamic action and physics" },
  "happy-horse-1": { description: "Alibaba's video and audio model" },
  "happy-horse-1.1": {
    description: "Latest Happy Horse with sharper motion",
    badge: "NEW",
  },
  "ltx-2.5-fast": { description: "Quick LTX drafts", badge: "FAST" },
  "ltx-2.5-pro": { description: "LTX at production quality" },
  "grok-imagine-video-1.5": {
    description: "Cinematic videos with synchronized audio",
    badge: "AUDIO",
  },
  "pixverse-6": { description: "Stylised clips with expressive effects" },
  dop: { description: "Camera-move presets from a single image" },
}

export function modelMeta(
  model: Pick<ModelEntry, "id" | "surface">
): ModelMeta {
  return (
    META[model.id] ?? {
      description:
        model.surface === "image" ? "Image generation" : "Video generation",
    }
  )
}
