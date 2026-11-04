"""Builds the ordered list of ledger items for a person."""
from __future__ import annotations

from pathlib import Path
from typing import Any, Dict, List, Optional, Set, Tuple

from . import jurisdiction, ledger, sites
from .ids import is_valid_item_id

SOURCE_JURISDICTION = "jurisdiction"
SOURCE_GLOBAL = "global"
DEFAULT_SPECIAL_CHANNEL = "web_form"
DROP_CHANNEL = "drop"
DEFAULT_SITE_CHANNEL = "web_form"

Entry = Tuple[str, Dict[str, Any]]


def _item_id(raw: object) -> Optional[str]:
    if is_valid_item_id(raw):
        return str(raw)
    slug = sites.slugify(str(raw or ""))[:64]
    return slug if is_valid_item_id(slug) else None


def special_channel_kind(channel: Dict[str, Any], item_id: str) -> str:
    """Use the declared channel. Without one, a '*-drop' id is a DROP-style portal, anything else a web form."""
    if channel.get("channel"):
        return str(channel["channel"])
    if item_id == DROP_CHANNEL or item_id.endswith("-" + DROP_CHANNEL):
        return DROP_CHANNEL
    return DEFAULT_SPECIAL_CHANNEL


def _special_items(matched: List[Dict[str, Any]], now: str) -> List[Dict[str, Any]]:
    items = []
    for regime in matched:
        if not jurisdiction.usable_for_requests(regime):
            continue
        for channel in regime.get("special_channels") or []:
            item_id = _item_id(channel.get("id"))
            if item_id:
                kind = special_channel_kind(channel, item_id)
                items.append(ledger.new_item(item_id, item_id, SOURCE_JURISDICTION, kind, regime.get("code"), now=now))
    return items


def _site_entries(record: Dict[str, Any], references: Path) -> List[Entry]:
    country = record["country"]
    global_sites = [s for s in sites.load_global_sites(references) if sites.applies_in_country(s, country)]
    entries = [(SOURCE_GLOBAL, s) for s in global_sites]
    entries += [(f"countries/{country.lower()}", s) for s in sites.load_country_sites(references, country)]
    return entries


def _parent_order(entries: List[Entry]) -> List[Entry]:
    parents = [e for e in entries if e[1].get("covers")]
    return sorted(parents, key=lambda e: sites.sort_key(e[1]))


def _coverage(entries: List[Entry]) -> Dict[str, str]:
    """Map each covered site id to the name of the active parent that covers it."""
    covered: Dict[str, str] = {}
    active: Set[str] = set()
    for _, parent in _parent_order(entries):
        parent_id = parent.get("id")
        if parent_id in covered:
            continue
        active.add(parent_id)
        for child in parent.get("covers") or []:
            if child not in active and child != parent_id:
                covered.setdefault(child, parent.get("name") or str(parent_id))
    return covered


def order_sites(entries: List[Entry]) -> List[Tuple[str, Dict[str, Any], Optional[str]]]:
    """Active sites in input order, then covered children with their parent's name."""
    covered = _coverage(entries)
    active = [(src, s, None) for src, s in entries if s.get("id") not in covered]
    children = [(src, s, covered[s.get("id")]) for src, s in entries if s.get("id") in covered]
    return active + children


def _site_item(source: str, site: Dict[str, Any], parent: Optional[str], regime: Optional[str], now: str):
    item_id = _item_id(site.get("id"))
    if not item_id:
        return None
    channel = (site.get("optout") or {}).get("method") or DEFAULT_SITE_CHANNEL
    if parent:
        note = f"Covered by the {parent} opt-out."
        return ledger.new_item(item_id, item_id, source, channel, regime, status="skipped", note=note, now=now)
    return ledger.new_item(item_id, item_id, source, channel, regime, now=now)


def _dedupe(entries: List[Entry]) -> List[Entry]:
    seen: Set[str] = set()
    unique = []
    for source, site in entries:
        key = _item_id(site.get("id"))
        if key and key not in seen:
            seen.add(key)
            unique.append((source, site))
    return unique


def plan_items(record: Dict[str, Any], references: Path, now: str) -> List[Dict[str, Any]]:
    matched = jurisdiction.match_regimes(jurisdiction.load_regimes(references), record["country"], record.get("region"))
    primary = jurisdiction.primary_regime(matched, record.get("region"))
    regime_code = primary.get("code") if primary else None
    items = _special_items(matched, now)
    taken = {i["item_id"] for i in items}
    entries = [e for e in _dedupe(_site_entries(record, references)) if _item_id(e[1].get("id")) not in taken]
    for source, site, parent in order_sites(entries):
        item = _site_item(source, site, parent, regime_code, now)
        if item:
            items.append(item)
    return items
