"""Bounded operator-configured browser adapter and an isolated synthetic demo."""
from __future__ import annotations

import json
import os
import re
import signal
import subprocess
from pathlib import Path
from urllib.parse import urlsplit

MAX_RESPONSE = 65536
MUTATING = frozenset({'submit', 'followup', 'confirm'})


class AdapterError(Exception):
    """No raw tool output is exposed: it may contain private information."""


def configured() -> bool:
    path = os.getenv('ERASE_ME_ADAPTER', '')
    return bool(path and Path(path).is_absolute() and Path(path).is_file() and os.access(path, os.X_OK))



def confirmation_address(request_id: str) -> str | None:
    inbox = os.getenv('ERASE_REMOVAL_INBOX', '').strip().lower()
    if not re.fullmatch(r'[a-z0-9._-]+@[a-z0-9.-]+\.[a-z]{2,}', inbox):
        return None
    if not re.fullmatch(r'[a-f0-9]{32}', request_id):
        return None
    local, domain = inbox.split('@')
    if len(local) + len(request_id) + 7 > 64:
        return None
    return f'{local}+erase-{request_id}@{domain}'

def allowed_url(url: object, domain: str) -> bool:
    if not isinstance(url, str) or len(url) > 2048 or not domain:
        return False
    try:
        parsed = urlsplit(url)
        host = (parsed.hostname or '').lower().rstrip('.')
        domain = domain.lower().rstrip('.')
        return (parsed.scheme == 'https' and parsed.username is None and parsed.password is None
                and parsed.port in (None, 443) and not any(c.isspace() for c in url)
                and (host == domain or host.endswith('.' + domain)))
    except ValueError:
        return False


def same_person(user: dict, match: object) -> bool:
    """A name alone or a same-name age alone never authorizes a removal."""
    if not isinstance(match, dict):
        return False
    norm = lambda value: ' '.join(str(value or '').casefold().split())
    if norm(match.get('name')) != norm(user['name']):
        return False
    if (user.get('verification_method') != 'self_attested_local'
            and match.get('email') and norm(match['email']) == norm(user['email'])):
        return True
    age_matches = type(match.get('age')) is int and match['age'] == user['age']
    city_matches = bool(user.get('city')) and norm(match.get('city')) == norm(user['city'])
    return age_matches and city_matches


def invoke(payload: dict) -> dict:
    if not configured():
        raise AdapterError('Browser automation is not configured.')
    executable = os.environ['ERASE_ME_ADAPTER']
    try:
        # stdout is directed into a private bounded-by-time temporary file. Avoid unbounded PIPE accumulation.
        import tempfile
        with tempfile.TemporaryFile() as output, tempfile.TemporaryFile() as errors:
            process = subprocess.Popen([executable], stdin=subprocess.PIPE, stdout=output,
                                       stderr=errors, start_new_session=True)
            try:
                process.communicate(json.dumps(payload).encode(), timeout=90)
            except subprocess.TimeoutExpired:
                # The adapter may have spawned browser helpers. End its whole process group.
                try:
                    os.killpg(process.pid, signal.SIGKILL)
                except ProcessLookupError:
                    pass
                process.communicate()
                raise
            if process.returncode:
                raise AdapterError('The automation adapter could not complete this step.')
            output.seek(0)
            raw = output.read(MAX_RESPONSE + 1)
        if len(raw) > MAX_RESPONSE:
            raise AdapterError('The automation adapter returned too much data.')
        response = json.loads(raw)
        if not isinstance(response, dict) or not isinstance(response.get('status'), str):
            raise AdapterError('The automation adapter returned an invalid response.')
        return response
    except (OSError, subprocess.TimeoutExpired, ValueError, UnicodeError) as exc:
        raise AdapterError('The automation adapter did not return a usable result.') from exc


DEMO_SITES = [
    {'id': 'demo-atlas', 'name': 'Atlas People', 'domain': 'atlas.example', 'outcome': 'email'},
    {'id': 'demo-openbook', 'name': 'Openbook Directory', 'domain': 'openbook.example', 'outcome': 'direct'},
    {'id': 'demo-northstar', 'name': 'Northstar Records', 'domain': 'northstar.example', 'outcome': 'id'},
    {'id': 'demo-clearline', 'name': 'Clearline Search', 'domain': 'clearline.example', 'outcome': 'absent'},
]


def demo_sites() -> list[dict]:
    return [{**s, 'category': 'people_search', 'search_urls': [f"https://{s['domain']}/search"],
             'search_missing': [], 'optout_url': f"https://{s['domain']}/remove", 'email': None,
             'method': 'web_form', 'fields_needed': ['listing_url', 'email'], 'requires': [],
             'verified': True, 'expected_days': 1} for s in DEMO_SITES]


def demo_invoke(payload: dict) -> dict:
    site, person, action = payload['site'], payload['person'], payload['action']
    result = {'request_id': payload['request_id']}
    if action == 'scan':
        if site['outcome'] == 'absent':
            return dict(result, status='not_found')
        return dict(result, status='found', listing_url=f"https://{site['domain']}/listing/demo",
                    match={'name': person['name'], 'email': person['email']})
    if action == 'submit':
        if site['outcome'] == 'id':
            return dict(result, status='id_required')
        return dict(result, status='awaiting_confirmation' if site['outcome'] == 'email' else 'requested',
                    route_verified=True, confirmation_ref=payload['request_id'])
    if action == 'confirm':
        return dict(result, status='confirmed', authenticated=True, sender_domain=site['domain'],
                    received_at=payload['submitted_at'], confirmation_url=f"https://{site['domain']}/confirm/demo",
                    purpose='removal')
    if action == 'check':
        return dict(result, status='removed', verified_absent=True)
    return dict(result, status='requested', route_verified=True)
