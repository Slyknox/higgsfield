import NextAuth from "next-auth"
import Resend from "next-auth/providers/resend"
import PostgresAdapter from "@auth/pg-adapter"

import { MAGIC_LINK_LIMITS, MAGIC_LINK_MINUTES } from "@/lib/auth/policy"
import { hitRateLimit } from "@/lib/auth/rate-limit"
import { getPool } from "@/lib/server/db"
import { sendMagicLink } from "@/lib/server/email"
import { getEnv } from "@/lib/server/env"

// Config is built per request (lazy), so `next build` runs without secrets.
export const { handlers, auth, signIn, signOut } = NextAuth(() => {
  const env = getEnv()
  const pool = getPool()
  return {
    adapter: PostgresAdapter(pool),
    secret: env.AUTH_SECRET,
    trustHost: true,
    // Database sessions: revocable server-side, and the role is read fresh.
    session: { strategy: "database", maxAge: 30 * 24 * 60 * 60 },
    providers: [
      Resend({
        from: env.EMAIL_FROM,
        apiKey: env.AUTH_RESEND_KEY ?? "outbox",
        maxAge: MAGIC_LINK_MINUTES * 60,
        async sendVerificationRequest({ identifier, url }) {
          // Also covers direct POSTs to /api/auth/signin/resend that skip the login form.
          const { perEmail } = MAGIC_LINK_LIMITS
          const hit = await hitRateLimit(pool, `magic-link:email:${identifier}`, perEmail.limit, perEmail.windowSeconds)
          if (!hit.allowed) throw new Error("Too many sign-in emails for this address")
          await sendMagicLink({ to: identifier, url })
        },
      }),
    ],
    pages: {
      signIn: "/login",
      verifyRequest: "/login/check-email",
      error: "/login/error",
    },
    callbacks: {
      session({ session, user }) {
        session.user.id = String(user.id)
        session.user.role = user.role === "admin" ? "admin" : "user"
        return session
      },
    },
  }
})
