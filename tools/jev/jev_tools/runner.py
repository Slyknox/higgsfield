"""The guarded JEV loop. Predict and act are separate so the guard can veto an
action before it executes. Imports jev_ultrafast lazily: only the CLIs need it."""

import time

from .guard import Guard, GuardViolation, host_of

KEEP = ("url", "actions", "text")


def _page(page: dict) -> dict:
    return {key: page.get(key) for key in KEEP}


def run_guarded(url: str, goal: str, guard: Guard, log=print) -> dict:
    """Runs one goal and returns {"outcome", "steps", "pages", "final_page", "elapsed_ms"}."""
    from jev_ultrafast import Agent
    from jev_ultrafast.browser import StalePage

    guard.check_url(url)
    started = time.perf_counter()
    agent = Agent(url, goal)
    pages = [_page(agent.state["page"])]
    outcome = "running"
    try:
        while agent.state["status"] not in {"done", "blocked"}:
            if len(agent.state["history"]) >= guard.max_steps:
                outcome = f"stopped: {guard.max_steps}-step budget"
                break
            try:
                agent.command("predict")
                page = agent.state["page"]
                choice = agent.state["decision"]["choice"]
                if choice not in {"DONE", "BLOCKED"}:
                    action = next(a for a in page["actions"] if a["id"] == choice)
                    reason = guard.veto(action)
                    if reason:
                        outcome = f"guard: {reason}"
                        break
                agent.command("act", {"fingerprint": page["fingerprint"]})
            except StalePage:
                agent.state["decision"] = None
                agent.state["status"] = "ready"
                agent.state["page"] = agent.browser.observe(screenshot=False)
                continue
            except ValueError as error:
                outcome = f"stopped: {error}"
                break
            current = agent.state["page"]
            if host_of(current.get("url", "")) not in guard.allowed_hosts:
                outcome = f"guard: navigated off-host to {host_of(current.get('url', ''))}"
                break
            if not pages or current.get("url") != pages[-1]["url"] or agent.state["status"] in {"done", "blocked"}:
                pages.append(_page(current))
            last = agent.state["history"][-1] if agent.state["history"] else {}
            log(f"  {agent.state['elapsed_ms']:>6} ms  {agent.state['status']:<9} {last.get('action', '')}")
        if outcome == "running":
            outcome = agent.state["status"]
        final = _page(agent.state["page"])
        if pages[-1] != final:
            pages.append(final)
        steps = [
            {k: h.get(k) for k in ("step", "action", "kind", "url", "probability")}
            for h in agent.state["history"]
        ]
    except GuardViolation as violation:
        outcome, steps, final = f"guard: {violation}", [], pages[-1]
    finally:
        agent.close()
    return {
        "outcome": outcome,
        "steps": steps,
        "pages": pages,
        "final_page": final,
        "elapsed_ms": round((time.perf_counter() - started) * 1000),
    }
