import "server-only"

import { z } from "zod"

import { outboxAllowed } from "@/lib/auth/policy"

const schema = z
  .object({
    DATABASE_URL: z.url({ message: "DATABASE_URL must be a Postgres connection URL" }),
    AUTH_SECRET: z.string().min(32, "AUTH_SECRET must be at least 32 characters (npx auth secret)"),
    AUTH_URL: z.url().optional(),
    EMAIL_TRANSPORT: z.enum(["resend", "outbox"]).default("resend"),
    AUTH_RESEND_KEY: z.string().optional(),
    EMAIL_FROM: z.string().min(3).default("design.ai <login@example.com>"),
  })
  .superRefine((env, ctx) => {
    if (env.EMAIL_TRANSPORT === "resend" && !env.AUTH_RESEND_KEY)
      ctx.addIssue({ code: "custom", path: ["AUTH_RESEND_KEY"], message: "required when EMAIL_TRANSPORT=resend" })
    if (env.EMAIL_TRANSPORT === "outbox" && !outboxAllowed(env.AUTH_URL))
      ctx.addIssue({
        code: "custom",
        path: ["EMAIL_TRANSPORT"],
        message: "outbox is local-only: set AUTH_URL to a localhost URL, or use resend",
      })
  })

export type ServerEnv = z.infer<typeof schema>

let cached: ServerEnv | undefined

/** Validated server environment. Read lazily so `next build` works without secrets. */
export function getEnv(): ServerEnv {
  if (cached) return cached
  const result = schema.safeParse(process.env)
  if (!result.success) {
    const problems = result.error.issues.map((i) => `  ${i.path.join(".")}: ${i.message}`).join("\n")
    throw new Error(`Invalid server environment:\n${problems}`)
  }
  cached = result.data
  return cached
}
