# Studio setup decisions

## Source

`studio/` is the Higgsfield Studio template (`higgsfield-ai/app-templates`,
registry item `studio`, commit `1e15e224f2815d7d854ea3df27aded6f4e6fefdd`).
`pnpm dlx shadcn init ... higgsfield-ai/app-templates/studio` could not finish
in the build container: its proxy blocks `ui.shadcn.com`. The template's
tracked files were copied in instead. The result is the same source the
registry would install.

`higgsfield-ai/app-templates` had no LICENSE file at that commit. Higgsfield
publishes it as a public registry for building apps on its API. Check for a
license again before launch.

## Changes from the template

- Removed `.npmrc`. It pointed pnpm at Higgsfield's internal package mirror
  (`socket-firewall.higgsfield.xyz`), which outside users can't reach.
  `pnpm-lock.yaml` pins packages by integrity hash, so installs from the public
  npm registry resolve the same packages.
- Added `tests/seedance-2.5.test.mjs`. It pins Seedance 2.5 as the default
  video model and checks each mode's endpoint and request body.

## Seedance 2.5

The catalog file is `generation/catalog/models/seedance-2.5.ts`. Requests go
to `HF_API_BASE_URL` (`https://api.higgsfield.ai`) with
`Authorization: Key <api-key>`.

| UI mode | Endpoint | Media fields |
|---|---|---|
| Prompt only | `bytedance/seedance-2.5/text-to-video` | none (`aspect_ratio` sent) |
| Start / end frame | `bytedance/seedance-2.5/image-to-video` | `image_url`, `end_image_url` |
| References | `bytedance/seedance-2.5/reference-to-video` | `image_urls` (≤30), `video_urls` (≤10), `audio_urls` (≤10) |
| Seedance 2.5 Edit | `bytedance/seedance-2.5/video-edit` | `video_url` plus optional references |
| Seedance 2.5 Extend | `bytedance/seedance-2.5/video-extend` | `video_url` plus optional references |

Settings sent: `resolution` (480p/720p), `generate_audio`, `duration` (4–30 s),
`bitrate_mode` (standard/high), `aspect_ratio` (text and reference modes).

### Not verified

- `docs.higgsfield.ai` was unreachable from the build container, so the
  mapping above comes from the template, not from the live docs. Check each
  endpoint's Input JSON Schema there before launch.
- Higgsfield's agent/CLI catalog (`seedance_2_5`) lists `1080p` and a
  `draft` / `draft_job_id` finalize flow. Those belong to a different API (job
  sets, not the REST paths above). The template only offers 480p/720p, and
  1080p was not added because REST support for it is unconfirmed.
- No live generation was run: no API key was available. Generation, cancel and
  reference uploads still need testing with a real key.
- All 28 installed model files stay in the picker. Only Seedance 2.5 is
  covered by the new tests.

## Site frame (Phase 6, first pass)

- **Brand:** `design.ai`, taken from the `BRAND_NAME` value in the build
  prompt. One place to change it: `lib/site/brand.ts`.
- **Top nav:** the template contract says "no app header"; the build prompt
  overrides it with the higgsfield.ai nav. The studio shell sits under it at
  `100dvh - 56px` and keeps its own sidebar, dock and feed.
- **Routes:** `/` Explore, `/image` and `/video` (accepting `?model=`), and
  `/assets` (the feed view). Nav links appear only for pages that exist.
- **URL sync:** `?model=` is applied on load. The URL is rewritten only when
  the user picks a model, so a model remembered in localStorage can't override
  a shared link.
- **Model copy:** descriptions and badges live in `lib/site/model-meta.ts`, not
  in the model files, so those stay refreshable from the registry. A test
  fails if an installed model has no description.
- **Badges:** use lime (`bg-primary`) like higgsfield.ai, a small exception to
  the template's "lime only for Generate and active states" rule.
- **Explore art:** abstract per-provider gradients, not fake product
  screenshots. They're replaced by our own generated media in Phase 7.

## Generator layout (Phase 6, second pass)

- **`/image` and `/video`** use `layouts/generator.tsx`: the higgsfield.ai
  left control panel (mode tabs, model card with Change, inputs, prompt,
  settings, sticky Generate) and a right canvas (History / How it works).
  `/assets` keeps the template's projects sidebar and feed.
- **One dock implementation.** The dock's state and actions moved from
  `layouts/studio.tsx` into `lib/studio/use-studio-dock.ts`; both layouts call
  it, so validation, generate, cancel and uploads can't drift apart.
- **Reused, not forked:** `MediaInputs`, `ReferencePicker`, `PillSelect` and
  `modelIcon` are now exported from `studio-prompt-box.tsx` (backward
  compatible; `ReferencePicker` takes an optional custom trigger).
- **Mode tabs** come from the catalog (`lib/site/model-modes.ts`): a model that
  needs a source clip is an editor, a `motion` model is Motion Control, the
  rest create. Image has a single mode, so it shows no tabs.
- **No Frames / References sub-tabs.** The build prompt lists them, but the
  template contract says to infer the input mode from attachments. The
  template wins on UI patterns: frame slots and the reference drop zone
  are both shown, and mixing them is blocked with a plain error.
- **The key button sits in the canvas header** because the generator has no
  sidebar. KeyDialog stays the only place that collects a key. Both go away
  when Phase 2 moves to a server-side platform key.

## Sign-in (Phase 2)

- **Postgres on Supabase, not MongoDB.** The owner has Supabase and no Atlas
  account. Postgres also suits the credit ledger better: one transaction can
  debit credits and record the generation together. Data access uses `pg`
  directly; the Supabase JS client and Supabase Auth are not used.
- **Auth.js v5 (`next-auth@5.0.0-beta.32`, pinned exactly)** with
  `@auth/pg-adapter` 1.11.3; both use `@auth/core` 0.41.3. v5 is still
  published as beta on npm; pinning avoids silent upgrades.
- **Database sessions** (revocable; the role is read fresh on every request).
- **Row level security** is on for every table with no policies, so
  Supabase's public API can't read users, sessions or tokens.
- **Email transport:** `resend` sends the React Email template; `outbox`
  writes links to `email_outbox` for local development and tests. It is
  refused unless `AUTH_URL` is localhost.
- **Rate limits** live in Postgres (atomic upsert): 5 emails per address and
  20 requests per IP per hour. The per-address check sits inside
  `sendVerificationRequest`, so direct POSTs to the Auth.js endpoint hit it
  too.
- **`signIn(..., { redirect: false })`** keeps the check-email page on a clean
  URL. Auth.js then reports a failed send as an `?error=` URL, not an
  exception; `sendFailed()` treats that as failure. The E2E rate-limit test
  caught the page saying "Check your email" when nothing had been sent.
- **Signed-out Generate** saves the prompt as a draft in `localStorage`,
  sends the user to sign in, and restores it on return, even when the magic
  link opens a new tab.
- **Route protection is per page** (`/assets` redirects to sign-in) rather
  than in `proxy.ts`. Server actions and route handlers will check the
  session themselves (Phase 3).
- **Still bring-your-own-key** for generation until Phase 3 moves to the
  platform key.

## Server-side generation (Phase 3)

- **One platform key, `HF_API_KEY`**: the complete key copied from
  open.higgsfield.ai, as Higgsfield's current guidance describes. The build
  prompt's `HF_CREDENTIALS=key_id:key_secret` predates that format. The
  per-user key dialog, key cookie and device cookie (`proxy.ts`) are gone.
- **Generation settings are validated separately from sign-in**
  (`lib/server/generation-env.ts`), so a missing R2 or Higgsfield setting
  disables generation with a clear log line but never breaks sign-in.
- **The service takes its dependencies** (`lib/generations/service.ts`:
  database, platform, storage), so the same code runs in production and in
  tests against Postgres and a fake Higgsfield over HTTP.
- **Per-user concurrency** (default 4) is enforced under a Postgres advisory
  lock, so two tabs can't both slip under the limit. A mutation test proved
  the test fails without the lock.
- **Submit retries only on 429.** Any other failure might already have
  created the request, and Higgsfield has no idempotency key, so a retry
  could bill twice. Those runs are marked failed at once (they'll be refunded
  in Phase 5) rather than left for a reconciler that couldn't find them
  anyway.
- **Results arrive three ways, all idempotent**: the webhook (HMAC token in
  the URL, payload never trusted, status re-fetched, R2 copy run after the
  reply with `after()`), a per-minute Vercel Cron (`vercel.json`), and the
  status route refreshing the caller's own stale rows. That last one departs
  from the build prompt's "status route only reads the DB": without it, local
  development (no public URL) and Vercel Hobby (daily cron) would leave runs
  hanging. It only touches the caller's rows, at most 8 per poll.
- **Final writes are conditional** (`where status in in-flight`), so the
  webhook, cron and status route can race safely; storage keys are
  deterministic (`u/<user>/<generation>/<n>.<ext>`), so a duplicate copy just
  overwrites.
- **Storage**: R2 through its S3 API (`aws4fetch`), or local disk served by
  `/api/media` (localhost only, refused otherwise). Copies are buffered in
  memory, capped at 512 MB.
- **Logs** carry method, path and status only: no prompts, no webhook tokens,
  no signed or media URLs.
- **The template's shadcn registry build is removed** (`prebuild`,
  `registry.json`): publishing a registry is the template repo's job, and it
  listed files this app deleted.
- **Not yet:** reference uploads are recorded per user but the asset library
  still lists them from the browser; projects are still browser-local.

## Credits, projects, account, effects, admin

- **Billing is a switch.** `BILLING_ENABLED=false` (default) leaves
  generations free; `true` charges prepaid credits (1 credit = $0.01). The
  same `priceOf` runs on the server and on the Generate button.
- **Debit inside the insert transaction**, under the existing per-user
  advisory lock: no credits means no row and nothing sent to Higgsfield.
  Refunds are one SQL statement guarded by a unique index on
  `(generation_id, reason)`, so the webhook, status route and reconciler can
  all call it. The reconciler also retries refunds that failed.
- **Prices only for observed list prices** (Seedance 2.5, Kling 3.0 Standard,
  MiniMax H3). Every other model, including Pro/4K/Edit variants, uses a
  deliberately high fallback marked "estimated" until its price is known.
- **Deleting a running generation** refunds only if Higgsfield accepted the
  cancel; otherwise it still bills us.
- **Projects use browser-chosen UUIDs**, so a project is usable before the
  insert returns. A generation joins a project only if the user owns it.
  Old browser-only projects are imported once, then cleared.
- **The upload library lists confirmed uploads only.** The row is written
  when the signed URL is issued; the browser confirms after its PUT.
- **Account deletion** asks for the email typed back, cancels running work,
  deletes the user (rows cascade) and then the stored files. It refuses to
  run without storage settings rather than leave files behind.
- **Effects** are recipes (model + prompt + settings) in
  `lib/site/effects.ts`. A link carries `?model=` and `?effect=`; the
  generator fills the prompt and settings once and the user presses
  Generate. The template picker draws from the same list, so the scaffold's
  placeholder art is gone.
- **Admin** is a 404 for non-admins. Every admin page and action calls
  `requireAdmin()`. Credit adjustments go through the ledger with the admin's
  id and a reason the user sees. Roles are set with `pnpm admin:role`.
- **Sign-up credits once per address.** `signup_grants` keeps a SHA-256 of
  the lower-case email after an account is deleted, so delete-and-rejoin
  can't farm `SIGNUP_CREDITS`. It's unsalted, so it is still personal data:
  mention it in the privacy policy.
- **Admin pages each call `requireAdmin()`.** A client can claim the `/admin`
  layout is already rendered (`Next-Router-State-Tree`) and receive only the
  page segment, so a layout-only gate leaked admin data. An E2E test forges
  that header.
- **Cancel is refused while a generation is still submitting**: there's no
  Higgsfield request to cancel yet, and refunding would let the job run free.
- **Known gap:** account deletion removes the files it can list. A finalizer
  already copying a file at that moment can leave one public file behind.
  Listing the user's storage prefix after deletion would close it.

