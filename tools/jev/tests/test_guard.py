import pytest

from jev_tools.guard import Guard, GuardViolation

GUARD = Guard(allowed_hosts=frozenset({"higgsfield.ai"}))


def test_allows_listed_host_and_rejects_others():
    GUARD.check_url("https://higgsfield.ai/ai/video?model=seedance_2_5")
    blocked = [
        "https://evil.example/",
        "https://higgsfield.ai.evil.example/",
        "file:///etc/passwd",
        "javascript:alert(1)",
    ]
    for url in blocked:
        with pytest.raises(GuardViolation):
            GUARD.check_url(url)


@pytest.mark.parametrize(
    "label",
    ["Generate", "Sign up", "Log in", "Upgrade", "Buy credits", "Accept all", "Create API key", "Delete", "Add funds"],
)
def test_vetoes_actions_that_spend_or_change_accounts(label):
    assert GUARD.veto({"kind": "click", "label": label})


@pytest.mark.parametrize("label", ["Video", "Kling 3.0 Pro", "Edit Video", "Reject all", "Annual", "Assets"])
def test_allows_navigation(label):
    assert GUARD.veto({"kind": "click", "label": label}) is None


def test_typing_is_off_unless_opted_in():
    field = {"kind": "fill", "label": "Prompt"}
    assert "typing is disabled" in GUARD.veto(field)
    assert Guard(allowed_hosts=frozenset({"x"}), allow_typing=True).veto(field) is None
