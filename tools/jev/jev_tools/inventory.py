"""Walks higgsfield.ai pages from goals/inventory.json and writes notes to
studio/docs/inventory/<slug>.md, plus an index inside studio/docs/ui-inventory.md."""

import argparse
import json
from datetime import datetime, timezone
from pathlib import Path

from .goals import GOALS_DIR, load_inventory
from .notes import render_index, render_run, replace_block

DOCS = Path(__file__).resolve().parents[3] / "studio" / "docs"


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--goals", type=Path, default=GOALS_DIR / "inventory.json")
    parser.add_argument("--only", nargs="*", help="slugs to run (default: all)")
    parser.add_argument("--docs", type=Path, default=DOCS)
    args = parser.parse_args()

    from .runner import run_guarded

    guard, pages = load_inventory(args.goals)
    if args.only:
        pages = [p for p in pages if p["slug"] in set(args.only)]
    out = args.docs / "inventory"
    out.mkdir(parents=True, exist_ok=True)
    index_path = out / "index.json"
    index = json.loads(index_path.read_text()) if index_path.exists() else {}

    for page in pages:
        print(f"→ {page['slug']}: {page['url']}")
        run = run_guarded(page["url"], page["goal"], guard)
        captured = datetime.now(timezone.utc)
        (out / f"{page['slug']}.md").write_text(render_run(page["slug"], page["url"], run, captured))
        index[page["slug"]] = {
            "slug": page["slug"],
            "url": page["url"],
            "outcome": run["outcome"],
            "captured": captured.strftime("%Y-%m-%d"),
        }
        print(f"  {run['outcome']}")

    index_path.write_text(json.dumps(index, indent=2, sort_keys=True) + "\n")
    inventory_md = args.docs / "ui-inventory.md"
    inventory_md.write_text(replace_block(inventory_md.read_text(), render_index(list(index.values()))))
    print(f"Wrote {len(pages)} page notes to {out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
