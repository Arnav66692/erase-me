"""Profile intake and validation. Stored locally only."""
from __future__ import annotations

import re
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Tuple

from . import paths, storage
from .errors import UsageError
from .ids import validate_person_id

COUNTRY_RE = re.compile(r"[A-Z]{2}")
REGION_RE = re.compile(r"[A-Z]{2}-[A-Z0-9]{1,3}")
AGE_RE = re.compile(r"\d{1,3}(-\d{1,3}|\+)")
EMAIL_RE = re.compile(r"[^@\s]+@[^@\s]+\.[^@\s]+")
PHONE_RE = re.compile(r"[0-9+\-(). ]+")
LANGUAGE_RE = re.compile(r"[a-z]{2,3}(-[A-Za-z0-9]{2,8})?")
MIN_PHONE_DIGITS = 5
MAX_TEXT = 200
DEFAULT_LANGUAGE = "en"


def clean_text(value: object, label: str, max_length: int = MAX_TEXT) -> str:
    if not isinstance(value, str):
        raise UsageError(f"{label} must be text.")
    if any(ord(ch) < 32 for ch in value):
        raise UsageError(f"{label} must not contain line breaks or control characters.")
    cleaned = " ".join(value.split())
    if not cleaned or len(cleaned) > max_length:
        raise UsageError(f"{label} must be 1 to {max_length} characters.")
    return cleaned


def normalize_country(value: str) -> str:
    code = (value or "").strip().upper()
    if not COUNTRY_RE.fullmatch(code):
        raise UsageError(f"Country must be a two-letter ISO code like US or GB, not '{value}'.")
    return code


def normalize_region(value: Optional[str], country: str) -> Optional[str]:
    if value is None:
        return None
    code = value.strip().upper()
    if not REGION_RE.fullmatch(code) or not code.startswith(country + "-"):
        raise UsageError(f"Region must be an ISO 3166-2 code inside {country}, like {country}-CA, not '{value}'.")
    return code


def _phones(values: Iterable[str]) -> List[str]:
    result = []
    for raw in values:
        phone = raw.strip()
        digits = sum(ch.isdigit() for ch in phone)
        if not PHONE_RE.fullmatch(phone) or digits < MIN_PHONE_DIGITS:
            raise UsageError(f"'{raw}' does not look like a phone number.")
        result.append(phone)
    return result


def _emails(values: Iterable[str]) -> List[str]:
    result = []
    for raw in values:
        email = raw.strip().lower()
        if not EMAIL_RE.fullmatch(email):
            raise UsageError(f"'{raw}' does not look like an email address.")
        result.append(email)
    return result


def _cities(values: Iterable[str], region: Optional[str], country: str) -> List[Dict[str, Any]]:
    cities = [clean_text(v, "City") for v in values]
    return [
        {"city": city, "region": region, "country": country, "current": index == 0}
        for index, city in enumerate(cities)
    ]


def _variants(values: Iterable[str], full_name: str) -> List[str]:
    seen = {full_name.casefold()}
    result = []
    for raw in values:
        variant = clean_text(raw, "Name variant")
        if variant.casefold() not in seen:
            seen.add(variant.casefold())
            result.append(variant)
    return result


def _optional_match(value: Optional[str], pattern: "re.Pattern[str]", label: str) -> Optional[str]:
    if value is None:
        return None
    cleaned = value.strip()
    if not pattern.fullmatch(cleaned):
        raise UsageError(f"'{value}' is not a valid {label}.")
    return cleaned


def build_profile(
    person_id: str,
    full_name: str,
    country: str,
    region: Optional[str] = None,
    cities: Iterable[str] = (),
    age_range: Optional[str] = None,
    phones: Iterable[str] = (),
    emails: Iterable[str] = (),
    variants: Iterable[str] = (),
    language: str = DEFAULT_LANGUAGE,
) -> Dict[str, Any]:
    validate_person_id(person_id)
    name = clean_text(full_name, "Full name")
    country_code = normalize_country(country)
    region_code = normalize_region(region, country_code)
    return {
        "person_id": person_id,
        "full_name": name,
        "name_variants": _variants(variants, name),
        "country": country_code,
        "region": region_code,
        "cities": _cities(cities, region_code, country_code),
        "age_range": _optional_match(age_range, AGE_RE, "age range (use 30-39 or 80+)"),
        "phones": _phones(phones),
        "emails": _emails(emails),
        "language": _optional_match(language, LANGUAGE_RE, "language code") or DEFAULT_LANGUAGE,
    }


def save_profile(record: Dict[str, Any]) -> Path:
    person_id = validate_person_id(record.get("person_id"))
    paths.ensure_person_dir(person_id)
    return storage.write_json_private(paths.profile_path(person_id), record)


def load_profile(person_id: str) -> Dict[str, Any]:
    path = paths.profile_path(person_id)
    if not path.is_file():
        raise UsageError(f"No profile for '{person_id}' yet. Run intake first.")
    return storage.read_json(path, what="profile")


def name_parts(record: Dict[str, Any]) -> Tuple[str, str]:
    parts = record.get("full_name", "").split()
    if not parts:
        return "", ""
    if len(parts) == 1:
        return parts[0], ""
    return parts[0], parts[-1]


def current_city(record: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    cities = record.get("cities") or []
    for city in cities:
        if city.get("current"):
            return city
    return cities[0] if cities else None
