# design.ai studio

An AI image and video studio on the Higgsfield API: magic-link sign-in,
every Higgsfield model in one generator, and a personal library. It looks and
works like higgsfield.ai under our own brand. Credits and Stripe billing come
next (see `docs/roadmap.md`).

Started from Higgsfield's [Studio template](https://github.com/higgsfield-ai/app-templates)
(commit `1e15e224`); its UI contracts still apply (`AGENTS.md`,
`layouts/AGENTS.md`, `components/studio/AGENTS.md`).

## How it works

```
Browser ── server actions (submit, cancel, delete) ──┐
   │                                                  ▼
   └── polls /api/generations/status ──► Next.js server ──► Higgsfield API
                                             │    ▲             │
                                  Postgres ◄─┘    └── webhook ──┘
                               (Supabase)        + cron reconcile
                                             │
                                             └──► R2: outputs copied on completion
```

- **One platform key** (`HF_API_KEY`) on the server. The browser never sees it.
- **Every generation is a Postgres row owned by its user.** Queries always
  filter by `user_id`, so another user's ids simply aren't found.
- **Results arrive three ways**, all idempotent: Higgsfield's webhook, a
  per-minute cron, and the status route refreshing the caller's own stale rows.
  That last one keeps local development working without a public URL.
- **Outputs are copied to our storage** (R2, or local disk in development),
  because Higgsfield keeps them only about seven days.

## Run it

See `docs/setup.md` for accounts and environment variables.

```bash
pnpm install
cp .env.example .env.local     # set AUTH_SECRET and HF_API_KEY
pnpm db:migrate
pnpm dev
```

| Command | What it does |
|---|---|
| `pnpm dev` | Dev server on :3000 |
| `pnpm typecheck` / `pnpm lint` | Strict TypeScript / ESLint |
| `pnpm test` | Unit tests; with `TEST_DATABASE_URL`, also Postgres tests |
| `pnpm test:e2e` | Playwright against a production build, a throwaway database and a fake Higgsfield |
| `pnpm db:migrate` | Applies `db/migrations/*.sql` |
| `pnpm models` | Regenerates the model barrel after adding a model file |

## Layout

```
app/                 Pages, server actions and API routes
  api/generations/   List and status (the browser polls these)
  api/webhooks/      Higgsfield callbacks (HMAC token in the URL)
  api/cron/          Reconciler for runs whose webhook never came
auth.ts              Auth.js v5: magic links, database sessions
db/migrations/       SQL schema (RLS on, no policies)
generation/          Higgsfield client and the model catalog
lib/generations/     Generation service, storage drivers, webhook tokens
lib/server/          Server-only wiring: env, db pool, session, deps
layouts/generator.tsx  The /image and /video generator
e2e/                 Playwright tests and the fake Higgsfield
docs/                roadmap, decisions, setup, UI inventory
```

## Add a model

Drop a file in `generation/catalog/models/` (see any neighbour) with the
source URL of its API docs, add its description to `lib/site/model-meta.ts`,
run `pnpm models`, and add a request-shape test like
`tests/seedance-2.5.test.mjs`.
