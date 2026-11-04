"""Lookup of what each ledger item refers to: a site or a regime's special channel."""
from __future__ import annotations

import copy
from pathlib import Path
from typing import Any, Dict

from . import jurisdiction, sites

SPECIAL_CATEGORY = "legal_channel"
UNKNOWN_CATEGORY = "unknown"


def load_catalog(references: Path, country: str) -> Dict[str, Any]:
    regimes = jurisdiction.load_regimes(references)
    site_map: Dict[str, Dict[str, Any]] = {}
    for site in sites.load_global_sites(references) + sites.load_country_sites(references, country):
        for key in (str(site.get("id")), sites.slugify(str(site.get("id")))):
            site_map.setdefault(key, site)
    specials: Dict[str, Dict[str, Any]] = {}
    for regime in regimes:
        for channel in regime.get("special_channels") or []:
            specials.setdefault(str(channel.get("id")), {"channel": channel, "regime": regime})
    return {"regimes": {r.get("code"): r for r in regimes}, "sites": site_map, "specials": specials}


def _regime_name(cat: Dict[str, Any], code: Any) -> Any:
    regime = cat["regimes"].get(code)
    return regime.get("name") if regime else None


def _describe_special(entry: Dict[str, Any], item: Dict[str, Any], cat: Dict[str, Any]) -> Dict[str, Any]:
    channel = entry["channel"]
    return {
        "name": channel.get("name") or item["item_id"],
        "category": SPECIAL_CATEGORY,
        "domain": None,
        "method": item.get("channel"),
        "optout_url": channel.get("url") or None,
        "email": None,
        "requires": list(channel.get("requires") or []),
        "fields_needed": [],
        "steps": list(channel.get("steps") or []),
        "expected_days": None,
        "search_method": "none",
        "notes": channel.get("note", ""),
        "verified": bool(entry["regime"].get("verified")),
    }


def _describe_site(site: Dict[str, Any], item: Dict[str, Any]) -> Dict[str, Any]:
    optout = site.get("optout") or {}
    return {
        "name": site.get("name") or item["item_id"],
        "category": site.get("category") or UNKNOWN_CATEGORY,
        "domain": site.get("domain"),
        "method": optout.get("method") or item.get("channel"),
        "optout_url": optout.get("url") or None,
        "email": optout.get("email"),
        "requires": list(optout.get("requires") or []),
        "fields_needed": list(optout.get("fields_needed") or []),
        "steps": list(optout.get("steps") or []),
        "expected_days": optout.get("expected_days"),
        "search_method": (site.get("search") or {}).get("method", "none"),
        "notes": optout.get("notes", ""),
        "verified": bool(site.get("verified")),
    }


CUSTOM_STEPS = (
    "Draft the request with the draft command.",
    "Send it yourself to the site's privacy email or contact form.",
    "Record it as requested.",
)


def _describe_custom(site: Dict[str, Any], item: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "name": site.get("name") or item["item_id"], "category": site.get("category") or UNKNOWN_CATEGORY,
        "domain": site.get("domain"), "method": item.get("channel"), "optout_url": None,
        "email": site.get("email"), "requires": [], "fields_needed": [], "steps": list(CUSTOM_STEPS),
        "expected_days": None, "search_method": "none", "notes": "", "verified": False,
    }


def _describe_unknown(item: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "name": item["item_id"], "category": UNKNOWN_CATEGORY, "domain": None, "method": item.get("channel"),
        "optout_url": None, "email": None, "requires": [], "fields_needed": [], "steps": [],
        "expected_days": None, "search_method": "none", "notes": "", "verified": False,
    }


NON_CATALOG_SOURCES = ("jurisdiction", "custom")


def find_site(cat: Dict[str, Any], item: Dict[str, Any]):
    if item.get("source") in NON_CATALOG_SOURCES:
        return None
    return cat["sites"].get(item.get("site_id"))


def describe(cat: Dict[str, Any], item: Dict[str, Any]) -> Dict[str, Any]:
    special = cat["specials"].get(item.get("site_id")) if item.get("source") == "jurisdiction" else None
    site = find_site(cat, item)
    if special:
        info = _describe_special(special, item, cat)
    elif site:
        info = _describe_site(site, item)
    elif isinstance(item.get("site"), dict):
        info = _describe_custom(item["site"], item)
    else:
        info = _describe_unknown(item)
    info = copy.deepcopy(info)
    info.update({"item_id": item["item_id"], "regime": item.get("regime"), "regime_name": _regime_name(cat, item.get("regime"))})
    return info
