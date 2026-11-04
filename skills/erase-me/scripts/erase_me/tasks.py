"""The human digest: everything that needs a person, grouped by what it needs."""
from __future__ import annotations

from typing import Any, Dict, List

from . import catalog

GROUPS = (
    ("needs_human", "Waiting on you"),
    ("captcha", "CAPTCHAs to solve"),
    ("email_verification", "Email links to click"),
    ("id_upload", "ID documents requested"),
    ("phone_call", "Phone calls or phone confirmations"),
    ("account", "Accounts you need to sign in to"),
    ("app_install", "Apps you need to install"),
)
ACTIONABLE = frozenset({"found", "relisted", "needs_human", "blocked"})
SPECIAL_SOURCE = "jurisdiction"
BLOCKED_REASON = "The search was blocked, probably by a CAPTCHA. Open it yourself."


def _actionable(item: Dict[str, Any]) -> bool:
    status = item.get("status")
    return status in ACTIONABLE or (status == "planned" and item.get("source") == SPECIAL_SOURCE)


def _upcoming(item: Dict[str, Any]) -> bool:
    """Planned sites not checked yet. Their opt-out steps will need a person later."""
    return item.get("status") == "planned" and item.get("source") != SPECIAL_SOURCE


def _last_note(item: Dict[str, Any]) -> str:
    notes = [h.get("note") for h in item.get("history", []) if h.get("note")]
    return notes[-1] if notes else ""


def _requirements(item: Dict[str, Any], info: Dict[str, Any]) -> List[str]:
    needs = set(info.get("requires") or [])
    if item.get("status") == "needs_human":
        needs.add("needs_human")
    if item.get("status") == "blocked":
        needs.add("captcha")
    return [name for name, _ in GROUPS if name in needs]


def _entry(item: Dict[str, Any], info: Dict[str, Any], requirement: str) -> Dict[str, Any]:
    reason = BLOCKED_REASON if requirement == "captcha" and item.get("status") == "blocked" else ""
    return {
        "item_id": item["item_id"],
        "name": info.get("name"),
        "status": item.get("status"),
        "optout_url": info.get("optout_url"),
        "steps": info.get("steps") or [],
        "last_note_untrusted": _last_note(item),
        "reason": reason,
    }


def _grouped(items: List[Dict[str, Any]], cat: Dict[str, Any]):
    buckets: Dict[str, List[Dict[str, Any]]] = {name: [] for name, _ in GROUPS}
    touched = set()
    for item in items:
        info = catalog.describe(cat, item)
        for requirement in _requirements(item, info):
            buckets[requirement].append(_entry(item, info, requirement))
            touched.add(item["item_id"])
    groups = [{"requirement": name, "label": label, "items": buckets[name]} for name, label in GROUPS if buckets[name]]
    return groups, len(touched)


def digest(ledger: Dict[str, Any], cat: Dict[str, Any]) -> Dict[str, Any]:
    """Steps that need a person now, plus 'upcoming' steps for planned sites not checked yet."""
    items = ledger.get("items", [])
    groups, total = _grouped([i for i in items if _actionable(i)], cat)
    upcoming, upcoming_total = _grouped([i for i in items if _upcoming(i)], cat)
    return {"groups": groups, "upcoming": upcoming, "total_items": total, "upcoming_items": upcoming_total}
