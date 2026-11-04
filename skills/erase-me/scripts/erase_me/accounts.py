"""Account deletion links from the JustDeleteMe data (MIT, credited)."""
from __future__ import annotations

from pathlib import Path
from typing import Any, Dict, List, Optional

from . import storage
from .errors import UsageError

ACCOUNTS_FILE = "accounts/jdm.json"
DEFAULT_LIMIT = 25


def load_accounts(references: Path) -> Dict[str, Any]:
    path = references / ACCOUNTS_FILE
    if not path.is_file():
        raise UsageError(f"Account deletion data is missing. Expected {path}.")
    data = storage.read_json(path, what="accounts")
    if not isinstance(data, dict) or not isinstance(data.get("sites"), list):
        raise UsageError(f"{path} must be an object with a 'sites' list.")
    return data


def _matches(site: Dict[str, Any], needle: str) -> bool:
    haystack = [str(site.get("name", ""))] + [str(d) for d in site.get("domains") or []]
    return any(needle in value.casefold() for value in haystack)


def search(data: Dict[str, Any], query: Optional[str], limit: int = DEFAULT_LIMIT) -> List[Dict[str, Any]]:
    needle = (query or "").strip().casefold()
    sites = [dict(s) for s in data.get("sites", []) if isinstance(s, dict)]
    hits = [s for s in sites if not needle or _matches(s, needle)]
    return sorted(hits, key=lambda s: str(s.get("name", "")).casefold())[:limit]
