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
