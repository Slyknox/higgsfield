"""Limits every JEV run: which hosts it may visit and which actions it may take.

JEV reads untrusted pages, so a page can try to steer it (prompt injection).
The guard is checked in code before each action executes; the model cannot
talk its way past it.
"""

import re
from dataclasses import dataclass, field
from urllib.parse import urlparse

# Actions that could spend money, change an account, or send data. A run that
# picks one stops instead of executing it.
DEFAULT_FORBIDDEN = re.compile(
    r"\b("
    r"generate|create video|create image|submit|send|publish|delete|remove|"
    r"sign ?in|sign ?up|log ?in|log ?out|register|"
    r"buy|purchase|pay|checkout|subscribe|upgrade|top ?up|add funds|add card|"
    r"accept all|allow all|"
    r"create api key|connect api key|download|install|share"
    r")\b",
    re.IGNORECASE,
)


class GuardViolation(Exception):
    """The run tried to leave its allowed hosts or take a forbidden action."""


def host_of(url: str) -> str:
    return (urlparse(url).hostname or "").lower()


@dataclass(frozen=True)
class Guard:
    allowed_hosts: frozenset[str]
    max_steps: int = 12
    allow_typing: bool = False
    forbidden: re.Pattern[str] = field(default=DEFAULT_FORBIDDEN)

    def check_url(self, url: str) -> None:
        parsed = urlparse(url)
        if parsed.scheme not in {"http", "https"}:
            raise GuardViolation(f"scheme {parsed.scheme or '(none)'} is not allowed")
        if host_of(url) not in self.allowed_hosts:
            raise GuardViolation(f"host {host_of(url) or '(none)'} is outside the allowed hosts")

    def veto(self, action: dict) -> str | None:
        """Reason to refuse an action, or None when it may run."""
        kind = str(action.get("kind", ""))
        label = str(action.get("label", ""))
        if kind == "fill" and not self.allow_typing:
            return f"typing is disabled (field '{label}')"
        if self.forbidden.search(label):
            return f"refused '{label}'"
        return None
