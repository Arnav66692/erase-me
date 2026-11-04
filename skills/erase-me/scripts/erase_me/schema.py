"""Small field checkers used by the validator. Each one records errors and never raises."""
from __future__ import annotations

import datetime as dt
import re
from typing import Any, Callable, Dict, List, Optional
from urllib.parse import urlparse

COUNTRY_RE = re.compile(r"[A-Z]{2}")
REGION_RE = re.compile(r"[A-Z]{2}-[A-Z0-9]{1,3}")
DATE_RE = re.compile(r"\d{4}-\d{2}-\d{2}")
EMAIL_RE = re.compile(r"[^@\s]+@[^@\s]+\.[^@\s]+")
DOMAIN_RE = re.compile(r"(?=.{1,253}\Z)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}")
ANY_COUNTRY = "*"


class FileReport:
    """Collects 'path: field: message' errors for one file."""

    def __init__(self, rel_path: str) -> None:
        self.rel_path = rel_path
        self.errors: List[str] = []

    def add(self, field: str, message: str) -> None:
        prefix = f"{self.rel_path}: {field}: " if field else f"{self.rel_path}: "
        self.errors.append(prefix + message)


def require(report: FileReport, obj: Any, key: str, prefix: str = "") -> Any:
    field = f"{prefix}{key}"
    if not isinstance(obj, dict) or key not in obj:
        report.add(field, "is required")
        return None
    return obj[key]


def is_type(report: FileReport, field: str, value: Any, kind: type, label: str) -> bool:
    if isinstance(value, bool) and kind is int:
        report.add(field, f"must be {label}")
        return False
    if not isinstance(value, kind):
        report.add(field, f"must be {label}")
        return False
    return True


def text(report: FileReport, field: str, value: Any, allow_empty: bool = True) -> None:
    if not is_type(report, field, value, str, "text"):
        return
    if not allow_empty and not value.strip():
        report.add(field, "must not be empty")


def optional_text(report: FileReport, field: str, value: Any) -> None:
    if value is not None:
        text(report, field, value)


def enum(report: FileReport, field: str, value: Any, allowed: tuple) -> None:
    if value not in allowed:
        report.add(field, f"must be one of {', '.join(allowed)}, not {value!r}")


def boolean(report: FileReport, field: str, value: Any) -> None:
    if not isinstance(value, bool):
        report.add(field, "must be true or false")


def integer(report: FileReport, field: str, value: Any, low: int, high: Optional[int] = None, nullable: bool = False) -> None:
    if value is None and nullable:
        return
    if isinstance(value, bool) or not isinstance(value, int) or value < low or (high is not None and value > high):
        bounds = f"{low} to {high}" if high is not None else f"at least {low}"
        report.add(field, f"must be a whole number {bounds}{' or null' if nullable else ''}")


def date(report: FileReport, field: str, value: Any, nullable: bool = False) -> None:
    if value is None and nullable:
        return
    if not isinstance(value, str) or not DATE_RE.fullmatch(value):
        report.add(field, "must be a YYYY-MM-DD date")
        return
    try:
        dt.date.fromisoformat(value)
    except ValueError:
        report.add(field, "is not a real calendar date")


def https_url(report: FileReport, field: str, value: Any, allow_empty: bool = False) -> None:
    if allow_empty and value in ("", None):
        return
    parsed = urlparse(value) if isinstance(value, str) else None
    if parsed is None or parsed.scheme != "https" or not parsed.netloc or any(c.isspace() for c in value):
        report.add(field, f"must be an https URL, not {value!r}")


def email(report: FileReport, field: str, value: Any, nullable: bool = True) -> None:
    if value is None and nullable:
        return
    if not isinstance(value, str) or not EMAIL_RE.fullmatch(value):
        report.add(field, f"must be an email address, not {value!r}")


def country(report: FileReport, field: str, value: Any, allow_star: bool = False) -> None:
    if allow_star and value == ANY_COUNTRY:
        return
    if not isinstance(value, str) or not COUNTRY_RE.fullmatch(value):
        report.add(field, f"must be an uppercase ISO 3166-1 alpha-2 code, not {value!r}")


def region(report: FileReport, field: str, value: Any, nullable: bool = False) -> None:
    if value is None and nullable:
        return
    if not isinstance(value, str) or not REGION_RE.fullmatch(value):
        report.add(field, f"must be an ISO 3166-2 code like US-CA, not {value!r}")


def domain(report: FileReport, field: str, value: Any) -> None:
    if not isinstance(value, str) or not DOMAIN_RE.fullmatch(value):
        report.add(field, f"must be a bare lowercase domain like example.com, not {value!r}")


def each(report: FileReport, field: str, value: Any, check: Callable[[str, Any], None], non_empty: bool = False) -> None:
    if not is_type(report, field, value, list, "a list"):
        return
    if non_empty and not value:
        report.add(field, "must not be empty")
    for index, entry in enumerate(value):
        check(f"{field}[{index}]", entry)


def obj(report: FileReport, field: str, value: Any) -> Optional[Dict[str, Any]]:
    return value if is_type(report, field, value, dict, "an object") else None
