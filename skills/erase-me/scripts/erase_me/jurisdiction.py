"""Privacy law regimes: matching, regulator choice and warnings."""
from __future__ import annotations

import copy
from pathlib import Path
from typing import Any, Dict, List, Optional

from .refdata import load_folder

NOT_IN_FORCE = "not_in_force"
PARTIAL = "partial"
ANY_COUNTRY = "*"


def load_regimes(references: Path) -> List[Dict[str, Any]]:
    regimes = load_folder(references / "jurisdictions")
    return sorted(regimes, key=lambda r: str(r.get("code", "")))


def _applies_to(regime: Dict[str, Any]) -> Dict[str, List[str]]:
    applies = regime.get("applies_to") or {}
    return {"countries": applies.get("countries") or [], "regions": applies.get("regions") or []}


def matches_region(regime: Dict[str, Any], region: Optional[str]) -> bool:
    return bool(region) and region in _applies_to(regime)["regions"]


def applies(regime: Dict[str, Any], country: str, region: Optional[str]) -> bool:
    """A regime that lists regions applies only inside them, even if it also lists the country."""
    scope = _applies_to(regime)
    if scope["regions"]:
        return matches_region(regime, region)
    return country in scope["countries"]


def match_regimes(regimes: List[Dict[str, Any]], country: str, region: Optional[str]) -> List[Dict[str, Any]]:
    """Regional regimes first, then national ones."""
    matched = [r for r in regimes if applies(r, country, region)]
    regional = [r for r in matched if matches_region(r, region)]
    return regional + [r for r in matched if r not in regional]


def pick_regulator(regime: Dict[str, Any], country: str, region: Optional[str]) -> Optional[Dict[str, Any]]:
    regulators = regime.get("regulators") or []
    tiers = (
        lambda r: bool(region) and r.get("region") == region,
        lambda r: r.get("country") == country and not r.get("region"),
        lambda r: r.get("country") == ANY_COUNTRY,
    )
    for tier in tiers:
        for regulator in regulators:
            if tier(regulator):
                return dict(regulator)
    return None


def usable_for_requests(regime: Dict[str, Any]) -> bool:
    return regime.get("status") != NOT_IN_FORCE


def regime_warnings(regime: Dict[str, Any]) -> List[str]:
    warnings = []
    if not regime.get("verified"):
        warnings.append("Not verified against an official source yet. Do not rely on it for public claims.")
    status = regime.get("status")
    if status == NOT_IN_FORCE:
        since = regime.get("in_force_from") or "a later date"
        warnings.append(f"Not in force yet (expected from {since}). Erase Me will not draft legal requests under it.")
    if status == PARTIAL:
        note = regime.get("status_note") or "Check which rights apply."
        warnings.append(f"Only partly in force. {note}")
    return warnings


def primary_regime(matched: List[Dict[str, Any]], region: Optional[str]) -> Optional[Dict[str, Any]]:
    """The regime to cite by default: in force, verified first, regional before national."""
    usable = [r for r in matched if usable_for_requests(r)]
    if not usable:
        return None
    return sorted(
        usable,
        key=lambda r: (0 if r.get("verified") else 1, 0 if matches_region(r, region) else 1, str(r.get("code"))),
    )[0]


def right_citation(regime: Dict[str, Any], right: str) -> Optional[str]:
    for entry in regime.get("rights") or []:
        if entry.get("right") == right:
            return entry.get("citation") or None
    return None


def summarize(regime: Dict[str, Any], country: str, region: Optional[str]) -> Dict[str, Any]:
    return {
        "code": regime.get("code"),
        "name": regime.get("name"),
        "short_name": regime.get("short_name"),
        "status": regime.get("status"),
        "in_force_from": regime.get("in_force_from"),
        "status_note": regime.get("status_note", ""),
        "verified": bool(regime.get("verified")),
        "verified_on": regime.get("verified_on"),
        "rights": copy.deepcopy(regime.get("rights") or []),
        "deadline": copy.deepcopy(regime.get("deadline") or {}),
        "regulator": pick_regulator(regime, country, region),
        "authorized_agent": copy.deepcopy(regime.get("authorized_agent") or {}),
        "identity_verification": regime.get("identity_verification", ""),
        "special_channels": copy.deepcopy(regime.get("special_channels") or []),
        "public_records_note": regime.get("public_records_note", ""),
        "usable_for_requests": usable_for_requests(regime),
        "warnings": regime_warnings(regime),
    }
