# UI inventory

Built from the owner's screenshots of higgsfield.ai and open.higgsfield.ai
(2026-10-14) and the page text they pasted. Copy the layout and behaviour; the
brand, copy and media are ours (`lib/site/brand.ts`).

## higgsfield.ai: global chrome

- **Top nav:** logo, Explore, Image, Video, Audio, MCP, API, then product
  links (Genjutsu, Katana, AI Influencer, Ads Studio, Effects, Cinema Studio,
  Contests), search, Upgrade (with a "30% OFF" tag), Enterprise, Assets,
  account. The active item is lime.
  - **Ours:** Explore, Image, Video and Assets. Only pages that exist get a
    link. Audio, Effects, Community and Pricing get links when they're built.
- **Image / Video menus:** a wide two-column popover. "Features" (Create Video,
  Cinema Studio, Edit Video, Reframe, Motion Control, ...) sits on the left;
  "Models" sits on the right, each row with logo tile, name, TOP/NEW badge and
  one-line description.
  - **Ours:** same shape. Features are modes our models really support
    (Create, Edit, Extend, Motion Control; Create Image, Cinematic Stills).
    Models come from the catalog in picker order.
- **Footer:** columns for Create, Video Models, Image Models, Studios,
  Platform, Resources, Company and Community, plus legal and social links.
  - **Ours:** Create, Video models, Image models. Legal links come with the
    legal pages.

## higgsfield.ai: Explore (`/`)

1. Promo strip ("Unlimited Seedance 2.5 at 720p for 30 days...").
2. Spotlight carousel. Large media cards, each with an uppercase title (the
   first in lime) and a one-line subtitle (Wan 3.0, Genjutsu, Genjutsu API,
   Katana, Ads Studio).
3. Promo banner (left) beside a 2×3 grid of feature cards. Each card has an
   icon, an optional "Video" tag, name plus badge, and a description.
4. Feature hero (AI Influencer), a festival voting module, an MCP block.
5. Visual Effects preset strip ("View all presets").
6. Per-model community galleries (Seedance 2.5, GPT Image 2, Soul, Marketing
   Studio), public projects, Canvas, Photodump.
7. "Explore more AI features" link cloud, then the footer.

**Ours:** 1 to 3 plus a model directory (All / Image / Video tabs, like
open.higgsfield.ai/explore). Cards use abstract per-provider art until Phase 7
replaces it with our own generated media. Higgsfield-only products (Genjutsu,
Katana, Cinema Studio, Supercomputer, AI Influencer, unlimited plans) are left
out: they are not reachable through the public REST API, or they are their
brand.

## higgsfield.ai: generator (`/ai/video?model=seedance_2_5`)

- The model is in the URL (`?model=seedance_2_5`, and `&resolution=1080p` on
  the Seedance link).
- Right-hand feed with List/Grid toggle and density slider; result cards show
  model, resolution and date.
- **Ours:** `/video?model=<id>` and `/image?model=<id>`. Catalog ids and
  Higgsfield-style ids (`seedance_2_5`) both resolve. Picking a model rewrites
  the URL. The left control-panel layout from §9 of the build prompt is still
  to do; today the generator is the template's dock and feed.

## higgsfield.ai/mcp

Tabs: ChatGPT Plugin, Claude, Claude Code, CLI, Other. The Claude Code tab
shows the CLI setup prompt and a preset grid filtered by category (All
presets, For After Effects, Paid Ads, Motion Design, Production, Marketing,
Faceless, UGC) with bundles. Each preset is a slash workflow such as
`/marketing-localize-ads`.

**Not cloneable as-is:** these run through Higgsfield's agent/MCP stack, not
the REST generation API. It's a pattern for a future Effects/presets gallery
(category chips, cover card, slash name and description).

## open.higgsfield.ai (API console, reference only)

- Left rail: Dashboard, Explore models, Quick start, Documentation, Pricing,
  then API keys, Cashback, Analytics and Billing, then Top up, Contact sales,
  Status, a spend-to-unlock card and a Get started checklist.
- Dashboard: greeting, "Create API key", a four-step onboarding checklist,
  promo banner, "Explore models & workflows" cards with per-second price.
- Model cards: provider / name, description, discounted price ("from $0.175/s,
  was $0.206").

### Observed API prices (owner's account, 2026-10-14, 15% intro discount applied)

| Model | Price |
|---|---|
| bytedance / Seedance 2.5 | from $0.175/s (list $0.206/s) |
| higgsfield / Genjutsu | from $0.270/s (list $0.318/s) |
| kling / Kling 3.0 | $0.071/s (list $0.084/s) |
| minimax / MiniMax H3 | $0.111/s (list $0.130/s) |

Use list prices, not the promo ones, as `hfUsdCost` when credit pricing is
built (Phase 5). Promo prices expire.

Paths seen in console links: `higgsfield/genjutsu/motion-transfer/v1.0`
(Genjutsu, not installed yet) and `kling-video/v3.0/std/text-to-video`.

## Automated inventory (JEV)

`tools/jev` (developer-only) rewrites the index below after each inventory run.
Run it locally: see `tools/jev/README.md`.

<!-- jev:inventory:start -->
No JEV inventory runs yet.
<!-- jev:inventory:end -->
