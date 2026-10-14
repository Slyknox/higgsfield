"""Independent smoke checks on the page a run ended on.

A run passes only when these checks pass, whatever the model answered.
"""

from urllib.parse import parse_qs, urlparse


def page_haystack(page: dict) -> str:
    """Visible text plus every control's label and value, case-folded."""
    parts = [str(page.get("text") or "")]
    for action in page.get("actions") or []:
        parts.append(str(action.get("label") or ""))
        if action.get("value") is not None:
            parts.append(str(action["value"]))
    return "\n".join(parts).casefold()


def evaluate(page: dict, checks: dict) -> dict:
    """Returns {"passed": bool, "checks": {name: bool}} for the declared checks."""
    url = urlparse(str(page.get("url") or ""))
    results: dict[str, bool] = {}
    if "path" in checks:
        results["path"] = (url.path.rstrip("/") or "/") == (checks["path"].rstrip("/") or "/")
    if "query" in checks:
        query = parse_qs(url.query)
        for key, value in checks["query"].items():
            results[f"query.{key}"] = query.get(key, [None])[0] == value
    if "text_includes" in checks:
        haystack = page_haystack(page)
        for needle in checks["text_includes"]:
            results[f"text:{needle}"] = needle.casefold() in haystack
    if "text_excludes" in checks:
        haystack = page_haystack(page)
        for needle in checks["text_excludes"]:
            results[f"no-text:{needle}"] = needle.casefold() not in haystack
    return {"passed": bool(results) and all(results.values()), "checks": results}
