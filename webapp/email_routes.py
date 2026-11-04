"""Archived email channels; automatic email sending is disabled.

Policies inspected 2026-10-28. Accepting email requests does not establish that
the broker holds a record or that email ownership satisfies its verification.
"""
from __future__ import annotations

import copy
import os
import re

from . import adapters, auth

_ROUTES = (
    {'id': 'peopledatalabs-email', 'name': 'People Data Labs', 'domain': 'peopledatalabs.com',
     'email': 'privacy@peopledatalabs.com',
     'source': 'https://privacy.peopledatalabs.com/policies?name=privacy-policy',
     'policy_section': '10A', 'verified_at': '2026-10-28', 'enabled': False},
    {'id': 'apollo-email', 'name': 'Apollo', 'domain': 'apollo.io',
     'email': 'privacy@apollo.io',
     'source': 'https://www.apollo.io/privacy-policy#section_5_your_choices',
     'policy_section': '5', 'verified_at': '2026-10-28', 'enabled': False,
     'disabled_reason': 'The published email route rejected a live request. Use the official removal portal.'},
)


def plans() -> list[dict]:
    return [dict(copy.deepcopy(route), category='data_broker', search_urls=[], search_missing=[],
                 optout_url=None, method='email', discovery='own_email', fields_needed=['full_name', 'email'],
                 requires=[], verified=True, expected_days=None, regime=None) for route in _ROUTES]


def handles(site: dict) -> bool:
    return site.get('discovery') == 'own_email' or any(site.get('id') == route['id'] for route in _ROUTES)


def valid_route(site: dict) -> bool:
    """Persisted/custom metadata cannot redirect a self-request to another inbox."""
    return any(site.get('id') == route['id'] and site.get('domain') == route['domain']
               and site.get('email') == route['email'] and site.get('method') == 'email'
               and site.get('discovery') == 'own_email' and site.get('verified') is True
               for route in _ROUTES)


def send_enabled(site: dict) -> bool:
    return valid_route(site) and any(route['id'] == site['id'] and route['enabled'] for route in _ROUTES)


def own_mailbox(user: dict, request_id: str) -> str | None:
    """Only a subject's explicitly configured mailbox can send a self-request."""
    address = user.get('email')
    if (user.get('verified') != 1 or not user.get('authorized_at') or user.get('status') != 'active'
            or not isinstance(address, str) or not auth.email_configured()):
        return None
    if any(os.getenv(key, '').strip().casefold() != address.casefold()
           for key in ('ERASE_SMTP_FROM', 'ERASE_REMOVAL_INBOX')):
        return None
    return adapters.confirmation_address(request_id)


def request_letter(user: dict, site: dict, request_id: str) -> tuple[str, str]:
    if not valid_route(site) or not re.fullmatch(r'[a-f0-9]{32}', request_id):
        raise ValueError('Unsupported own-email request route or reference.')
    name, address = user['name'], user['email']
    body = (
        f"Hello {site['name']} privacy team,\n\n"
        f"I am {name}, sending this request from my own email address, {address}.\n\n"
        "Please delete any personal information you hold associated with this email address and my name, "
        "and opt me out of the sale or sharing of that information. Please keep only the minimum "
        "suppression information needed to honor this request.\n\n"
        "Please confirm whether you have identified matching records and when deletion and suppression "
        "are complete. If more information is needed to locate my records or verify this request, "
        "please reply with the minimum information required.\n\n"
        f"Thank you,\n{name}\n\nRequest reference: {request_id}\n"
        "Sent with my authorization using Erase Me. No identity documents are attached.\n"
    )
    return f'Personal information deletion and opt-out request [Erase Me {request_id}]', body
