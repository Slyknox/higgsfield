import "server-only"

import { z } from "zod"

import { outboxAllowed } from "@/lib/auth/policy"

// Validated separately from sign-in, so a missing Higgsfield or R2 setting
// stops generation with a clear error without taking sign-in down too.
const schema = z
  .object({
    AUTH_URL: z.url().optional(),
    HF_API_BASE_URL: z.url().default("https://api.higgsfield.ai"),
    // The complete key copied from open.higgsfield.ai/api-keys.
    HF_API_KEY: z.string().min(8, "HF_API_KEY is required for generation"),
    // Public base URL Higgsfield can reach; unset = rely on polling (local dev).
    HF_WEBHOOK_BASE_URL: z.url().optional(),
    HF_WEBHOOK_SECRET: z.string().min(32).optional(),
    MAX_CONCURRENT_GENERATIONS: z.coerce
      .number()
      .int()
      .min(1)
      .max(20)
      .default(4),
    STORAGE_DRIVER: z.enum(["r2", "local"]).default("local"),
    LOCAL_MEDIA_DIR: z.string().default(".data/media"),
    R2_ACCOUNT_ID: z.string().optional(),
    R2_ACCESS_KEY_ID: z.string().optional(),
    R2_SECRET_ACCESS_KEY: z.string().optional(),
    R2_BUCKET: z.string().optional(),
    R2_PUBLIC_BASE_URL: z.url().optional(),
  })
  .superRefine((env, ctx) => {
    if (env.HF_WEBHOOK_BASE_URL && !env.HF_WEBHOOK_SECRET)
      ctx.addIssue({
        code: "custom",
        path: ["HF_WEBHOOK_SECRET"],
        message: "required with HF_WEBHOOK_BASE_URL (32+ chars)",
      })
    if (env.STORAGE_DRIVER === "local" && !outboxAllowed(env.AUTH_URL))
      ctx.addIssue({
        code: "custom",
        path: ["STORAGE_DRIVER"],
        message:
          "local storage is for localhost only; set STORAGE_DRIVER=r2 and the R2_* variables",
      })
    if (env.STORAGE_DRIVER === "r2")
      for (const key of [
        "R2_ACCOUNT_ID",
        "R2_ACCESS_KEY_ID",
        "R2_SECRET_ACCESS_KEY",
        "R2_BUCKET",
        "R2_PUBLIC_BASE_URL",
      ] as const)
        if (!env[key])
          ctx.addIssue({
            code: "custom",
            path: [key],
            message: "required when STORAGE_DRIVER=r2",
          })
  })

export type GenerationEnv = z.infer<typeof schema>

let cached: GenerationEnv | undefined

export class GenerationUnavailableError extends Error {
  constructor(problems: string) {
    super(`Generation is not configured:\n${problems}`)
    this.name = "GenerationUnavailableError"
  }
}

export function getGenerationEnv(): GenerationEnv {
  if (cached) return cached
  const result = schema.safeParse(process.env)
  if (!result.success)
    throw new GenerationUnavailableError(
      result.error.issues
        .map((i) => `  ${i.path.join(".")}: ${i.message}`)
        .join("\n")
    )
  cached = result.data
  return cached
}
