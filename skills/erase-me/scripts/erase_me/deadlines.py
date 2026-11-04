"""Legal response deadlines and overdue detection."""
from __future__ import annotations

import calendar
import datetime as dt
from typing import Any, Dict, List, Optional

DEFAULT_RESPONSE_DAYS = 30
NO_FIXED_DEADLINE_FOLLOWUP_DAYS = 30
SATURDAY = 5
DAYS_PER_EXTENSION_MONTH = 30
BASIS_ONE_MONTH = "one_month"
BUSINESS = "business"


def add_months(start: dt.date, months: int) -> dt.date:
    """Calendar months. The day is clamped to the end of a shorter month."""
    month_index = start.month - 1 + months
    year = start.year + month_index // 12
    month = month_index % 12 + 1
    day = min(start.day, calendar.monthrange(year, month)[1])
    return dt.date(year, month, day)


def add_business_days(start: dt.date, days: int) -> dt.date:
    current = start
    remaining = days
    while remaining > 0:
        current += dt.timedelta(days=1)
        if current.weekday() < SATURDAY:
            remaining -= 1
    return current


def _positive_int(value: Any) -> Optional[int]:
    if isinstance(value, bool) or not isinstance(value, int) or value <= 0:
        return None
    return value


def is_statutory(rule: Optional[Dict[str, Any]]) -> bool:
    """True only when the law itself fixes a response period."""
    if not rule:
        return False
    return rule.get("basis") == BASIS_ONE_MONTH or _positive_int(rule.get("days")) is not None


def compute_due(
    requested_on: dt.date, rule: Optional[Dict[str, Any]], fallback_days: int = DEFAULT_RESPONSE_DAYS
) -> dt.date:
    """The legal deadline, or a suggested follow-up date when the law sets none."""
    rule = rule or {}
    if rule.get("basis") == BASIS_ONE_MONTH:
        return add_months(requested_on, 1)
    days = _positive_int(rule.get("days"))
    if days is None:
        followup = NO_FIXED_DEADLINE_FOLLOWUP_DAYS if rule else fallback_days
        return requested_on + dt.timedelta(days=followup)
    if rule.get("day_type") == BUSINESS:
        return add_business_days(requested_on, days)
    return requested_on + dt.timedelta(days=days)


def extended_due(due_on: dt.date, rule: Optional[Dict[str, Any]]) -> Optional[dt.date]:
    """Extensions follow the rule's own unit: calendar months, business days or calendar days."""
    rule = rule or {}
    extension = _positive_int(rule.get("extension_days"))
    if extension is None:
        return None
    if rule.get("basis") == BASIS_ONE_MONTH:
        return add_months(due_on, max(1, round(extension / DAYS_PER_EXTENSION_MONTH)))
    if rule.get("day_type") == BUSINESS:
        return add_business_days(due_on, extension)
    return due_on + dt.timedelta(days=extension)


def _next_kind(today: dt.date, final_due: dt.date, regime: Optional[Dict[str, Any]]) -> str:
    statutory = is_statutory((regime or {}).get("deadline"))
    if statutory and regime.get("regulators") and today > final_due:
        return "complaint"
    return "followup"


def overdue(ledger: Dict[str, Any], regimes: Dict[str, Dict[str, Any]], today: dt.date) -> List[Dict[str, Any]]:
    """Requested items whose due date has passed, with the next draft to prepare."""
    rows = []
    for item in ledger.get("items", []):
        if item.get("status") != "requested" or not item.get("due_on"):
            continue
        due = dt.date.fromisoformat(item["due_on"])
        if today <= due:
            continue
        regime = regimes.get(item.get("regime") or "")
        extended = extended_due(due, (regime or {}).get("deadline"))
        rows.append({
            "item_id": item["item_id"],
            "site_id": item.get("site_id"),
            "regime": item.get("regime"),
            "requested_on": item.get("requested_on"),
            "due_on": item["due_on"],
            "extended_due_on": extended.isoformat() if extended else None,
            "days_overdue": (today - due).days,
            "next_kind": _next_kind(today, extended or due, regime),
            "statutory": is_statutory((regime or {}).get("deadline")),
        })
    return rows
