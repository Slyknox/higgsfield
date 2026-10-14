# Roadmap, recommendations and open questions

Status of the design.ai build against the build prompt's phases, what I
recommend before launch, and the decisions only the owner can make. Updated
2026-10-14.

## Phase status

| Phase | Status | Notes |
|---|---|---|
| 0. Research | Partial | `ui-inventory.md` from owner screenshots; `tools/jev` can now fill the rest. `docs.higgsfield.ai` is blocked from the build container, so `model-catalog.md` is still to write. |
| 1. Scaffold | Done | Higgsfield Studio template in `studio/`. Still BYOK (each user pastes a key); swapping to one platform key waits on Phase 2 auth. |
| 2. Auth | Done (local) | Magic-link sign-in on Postgres, tested end to end with the local outbox. Needs Supabase and Resend keys to go live (`docs/setup.md`). |
| 3. Generation core | Done (offline) | Platform key, Postgres history per user, webhook, cron reconciler, R2/local copy, cancel, delete. Tested against a fake Higgsfield; not yet against the real API (no key here). |
| 4. All models | Partial | 38 template entries. Audio and the "check and add" list need the live docs. |
| 5. Credits and Stripe | Not started | Needs final prices and a Stripe account. |
| 6. UI clone | In progress | Top nav, menus, Explore, `?model=` routes and the left-panel generator done. Next: Pricing, Account, Effects and Community (after Phases 2 and 5). |
| 7. Content and polish | Not started | Cover media needs a generation budget. |
| 8. Hardening and deploy | Not started | |
| Dev tooling: JEV | Done | `tools/jev`: inventory and smoke runs, developer-only, guarded. |

## Recommendations

### Before anything is public

1. **Don't deploy with a shared Higgsfield key until auth, credits and rate
   limits exist.** A public page backed by one funded key is an open wallet.
   Until Phase 5, the current bring-your-own-key mode is the only safe public
   mode.
2. **Confirm resale rights with Higgsfield.** Reselling generations at a
   markup through their API, plus the underlying providers' terms (ByteDance,
   Kling, Google and so on), needs their business terms in writing. This
   decides whether the product can exist in its planned form.
3. **Get a trademark and domain check for the brand.** "design.ai" is a
   generic, likely-taken name (Designs.ai already exists). Pick a name you can
   own before buying ads or printing it on a Stripe statement.
4. **Write content and likeness rules.** Video models can make realistic
   people. You need a ToS, an acceptable-use policy (no non-consensual
   likeness, minors, impersonation), a report button, and a takedown process.
   Higgsfield's `nsfw` status handles some of this, not all of it.

### Architecture

5. **Give the studio its own repository.** It currently lives inside a fork of
   Higgsfield's GPU training framework, whose root `LICENSE` (Apache-2.0) and
   CI belong to that project. A clean `Slyknox/<brand>-studio` repo avoids
   licence ambiguity and noisy history. Moving now is cheap; later it's
   painful.
6. **Keep the template's contracts.** Model files stay registry-refreshable
   (copy lives in `lib/site/model-meta.ts`). `useRuns` keeps its interface when
   history moves to MongoDB.
7. **Run long work off the request path.** Copying a 30-second video to R2 can
   outlast a serverless function. Run the copy from the webhook or reconciler
   with Vercel's `waitUntil` or a queue, and make it idempotent.
8. **Prepaid credits only.** No post-paid usage. Debit before submit, refund
   on `failed`/`nsfw`/`canceled`, all in one Mongo transaction, as the build
   prompt specifies.
9. **Add observability from day one.** Error tracking (Sentry or similar),
   structured logs that never contain signed upload URLs or keys, and an
   admin view of stuck generations.

### Pricing (from the console prices observed on 2026-10-14)

10. **Price from list prices, not promotional ones.** Seedance 2.5 lists at
    $0.206/s, so a 5-second 720p clip costs about $1.03; at a 2× markup that's
    about $2.06 retail. Kling 3.0 is $0.084/s, about $0.42 for 5 seconds. Put
    the cost on the Generate button ("Generate ✦ 206").
11. **Keep a per-user daily spend cap** and Stripe Radar on, so a stolen card
    can't drain your Higgsfield balance before the chargeback lands.
12. **Keep your Higgsfield balance topped up with alerts.** If it runs dry,
    every user's generation fails at once.

### Testing and CI

13. **CI for the studio on every push:** typecheck, lint, unit tests and build.
    Added in `.github/workflows/studio.yml`.
14. **Playwright end-to-end tests in CI** for sign-in, generate (with a stubbed
    Higgsfield), cancel, refund and Stripe test mode. Deterministic; these gate
    merges.
15. **JEV stays local.** It needs your Chrome and a paid key, and it isn't
    deterministic, so it supplements Playwright and never gates CI. Run it in a
    separate Chrome profile with no Higgsfield or payment sessions.

### Product

16. **Ship image and video first, audio second.** Audio needs models verified
    against the live docs.
17. **Make Explore media our own.** Generate covers with the app itself
    (Phase 7). Never use Higgsfield's media or copy; `ui-inventory.md` notes are
    for structure only.

## What's still missing

Everything not yet built, by priority. **P0** blocks a public launch, **P1**
should follow within weeks, **P2** can wait.

### Core product

| Item | Priority | Notes |
|---|---|---|
| Server-side generation with the platform key | Done | Phase 3. Needs `HF_API_KEY` to go live. |
| Generation history in Postgres, owned per user | Done | Phase 3. |
| Higgsfield webhook + reconciler + R2 copy | Done | Phase 3. Needs R2 keys and a public URL to go live. |
| Credits, pricing, Stripe Checkout, Portal, webhooks | P0 | Phase 5. Needs your prices. |
| Pricing page, Account page (balance, history, plan) | P0 | After Phase 5. |
| Reference uploads tied to users, size and rate limits | Partial | Recorded per user and rate-limited; the library still lists them from the browser. |
| Projects in Postgres (today: browser only) | P1 | |
| Audio surface (Seed Audio, TTS, music) | P1 | Needs model schemas from docs.higgsfield.ai. |
| Effects / presets gallery with our own covers | P1 | Phase 7 content. |
| Community feed (publish, report, moderate) | P2 | Adds moderation load; launch without it. |
| Upscale, background removal, outpaint | P2 | Only if the REST API exposes them. |
| Admin panel (users, credits, generations, moderation) | P1 | Needed before the first support ticket. |

### Legal and trust & safety

| Item | Priority | Notes |
|---|---|---|
| Written resale permission from Higgsfield | P0 | The business model depends on it. |
| Terms of Service, Privacy Policy, Acceptable Use Policy | P0 | Have a lawyer review; AI-generated likeness is a live legal area. |
| Prompt screening before submit, report button, takedown process | P0 | Higgsfield's `nsfw` status is a backstop, not a policy. |
| Child-safety process | P0 | US platforms that host user content must report child sexual abuse material to NCMEC. Have a written process and a contact. |
| Cookie consent and analytics opt-in (EU/UK) | P0 if you serve the EU | |
| Account deletion and data export (GDPR/CCPA) | P1 | Deletes rows, sessions and R2 files. |
| Age gate (13+ or 18+) | P0 | Decide with your lawyer; affects ToS and sign-up. |
| Trademark search for the final brand | P0 | |

### Security and abuse

| Item | Priority | Notes |
|---|---|---|
| Security headers and Content Security Policy | P0 | Allow only our media hosts, Stripe and Higgsfield uploads. |
| Per-user generation rate and concurrency limits | P0 | Phase 3 (concurrency) and Phase 5 (spend). |
| Bot protection on sign-in (Cloudflare Turnstile) | P1 | Rate limits exist; Turnstile stops scripted sign-ups. |
| Disposable-email blocking for sign-up bonuses | P1 | Only matters once free credits exist. |
| Daily spend cap per user, Stripe Radar | P0 | Stops a stolen card draining your Higgsfield balance. |
| Dependency and secret scanning (Dependabot, GitHub secret scanning) | P1 | Free on GitHub; turn on in the new repo. |
| Review `next-auth` beta pin each release | P1 | v5 is still beta on npm. |

### Operations

| Item | Priority | Notes |
|---|---|---|
| Error tracking (Sentry) and structured logs | P0 | Logs must never contain keys, signed URLs or magic links. |
| Uptime monitoring and alerts | P1 | Site, webhook endpoint, Stripe webhook. |
| Higgsfield balance alert | P0 | An empty balance fails every user's generation at once. |
| Staging environment (Vercel Preview + Supabase branch) | P1 | Test migrations before production. |
| Database backups (Supabase point-in-time recovery) | P1 | Paid Supabase add-on; worth it once you take payments. |
| Email deliverability (SPF, DKIM, DMARC on your domain) | P0 | Without them magic links land in spam. |
| Migrations in the deploy pipeline | P1 | Today `pnpm db:migrate` runs by hand. |

### Business and billing

| Item | Priority | Notes |
|---|---|---|
| Final prices, credit markup, free credits | P0 | Your decision; see Pricing above. |
| Sales tax / VAT (Stripe Tax) | P0 | Required in many places for digital goods. |
| Refund and chargeback policy | P0 | Credits for failed generations are refunded automatically. |
| Receipts and invoices | P1 | Stripe sends receipts; add your own "credits added" email. |
| Support inbox and help pages | P1 | |

### Quality

| Item | Priority | Notes |
|---|---|---|
| Live test of every model family with the real key | P0 | Only Seedance 2.5's request shape is tested so far, offline. |
| `docs/model-catalog.md` checked against docs.higgsfield.ai | P0 | Allow that host in the environment settings. |
| Accessibility pass (keyboard, contrast, screen reader) | P1 | |
| SEO: metadata, Open Graph images, sitemap | P1 | |
| Load test of submit, status and webhook routes | P2 | Before paid marketing. |

## Questions for you

Decisions that block later phases, roughly in the order they're needed:

1. **JEV Part B:** your master prompt was cut off at §5; Part B (JEV) never
   arrived. Is anything in it beyond inventory and smoke runs?
2. **Repository (answered: new repo).** Create an empty private
   `Slyknox/design-ai-studio` and give the Claude GitHub App access; the
   integration can't create repos itself.
3. **Brand:** final name, logo, `PRODUCTION_URL`, `EMAIL_FROM` and
   `SUPPORT_EMAIL`.
4. **Key model (answered: platform key).** Have you confirmed resale terms
   with Higgsfield?
5. **Accounts (answered):** Supabase, Resend, Stripe, Vercel and R2. Add their
   keys as environment secrets, never in chat. Supabase replaces MongoDB.
6. **Pricing:** `CREDIT_MARKUP`, plan prices (Starter / Plus / Ultra, monthly
   and annual), top-up packs, and free sign-up credits.
7. **Content policy:** are realistic people allowed? Age limit? Which regions
   do you serve (EU cookie consent, GDPR)?
8. **Cover media budget:** may I spend your Higgsfield credits on Explore and
   preset covers (about $1–2 per 5–10 second Seedance clip)?
9. **Network access:** allow `docs.higgsfield.ai` (model schemas), and
   optionally `api.typesafe.ai` and `higgsfield.ai` (JEV), in the cloud
   environment settings.
10. **Hosting:** is Vercel the target? It decides the cron, queue and
    timeout design in Phase 3.
