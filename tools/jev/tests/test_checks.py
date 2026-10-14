from jev_tools.checks import evaluate

PAGE = {
    "url": "http://localhost:3000/video?model=kling-3-pro",
    "text": "Make videos in one click",
    "actions": [{"label": "Model", "value": "Kling 3.0 Pro"}, {"label": "Generate"}],
}


def test_passes_when_path_query_and_text_match():
    result = evaluate(PAGE, {"path": "/video", "query": {"model": "kling-3-pro"}, "text_includes": ["kling 3.0 pro"]})
    assert result["passed"], result


def test_fails_on_wrong_query_or_missing_text():
    assert not evaluate(PAGE, {"query": {"model": "seedance-2.5"}})["passed"]
    assert not evaluate(PAGE, {"text_includes": ["Every model, one studio"]})["passed"]
    assert not evaluate(PAGE, {"text_excludes": ["Generate"]})["passed"]


def test_no_checks_never_passes():
    assert not evaluate(PAGE, {})["passed"]


def test_root_path_and_trailing_slash():
    assert evaluate({"url": "http://localhost:3000/"}, {"path": "/"})["passed"]
    assert evaluate({"url": "http://localhost:3000/assets/"}, {"path": "/assets"})["passed"]
