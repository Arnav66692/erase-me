"""Observed broker portal initiation, distinct from completed deletion requests."""
import copy

PDL = {
    'id': 'peopledatalabs-form', 'name': 'People Data Labs',
    'domain': 'privacy.peopledatalabs.com', 'category': 'data_broker',
    'search_urls': [], 'search_missing': [],
    'optout_url': 'https://privacy.peopledatalabs.com/policies?action=ERASURE&modal=log-in',
    'email': None, 'method': 'web_form', 'discovery': 'privacy_portal',
    'fields_needed': ['email'], 'requires': ['user_broker_verification'],
    'verified': True, 'expected_days': None, 'regime': None,
}


def plans():
    return [copy.deepcopy(PDL)]


def handles(site):
    return site.get('id') == PDL['id'] or site.get('discovery') == 'privacy_portal'


def valid(site):
    return all(site.get(key) == PDL[key] for key in
               ('id', 'domain', 'optout_url', 'method', 'discovery', 'fields_needed'))
