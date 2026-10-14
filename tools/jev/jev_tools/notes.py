"""Turns a recorded run into Markdown notes. Page content is untrusted input:
it is escaped, truncated and fenced so it can't break or inject into the docs."""

import re
from datetime import datetime, timezone

START = "<!-- jev:inventory:start -->"
END = "<!-- jev:inventory:end -->"

_CONTROL = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]")
MAX_CELL = 120
MAX_ROWS = 150
MAX_TEXT = 4000


def cell(value: object, limit: int = MAX_CELL) -> str:
    text = _CONTROL.sub("", str(value if value is not None else ""))
    text = " ".join(text.split())
    text = text.replace("\\", "\\\\").replace("|", "\\|").replace("`", "'")
    text = text.replace("<", "&lt;").replace(">", "&gt;")
    return text if len(text) <= limit else text[: limit - 1] + "…"


def fenced(text: str, limit: int = MAX_TEXT) -> str:
    body = _CONTROL.sub("", text or "").replace("~~~", "~ ~ ~")
    if len(body) > limit:
        body = body[:limit] + "\n… (truncated)"
    return f"~~~text\n{body}\n~~~"


def render_run(slug: str, url: str, run: dict, captured_at: datetime | None = None) -> str:
    captured = (captured_at or datetime.now(timezone.utc)).strftime("%Y-%m-%d %H:%M UTC")
    lines = [
        f"# {cell(slug)}",
        "",
        f"Source: `{cell(url)}` · captured {captured} by `tools/jev`.",
        "",
        "> Reference only. This is Higgsfield's layout and copy: copy the structure,",
        "> never ship their wording, names or media.",
        "",
        f"Outcome: **{cell(run.get('outcome'))}** · {len(run.get('steps', []))} steps "
        f"· {run.get('elapsed_ms', 0)} ms",
        "",
        "## Steps",
        "",
        "| # | Action | Kind | URL after |",
        "|---|---|---|---|",
    ]
    for step in run.get("steps", []):
        lines.append(
            f"| {step.get('step', '')} | {cell(step.get('action'))} | {cell(step.get('kind'))} "
            f"| {cell(step.get('url'))} |"
        )
    for index, page in enumerate(run.get("pages", []), start=1):
        actions = page.get("actions") or []
        lines += [
            "",
            f"## Page {index}: {cell(page.get('url'))}",
            "",
            f"{len(actions)} controls observed.",
            "",
            "| Kind | Label | Value |",
            "|---|---|---|",
        ]
        seen: set[tuple[str, str]] = set()
        for action in actions:
            key = (str(action.get("kind")), str(action.get("label")))
            if key in seen:
                continue
            seen.add(key)
            if len(seen) > MAX_ROWS:
                lines.append(f"| … | {len(actions) - MAX_ROWS} more | |")
                break
            lines.append(f"| {cell(action.get('kind'))} | {cell(action.get('label'))} | {cell(action.get('value'))} |")
        lines += ["", "Visible text:", "", fenced(str(page.get("text") or ""))]
    return "\n".join(lines) + "\n"


def render_index(entries: list[dict]) -> str:
    rows = [
        "| Page | Source | Outcome | Captured |",
        "|---|---|---|---|",
    ]
    for e in sorted(entries, key=lambda e: e["slug"]):
        rows.append(
            f"| [{cell(e['slug'])}](inventory/{e['slug']}.md) | `{cell(e['url'])}` "
            f"| {cell(e['outcome'])} | {cell(e['captured'])} |"
        )
    return "\n".join(rows)


def replace_block(document: str, block: str) -> str:
    """Puts `block` between the jev markers, appending the markers if absent."""
    section = f"{START}\n{block}\n{END}"
    if START in document and END in document:
        head, rest = document.split(START, 1)
        _, tail = rest.split(END, 1)
        return f"{head}{section}{tail}"
    return document.rstrip("\n") + "\n\n## Automated inventory (JEV)\n\n" + section + "\n"
