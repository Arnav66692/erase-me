"""Printing: stable JSON for agents, plain text for people."""
from __future__ import annotations

import json
import sys
from typing import Any, Dict, List


def emit_json(payload: Dict[str, Any]) -> None:
    sys.stdout.write(json.dumps(payload, indent=2, ensure_ascii=False) + "\n")


def emit_success(command: str, data: Dict[str, Any], human: str, as_json: bool) -> None:
    if as_json:
        emit_json({"ok": True, "command": command, "data": data})
        return
    sys.stdout.write(human.rstrip("\n") + "\n")


def emit_error(command: str, message: str, exit_code: int, as_json: bool) -> None:
    if as_json:
        emit_json({"ok": False, "command": command, "error": message, "exit_code": exit_code})
    sys.stderr.write(f"Error: {message}\n")


def bullet_list(values: List[str], indent: str = "    ") -> List[str]:
    return [f"{indent}- {v}" for v in values]


def format_item(index: int, view: Dict[str, Any]) -> List[str]:
    lines = [f"{index}. {view['name']} [{view['item_id']}] ({view['category']}) status: {view['status']}"]
    for url in view["search_urls"]:
        lines.append(f"    search: {url}")
    if view["search_missing"]:
        lines.append(f"    search needs: {', '.join(view['search_missing'])}")
    elif not view["search_urls"] and view["search_notes"]:
        lines.append(f"    search: {view['search_notes']}")
    target = view["optout_url"] or view["optout_email"] or "see steps"
    lines.append(f"    opt-out ({view['method']}): {target}")
    if view["requires"]:
        lines.append(f"    needs: {', '.join(view['requires'])}")
    lines.extend(bullet_list(view["steps"]))
    if not view["verified"]:
        lines.append("    note: this entry is not verified yet")
    return lines


def format_items(views: List[Dict[str, Any]]) -> str:
    lines: List[str] = []
    for index, view in enumerate(views, start=1):
        lines.extend(format_item(index, view))
    return "\n".join(lines)


def format_law(law: Dict[str, Any]) -> List[str]:
    deadline = law.get("deadline") or {}
    regulator = law.get("regulator") or {}
    lines = [
        f"{law['name']} [{law['code']}] status: {law['status']}, verified: {'yes' if law['verified'] else 'no'}",
        f"    deadline: {deadline.get('days')} {deadline.get('day_type')} days ({deadline.get('citation', '')})",
    ]
    if regulator:
        lines.append(f"    regulator: {regulator.get('name')} {regulator.get('complaint_url', '')}".rstrip())
    for right in law.get("rights") or []:
        lines.append(f"    right: {right.get('right')} ({right.get('citation')}). {right.get('summary')}")
    lines.extend(f"    warning: {w}" for w in law.get("warnings") or [])
    return lines
