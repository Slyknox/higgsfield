# tools/jev: developer-only browser runs

Two jobs for [Jev Ultrafast](https://github.com/Slyknox/jev-ultrafast) (TypeSafe's
Jev picks each browser action from a table of the page's controls):

1. **Inventory:** walk higgsfield.ai pages and write structured notes to
   `studio/docs/inventory/<slug>.md`, plus an index inside
   `studio/docs/ui-inventory.md`.
2. **Smoke:** drive our own studio (Explore, the Image/Video menus, `?model=`
   links) against a running server and check where each run ends up.

This folder is **never imported by the studio app** and never runs in production.
The JEV authors call it a demo library, and a browser agent reading untrusted
pages can be steered by them (prompt injection).

## Safety rails (enforced in code, not by the model)

- **Hosts:** a run may only visit its goal file's hosts
  (`higgsfield.ai` / your local studio). Leaving them stops the run.
- **Actions:** before every action, `jev_tools/guard.py` refuses anything that
  spends money, changes an account or sends data: Generate, Sign in/up, Upgrade,
  Buy, Subscribe, Accept all, Create API key, Delete and so on. The run stops
  instead of clicking.
- **No typing:** text entry is off, so no text-model key is needed and nothing
  you type can leak. A goal file can opt in with `"allow_typing": true`.
- **Step budget:** `max_steps` per goal file (12 inventory, 10 smoke).
- **Independent checks:** a smoke case passes only when code-level checks on the
  final page pass (path, query, text), whatever the model answered.
- **Escaped notes:** page text is escaped and fenced before it is written into
  the docs.
- **Pinned dependency:** `pyproject.toml` pins the fork to commit `1231850`.
  Read the diff before bumping it.

## Setup (your machine)

Needs Python 3.12+, [uv](https://docs.astral.sh/uv/) and Google Chrome.

```bash
cd tools/jev
uv sync
cp .env.example .env          # add TYPESAFE_API_KEY
uv run browser-harness --doctor   # connect Chrome; allow remote debugging when asked
```

JEV drives **your real Chrome profile**: you are signed in to whatever you are
signed in to. Use a separate Chrome profile with no Higgsfield or payment
sessions for inventory runs.

## Run

```bash
# Inventory: all pages, or a few
uv run --env-file .env jev-inventory
uv run --env-file .env jev-inventory --only video-menu pricing

# Smoke: start the studio first (cd studio && pnpm dev), then
uv run --env-file .env jev-smoke
uv run --env-file .env jev-smoke --base-url http://localhost:3123 --only video-menu-model
```

Smoke exits 1 if any case fails and writes `artifacts/smoke/<time>/report.json`.

## Add a goal

- Inventory: add `{ "slug", "url", "goal" }` to `goals/inventory.json`. Write
  goals that only look: scroll, open a menu, switch a tab, and say what not to
  click.
- Smoke: add `{ "slug", "path", "goal", "checks" }` to `goals/smoke.json`. Checks:
  `path`, `query` (`{"model": "flux-2"}`), `text_includes`, `text_excludes`.

## Tests

The guard, checks, notes and goal loading are pure and tested without Chrome or
keys:

```bash
uv run pytest                                                  # after uv sync
PYTHONPATH=. uv run --no-project --with "pytest>=8.4,<9" pytest   # without installing JEV
```
