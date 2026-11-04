"""Agent-ready views of ledger items: what to open, what to send, what a human must do."""
from __future__ import annotations

from typing import Any, Dict, Optional

from . import catalog, sites


def last_note(item: Dict[str, Any]) -> str:
    notes = [h.get("note") for h in item.get("history", []) if h.get("note")]
    return notes[-1] if notes else ""


def item_view(item: Dict[str, Any], cat: Dict[str, Any], record: Dict[str, Any]) -> Dict[str, Any]:
    info = catalog.describe(cat, item)
    site: Optional[Dict[str, Any]] = catalog.find_site(cat, item)
    search = sites.build_search(site, record) if site else {"method": "none", "urls": [], "missing": [], "notes": ""}
    return {
        "item_id": item["item_id"],
        "name": info["name"],
        "category": info["category"],
        "status": item.get("status"),
        "source": item.get("source"),
        "regime": item.get("regime"),
        "search_method": search["method"],
        "search_urls": search["urls"],
        "search_missing": search["missing"],
        "search_notes": search["notes"],
        "method": info["method"],
        "optout_url": info["optout_url"],
        "optout_email": info["email"],
        "requires": info["requires"],
        "fields_needed": info["fields_needed"],
        "steps": info["steps"],
        "expected_days": info["expected_days"],
        "verified": info["verified"],
        "notes": info["notes"],
        "last_note_untrusted": last_note(item),
    }
