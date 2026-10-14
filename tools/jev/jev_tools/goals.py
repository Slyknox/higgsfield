"""Loads and validates the goal files in tools/jev/goals/."""

import json
import re
from pathlib import Path

from .guard import Guard, host_of

GOALS_DIR = Path(__file__).resolve().parents[1] / "goals"
SLUG = re.compile(r"^[a-z0-9][a-z0-9-]{0,63}$")
CHECK_KEYS = {"path", "query", "text_includes", "text_excludes"}


class GoalError(ValueError):
    pass


def _require(cond: bool, message: str) -> None:
    if not cond:
        raise GoalError(message)


def _guard(data: dict, hosts: set[str]) -> Guard:
    max_steps = data.get("max_steps", 12)
    _require(isinstance(max_steps, int) and 1 <= max_steps <= 40, "max_steps must be 1–40")
    return Guard(
        allowed_hosts=frozenset(h.lower() for h in hosts),
        max_steps=max_steps,
        allow_typing=bool(data.get("allow_typing", False)),
    )


def load_inventory(path: Path = GOALS_DIR / "inventory.json") -> tuple[Guard, list[dict]]:
    data = json.loads(path.read_text())
    hosts = set(data.get("allowed_hosts") or [])
    _require(bool(hosts), "inventory needs allowed_hosts")
    pages = data.get("pages") or []
    _require(bool(pages), "inventory needs at least one page")
    slugs = set()
    for page in pages:
        _require(bool(SLUG.match(page.get("slug", ""))), f"bad slug {page.get('slug')!r}")
        _require(page["slug"] not in slugs, f"duplicate slug {page['slug']}")
        slugs.add(page["slug"])
        _require(host_of(page.get("url", "")) in hosts, f"{page['slug']}: url host not in allowed_hosts")
        _require(bool(page.get("goal", "").strip()), f"{page['slug']}: empty goal")
    return _guard(data, hosts), pages


def load_smoke(path: Path = GOALS_DIR / "smoke.json", base_url: str | None = None) -> tuple[Guard, str, list[dict]]:
    data = json.loads(path.read_text())
    base = (base_url or data.get("base_url") or "").rstrip("/")
    _require(bool(host_of(base)), "smoke needs a base_url")
    cases = data.get("cases") or []
    _require(bool(cases), "smoke needs at least one case")
    slugs = set()
    for case in cases:
        _require(bool(SLUG.match(case.get("slug", ""))), f"bad slug {case.get('slug')!r}")
        _require(case["slug"] not in slugs, f"duplicate slug {case['slug']}")
        slugs.add(case["slug"])
        _require(str(case.get("path", "")).startswith("/"), f"{case['slug']}: path must start with /")
        _require(bool(case.get("goal", "").strip()), f"{case['slug']}: empty goal")
        checks = case.get("checks") or {}
        _require(bool(checks), f"{case['slug']}: needs checks")
        unknown = set(checks) - CHECK_KEYS
        _require(not unknown, f"{case['slug']}: unknown checks {sorted(unknown)}")
    return _guard(data, {host_of(base)}), base, cases
