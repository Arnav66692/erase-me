"""Counts for the stats command, the report and the share card."""
from __future__ import annotations

import datetime as dt
from typing import Any, Dict, Iterable, Optional

from .ledger import STATUSES

UNCHECKED = frozenset({"planned", "skipped"})
LISTING_STATES = frozenset({"found", "requested", "removed", "rejected", "relisted"})
PERCENT = 100
NOT_AVAILABLE = "n/a"
LABELS = {
    "sites_checked": ("site checked", "sites checked"),
    "found": ("listing found", "listings found"),
    "requested": ("removal request", "removal requests"),
    "removed": ("listing erased", "listings erased"),
}


def _history_statuses(item: Dict[str, Any]) -> set:
    return {entry.get("status") for entry in item.get("history", [])} | {item.get("status")}


def _ever(item: Dict[str, Any], status: str) -> bool:
    return status in _history_statuses(item)


def _checked(item: Dict[str, Any]) -> bool:
    return bool(_history_statuses(item) - UNCHECKED)


def _start_date(items: Iterable[Dict[str, Any]]) -> Optional[dt.date]:
    dates = []
    for item in items:
        for entry in item.get("history", []):
            stamp = str(entry.get("at") or "")[:10]
            try:
                dates.append(dt.date.fromisoformat(stamp))
            except ValueError:
                continue
    return min(dates) if dates else None


def format_rate(removed: int, found: int) -> str:
    """Whole percent, rounded half up with integer math so 12.5 becomes 13."""
    if not found:
        return NOT_AVAILABLE
    return f"{(2 * PERCENT * removed + found) // (2 * found)}%"


def labels(counts: Dict[str, Any]) -> Dict[str, str]:
    return {f"{key}_label": words[0] if counts.get(key) == 1 else words[1] for key, words in LABELS.items()}


def compute(ledger: Dict[str, Any], today: dt.date) -> Dict[str, Any]:
    items = ledger.get("items", [])
    found = [i for i in items if _history_statuses(i) & LISTING_STATES]
    removed_found = [i for i in found if i.get("status") == "removed"]
    rate = (len(removed_found) / len(found)) if found else None
    start = _start_date(items)
    by_status = {status: 0 for status in STATUSES}
    for item in items:
        if item.get("status") in by_status:
            by_status[item["status"]] += 1
    result = {
        "total": len(items),
        "sites_checked": sum(1 for i in items if _checked(i)),
        "found": len(found),
        "requested": sum(1 for i in items if _ever(i, "requested")),
        "removed": by_status["removed"],
        "relisted": sum(1 for i in items if _ever(i, "relisted")),
        "removal_rate": format_rate(len(removed_found), len(found)),
        "removal_rate_value": round(rate, 4) if rate is not None else None,
        "days_since_start": max((today - start).days, 0) if start else 0,
        "by_status": by_status,
    }
    result.update(labels(result))
    return result
