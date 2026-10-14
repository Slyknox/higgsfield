from datetime import datetime, timezone

from jev_tools.notes import END, START, cell, fenced, render_index, render_run, replace_block


def test_cell_escapes_markdown_and_html():
    assert cell("a|b\nc `x` <script>") == "a\\|b c 'x' &lt;script&gt;"
    assert len(cell("x" * 500)) == 120


def test_fenced_text_cannot_close_the_fence():
    body = fenced("before\n~~~\n# injected heading")
    assert body.count("~~~") == 2


def test_render_run_lists_steps_and_dedupes_controls():
    run = {
        "outcome": "done",
        "elapsed_ms": 1200,
        "steps": [{"step": 1, "action": "Video", "kind": "click", "url": "https://higgsfield.ai/"}],
        "pages": [{"url": "https://higgsfield.ai/", "text": "Hello", "actions": [
            {"kind": "click", "label": "Video"}, {"kind": "click", "label": "Video"}]}],
    }
    md = render_run("video-menu", "https://higgsfield.ai/", run, datetime(2026, 10, 14, tzinfo=timezone.utc))
    assert "| 1 | Video | click |" in md
    assert md.count("| click | Video |") == 1
    assert "never ship" in md


def test_replace_block_is_idempotent_and_keeps_surrounding_text():
    doc = "# Inventory\n\nmanual notes\n"
    once = replace_block(doc, render_index([{"slug": "a", "url": "u", "outcome": "done", "captured": "d"}]))
    twice = replace_block(once, render_index([{"slug": "b", "url": "u", "outcome": "done", "captured": "d"}]))
    assert "manual notes" in twice and twice.count(START) == 1 and twice.count(END) == 1
    assert "inventory/b.md" in twice and "inventory/a.md" not in twice
