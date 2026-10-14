# Roadmap, recommendations and open questions

Status of the design.ai build against the build prompt's phases, what I
recommend before launch, and the decisions only the owner can make. Updated
2026-10-14.

## Phase status

| Phase | Status | Notes |
|---|---|---|
| 0. Research | Partial | `ui-inventory.md` from owner screenshots; `tools/jev` can now fill the rest. `docs.higgsfield.ai` is blocked from the build container, so `model-catalog.md` is still to write. |
| 1. Scaffold | Done | Higgsfield Studio template in `studio/`. Still BYOK (each user pastes a key); swapping to one platform key waits on Phase 2 auth. |
| 2. Auth | Not started | Needs MongoDB Atlas and Resend. |
| 3. Generation core | Partial | Template submit, poll, cancel and upload work with a user key. Not yet: server key, Mongo history, webhook, reconciler, R2 copy. No live generation tested yet (no key in the container). |
| 4. All models | Partial | 38 template entries. Audio and the "check and add" list need the live docs. |
| 5. Credits and Stripe | Not started | Needs final prices and a Stripe account. |
| 6. UI clone | In progress | Top nav, menus, Explore and `?model=` routes done. Next: left-panel generator, then Pricing, Effects, Community, Account. |
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

## Questions for you

Decisions that block later phases, roughly in the order they're needed:

1. **JEV Part B:** your master prompt was cut off at §5; Part B (JEV) never
   arrived. Is anything in it beyond inventory and smoke runs?
2. **Repository:** move the studio to its own repo now (recommended), or keep
   it in `Slyknox/higgsfield`?
3. **Brand:** final name, logo, `PRODUCTION_URL`, `EMAIL_FROM` and
   `SUPPORT_EMAIL`.
4. **Key model:** one platform key you fund (the build prompt's plan), or keep
   bring-your-own-key (no billing needed)? Have you confirmed resale terms with
   Higgsfield?
5. **Accounts:** do you have MongoDB Atlas, Resend (with a verified domain),
   Stripe, Cloudflare R2 and Vercel? Add their keys as environment secrets,
   never in chat.
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
