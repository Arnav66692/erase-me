"""Read-only bridge to the existing skill catalog. Never touches ~/.erase-me."""
from __future__ import annotations

import datetime as dt
import sys
from pathlib import Path

from . import form_routes


ROOT = Path(__file__).resolve().parents[1]
SKILL = ROOT / 'skills' / 'erase-me'
if str(SKILL / 'scripts') not in sys.path:
    sys.path.insert(0, str(SKILL / 'scripts'))

from erase_me import catalog, planner, sites  # noqa: E402


def profile(user: dict) -> dict:
    country = user.get('country') or ''
    city = user.get('city')
    return {
        'person_id': user['id'], 'full_name': user['name'], 'name_variants': [],
        'country': country, 'region': user.get('region'),
        'cities': [{'city': city, 'country': country, 'region': user.get('region'), 'current': True}] if city else [],
        'age_range': f"{user['age']}-{user['age']}", 'phones': [], 'emails': [user['email']], 'language': 'en',
    }


def plan(user: dict) -> list[dict]:
    record = profile(user)
    refs = SKILL / 'references'
    cat = catalog.load_catalog(refs, record['country'])
    result = []
    for item in planner.plan_items(record, refs, now=dt.datetime.now(dt.timezone.utc).isoformat()):
        if item['status'] == 'skipped' or item['source'] == 'jurisdiction':
            continue
        info = catalog.describe(cat, item)
        site = catalog.find_site(cat, item)
        if not site or info['category'] in ('account', 'legal_route'):
            continue
        search = sites.build_search(site, record)
        result.append({
            'id': item['item_id'], 'name': info['name'], 'domain': info['domain'],
            'category': info['category'], 'search_urls': search['urls'], 'search_missing': search['missing'],
            'optout_url': info['optout_url'], 'email': info['email'], 'method': info['method'],
            'fields_needed': info['fields_needed'], 'requires': info['requires'],
            'verified': info['verified'], 'expected_days': info['expected_days'], 'regime': item['regime'],
        })
    return result + form_routes.plans()


def request_letter(user: dict, site: dict, listing_url: str, request_id: str) -> tuple[str, str]:
    """Use a plain request with no unsupported legal assertions or spoofed sender."""
    name, email = user['name'], user['email']
    body = (
        f"Dear {site['name']} privacy team,\n\n"
        f"Erase Me is submitting this privacy request with the authorization of {name}. "
        "Please delete the personal data in the listing below and stop publishing or selling it.\n\n"
        f"Name: {name}\nSupplied contact email: {email}\nListing: {listing_url}\n"
        f"Request reference: {request_id}\n\n"
        "Please confirm receipt and completion by replying to this message. If more information is "
        "needed to match the listing, please specify the minimum required. No identity documents "
        "are attached. This request does not claim a signed statutory agency appointment.\n\n"
        "Submitted through Erase Me with the person's recorded authorization. This is not legal advice.\n"
    )
    return 'Personal information removal request', body
