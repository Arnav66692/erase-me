"""Site packs: loading, slugs and search URL templates."""
from __future__ import annotations

import itertools
import re
import unicodedata
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple
from urllib.parse import quote

from . import profile as profile_mod
from .refdata import load_folder
from .regions import region_name

MAX_SEARCH_URLS = 10
DEFAULT_PRIORITY = 2
ANY_COUNTRY = "*"
SITE_CATEGORIES = (
    "people_search", "data_broker", "caller_id", "search_engine", "directory", "account", "marketing", "legal_route",
)
PLACEHOLDER_RE = re.compile(r"\{([a-z_]+)\}")
ALLOWED_PLACEHOLDERS = ("first", "last", "full", "city", "region", "region_name", "country", "phone", "email")
TRANSLIT = str.maketrans({
    "ı": "i", "İ": "i", "ß": "ss", "ø": "o", "Ø": "o", "æ": "ae", "Æ": "ae", "œ": "oe",
    "Œ": "oe", "đ": "d", "Đ": "d", "ł": "l", "Ł": "l", "þ": "th", "Þ": "th", "'": "-",
})


def sort_key(site: Dict[str, Any]) -> Tuple[int, str]:
    priority = site.get("priority")
    return (priority if isinstance(priority, int) else DEFAULT_PRIORITY, str(site.get("id", "")))


def load_sites(folder: Path) -> List[Dict[str, Any]]:
    return sorted(load_folder(folder), key=sort_key)


def load_global_sites(references: Path) -> List[Dict[str, Any]]:
    return load_sites(references / "global")


def load_country_sites(references: Path, country: str) -> List[Dict[str, Any]]:
    return load_sites(references / "countries" / country.lower())


def applies_in_country(site: Dict[str, Any], country: str) -> bool:
    countries = site.get("countries") or []
    return not countries or ANY_COUNTRY in countries or country in countries


def find_site(references: Path, country: str, site_id: str) -> Optional[Dict[str, Any]]:
    for site in load_global_sites(references) + load_country_sites(references, country):
        if site.get("id") == site_id:
            return site
    return None


def slugify(text: Optional[str]) -> str:
    if not text:
        return ""
    plain = unicodedata.normalize("NFKD", text.translate(TRANSLIT))
    ascii_only = "".join(ch for ch in plain if not unicodedata.combining(ch)).lower()
    return re.sub(r"[^a-z0-9]+", "-", ascii_only).strip("-")


def search_values(
    record: Dict[str, Any],
    city: Optional[Dict[str, Any]] = None,
    phone: Optional[str] = None,
    email: Optional[str] = None,
) -> Dict[str, str]:
    first, last = profile_mod.name_parts(record)
    region = (city or {}).get("region") or record.get("region")
    return {
        "first": slugify(first),
        "last": slugify(last),
        "full": slugify(record.get("full_name")),
        "city": slugify((city or {}).get("city")),
        "region": slugify(region.split("-", 1)[-1]) if region else "",
        "region_name": slugify(region_name(region)),
        "country": (record.get("country") or "").lower(),
        "phone": "".join(ch for ch in (phone or "") if ch.isdigit()),
        "email": quote(email or "", safe=""),
    }


def fill_template(template: str, values: Dict[str, str]) -> Tuple[Optional[str], List[str]]:
    names = PLACEHOLDER_RE.findall(template)
    missing = [n for n in dict.fromkeys(names) if not values.get(n)]
    if missing:
        return None, missing
    return PLACEHOLDER_RE.sub(lambda m: values[m.group(1)], template), []


def _combos(record: Dict[str, Any], names: List[str]) -> List[Tuple[Any, Any, Any]]:
    cities = (record.get("cities") or [None]) if "city" in names else [None]
    phones = (record.get("phones") or [None]) if "phone" in names else [None]
    emails = (record.get("emails") or [None]) if "email" in names else [None]
    return list(itertools.product(cities, phones, emails))


def build_search(site: Dict[str, Any], record: Dict[str, Any]) -> Dict[str, Any]:
    search = site.get("search") or {}
    template = search.get("url_template")
    result = {"method": search.get("method", "none"), "urls": [], "missing": [], "notes": search.get("notes", "")}
    if not template:
        return result
    names = PLACEHOLDER_RE.findall(template)
    urls: List[str] = []
    missing: List[str] = []
    for city, phone, email in _combos(record, names):
        url, gaps = fill_template(template, search_values(record, city, phone, email))
        missing.extend(g for g in gaps if g not in missing)
        if url and url not in urls:
            urls.append(url)
    result["urls"] = urls[:MAX_SEARCH_URLS]
    result["missing"] = [] if urls else missing
    return result
