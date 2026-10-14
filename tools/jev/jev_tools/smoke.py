"""Smoke-tests the studio against a running server with goals/smoke.json.
Each case passes only when independent checks on the final page pass."""

import argparse
import json
from datetime import datetime, timezone
from pathlib import Path

from .checks import evaluate
from .goals import GOALS_DIR, load_smoke

ARTIFACTS = Path(__file__).resolve().parents[1] / "artifacts" / "smoke"


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--goals", type=Path, default=GOALS_DIR / "smoke.json")
    parser.add_argument("--base-url", help="override base_url, e.g. http://localhost:3000")
    parser.add_argument("--only", nargs="*", help="slugs to run (default: all)")
    args = parser.parse_args()

    from .runner import run_guarded

    guard, base, cases = load_smoke(args.goals, args.base_url)
    if args.only:
        cases = [c for c in cases if c["slug"] in set(args.only)]
    results = []
    for case in cases:
        url = base + case["path"]
        print(f"→ {case['slug']}: {url}")
        run = run_guarded(url, case["goal"], guard)
        verdict = evaluate(run["final_page"], case["checks"])
        results.append({"slug": case["slug"], "url": url, **verdict, "outcome": run["outcome"], "steps": run["steps"],
                        "final_url": run["final_page"].get("url")})
        print(f"  {'PASS' if verdict['passed'] else 'FAIL'} ({run['outcome']})")
        for name, ok in verdict["checks"].items():
            if not ok:
                print(f"    ✗ {name}")

    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    folder = ARTIFACTS / stamp
    folder.mkdir(parents=True, exist_ok=True)
    (folder / "report.json").write_text(json.dumps(results, indent=2) + "\n")
    failed = [r["slug"] for r in results if not r["passed"]]
    print(f"{len(results) - len(failed)}/{len(results)} passed · report: {folder / 'report.json'}")
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
