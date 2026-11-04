"""The per-person ledger: one item per site or channel, with a status machine."""
from __future__ import annotations

import copy
import datetime as dt
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional
from urllib.parse import urlparse

from . import paths, storage
from .errors import RefusalError, UsageError
from .ids import validate_item_id, validate_person_id

STATUSES = (
    "planned", "found", "not_found", "blocked", "needs_human",
    "requested", "removed", "relisted", "rejected", "skipped",
)

TRANSITIONS = {
    "planned": ("found", "not_found", "blocked", "needs_human", "requested", "skipped"),
    "found": ("requested", "needs_human", "blocked", "removed", "skipped", "not_found"),
    "not_found": ("found", "skipped", "planned"),
    "blocked": ("found", "not_found", "needs_human", "skipped", "planned"),
    "needs_human": ("found", "not_found", "requested", "blocked", "skipped", "removed"),
    "requested": ("requested", "removed", "rejected", "needs_human", "found"),
    "removed": ("relisted",),
    "relisted": ("requested", "needs_human", "removed"),
    "rejected": ("requested", "needs_human", "removed"),
    "skipped": ("planned",),
}

MAX_NOTE = 200
MAX_URL = 2000
URL_SCHEMES = ("http", "https")
WHITESPACE_CONTROL_CHARS = ("\n", "\r", "\t")
REPEATABLE = frozenset({"requested"})


def _check_status(status: object) -> str:
    if status not in STATUSES:
        raise UsageError(f"Unknown status '{status}'. Use one of: {', '.join(STATUSES)}.")
    return str(status)


def clean_note(note: Optional[str]) -> str:
    """Notes are inert, untrusted text: one line, no control characters, at most MAX_NOTE characters."""
    if not note:
        return ""
    kept = "".join(
        ch for ch in str(note) if ch in WHITESPACE_CONTROL_CHARS or (ord(ch) >= 32 and ord(ch) != 127)
    )
    return " ".join(kept.split())[:MAX_NOTE]


def check_evidence_url(url: str) -> str:
    candidate = (url or "").strip()
    parsed = urlparse(candidate)
    if (
        parsed.scheme not in URL_SCHEMES
        or not parsed.netloc
        or any(ch.isspace() for ch in candidate)
        or len(candidate) > MAX_URL
    ):
        raise UsageError(f"Evidence must be an http or https URL, not '{url}'.")
    return candidate


def history_entry(status: str, note: str, now: str) -> Dict[str, str]:
    return {"at": now, "status": status, "note": clean_note(note)}


def new_item(
    item_id: str,
    site_id: str,
    source: str,
    channel: str,
    regime: Optional[str],
    status: str = "planned",
    note: str = "",
    now: str = "",
) -> Dict[str, Any]:
    validate_item_id(item_id)
    _check_status(status)
    return {
        "item_id": item_id,
        "site_id": site_id,
        "source": source,
        "channel": channel,
        "regime": regime,
        "status": status,
        "evidence_urls": [],
        "requested_on": None,
        "first_requested_on": None,
        "due_on": None,
        "removed_on": None,
        "history": [history_entry(status, note, now)],
    }


CUSTOM_SOURCE = "custom"
CUSTOM_CHANNEL = "legal_request"


def new_custom_item(
    item_id: str, site: Dict[str, Any], regime: Optional[str], evidence: Iterable[str], now: str
) -> Dict[str, Any]:
    """A site found by search that has no reference file. Its details live under 'site'."""
    urls = list(dict.fromkeys(check_evidence_url(u) for u in evidence))
    status = "found" if urls else "planned"
    item = new_item(item_id, item_id, CUSTOM_SOURCE, CUSTOM_CHANNEL, regime, status=status, now=now)
    item["evidence_urls"] = urls
    item["site"] = dict(site)
    return item


def add_item(ledger: Dict[str, Any], item: Dict[str, Any]) -> Dict[str, Any]:
    if any(i.get("item_id") == item["item_id"] for i in ledger.get("items", [])):
        raise UsageError(f"'{item['item_id']}' is already in this plan. Pick another item id.")
    updated = copy.deepcopy(ledger)
    updated.setdefault("items", []).append(copy.deepcopy(item))
    return updated


def new_ledger(person_id: str, items: Iterable[Dict[str, Any]]) -> Dict[str, Any]:
    return {"person_id": validate_person_id(person_id), "items": [copy.deepcopy(i) for i in items]}


def find_item(ledger: Dict[str, Any], item_id: str) -> Dict[str, Any]:
    validate_item_id(item_id)
    for item in ledger.get("items", []):
        if item.get("item_id") == item_id:
            return item
    raise UsageError(f"No item '{item_id}' in this plan. Run plan, or check the id with search-urls.")


def can_transition(old: str, new: str) -> bool:
    return new in TRANSITIONS.get(old, ())


def _apply_status(item: Dict[str, Any], status: str, today: dt.date, due_on: Optional[dt.date]) -> None:
    if item.get("status") == "removed" and status != "removed":
        item["removed_on"] = None
    item["status"] = status
    if status == "requested":
        if item.get("requested_on") and not item.get("first_requested_on"):
            item["first_requested_on"] = item["requested_on"]
        item["requested_on"] = today.isoformat()
        item["due_on"] = due_on.isoformat() if due_on else None
    if status == "removed":
        item["removed_on"] = today.isoformat()


def transition(
    ledger: Dict[str, Any],
    item_id: str,
    status: str,
    *,
    now: str,
    today: dt.date,
    evidence: Optional[str] = None,
    note: str = "",
    due_on: Optional[dt.date] = None,
) -> Dict[str, Any]:
    """Return a new ledger with the item moved to status. The input is not changed."""
    _check_status(status)
    updated = copy.deepcopy(ledger)
    item = find_item(updated, item_id)
    old = item["status"]
    evidence_url = check_evidence_url(evidence) if evidence else None
    repeat = old == status and status in REPEATABLE
    if old == status and not (repeat or evidence_url or note):
        raise UsageError(f"'{item_id}' is already {status}. Add --evidence or --note to record more.")
    if old != status and not can_transition(old, status):
        allowed = ", ".join(TRANSITIONS.get(old, ())) or "nothing"
        raise UsageError(f"'{item_id}' cannot go from {old} to {status}. From {old} it can go to: {allowed}.")
    if old != status or repeat:
        _apply_status(item, status, today, due_on)
    if evidence_url and evidence_url not in item["evidence_urls"]:
        item["evidence_urls"].append(evidence_url)
    item["history"].append(history_entry(status, note, now))
    return updated


def merge_plan(existing: Optional[Dict[str, Any]], person_id: str, planned: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Keep every existing item as it is and append newly planned ones."""
    if not existing:
        return new_ledger(person_id, planned)
    merged = copy.deepcopy(existing)
    known = {i.get("item_id") for i in merged.get("items", [])}
    merged.setdefault("items", []).extend(copy.deepcopy(i) for i in planned if i["item_id"] not in known)
    return merged


def save_ledger(ledger: Dict[str, Any]) -> Path:
    person_id = validate_person_id(ledger.get("person_id"))
    paths.ensure_person_dir(person_id)
    return storage.write_json_private(paths.ledger_path(person_id), ledger)


def load_ledger(person_id: str) -> Dict[str, Any]:
    path = paths.ledger_path(person_id)
    if not path.is_file():
        raise UsageError(f"No plan for '{person_id}' yet. Run plan first.")
    data = storage.read_json(path, what="ledger")
    if not isinstance(data, dict) or data.get("person_id") != person_id:
        raise RefusalError(f"The ledger for '{person_id}' does not match this person.")
    for item in data.get("items", []):
        validate_item_id(item.get("item_id"))
    return data
