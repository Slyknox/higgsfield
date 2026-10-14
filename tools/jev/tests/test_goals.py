import json

import pytest

from jev_tools.goals import GoalError, load_inventory, load_smoke


def test_shipped_goal_files_are_valid():
    guard, pages = load_inventory()
    assert guard.allowed_hosts == {"higgsfield.ai", "www.higgsfield.ai"}
    assert not guard.allow_typing and pages
    guard, base, cases = load_smoke()
    assert base == "http://localhost:3000" and guard.allowed_hosts == {"localhost"} and cases


def test_base_url_override_moves_the_allowed_host():
    guard, base, _ = load_smoke(base_url="http://127.0.0.1:3123/")
    assert base == "http://127.0.0.1:3123" and guard.allowed_hosts == {"127.0.0.1"}


def test_rejects_pages_outside_allowed_hosts(tmp_path):
    path = tmp_path / "inv.json"
    path.write_text(json.dumps({"allowed_hosts": ["higgsfield.ai"],
                                "pages": [{"slug": "x", "url": "https://other.example/", "goal": "look"}]}))
    with pytest.raises(GoalError):
        load_inventory(path)


def test_rejects_unknown_checks(tmp_path):
    path = tmp_path / "smoke.json"
    path.write_text(json.dumps({"base_url": "http://localhost:3000",
                                "cases": [{"slug": "x", "path": "/", "goal": "g", "checks": {"eval": "1"}}]}))
    with pytest.raises(GoalError):
        load_smoke(path)
