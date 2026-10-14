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
