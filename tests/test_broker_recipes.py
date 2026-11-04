"""Guard the boundary between inspected form drafts and working live recipes.

Fixtures reconstruct observed DOM structure with synthetic content. These tests
do not contact brokers and cannot demonstrate an actual request or removal.
"""
from html.parser import HTMLParser
import json
from pathlib import Path
from urllib.parse import urljoin

import pytest

from browser_adapter import allowed, execute


ROOT = Path(__file__).resolve().parents[1]
RECIPES = json.loads((ROOT / 'config/broker-recipes.json').read_text())


class FormInventory(HTMLParser):
    def __init__(self, html):
        super().__init__()
        self.elements = []
        self.feed(html)

    def handle_starttag(self, tag, attrs):
        self.elements.append((tag, dict(attrs)))

    def by_id(self, selector):
        assert selector.startswith('#'), selector
        found = [(tag, attrs) for tag, attrs in self.elements
                 if attrs.get('id') == selector[1:]]
        assert len(found) == 1, selector
        return found[0]


@pytest.mark.parametrize('site_id', RECIPES)
@pytest.mark.parametrize('action', ['scan', 'submit', 'confirm', 'check', 'followup'])
def test_inspected_drafts_cannot_perform_browser_actions(site_id, action):
    class NoBrowser:
        def __getattr__(self, name):
            pytest.fail(f'Disabled draft attempted browser operation: {name}')

    recipe = RECIPES[site_id]
    payload = {
        'site': {'id': site_id, 'domain': recipe['domain'],
                 'optout_url': recipe['optout_url']},
        'action': action,
    }
    assert execute(payload, RECIPES, NoBrowser()) == {'status': 'unsupported'}


@pytest.mark.parametrize('site_id', RECIPES)
def test_draft_evidence_does_not_claim_live_removal(site_id):
    recipe = RECIPES[site_id]
    verification = recipe['verification']
    assert recipe['enabled'] is False
    assert recipe['supported_actions'] == []
    assert verification['inspected'] is True
    assert verification['fixture_tested'] is True
    assert verification['live_submitted'] is False
    assert verification['removal_verified'] is False
    assert recipe['blockers']
    for unobserved in ('name', 'age', 'city', 'listing_links', 'absent', 'success',
                       'confirmation_path_prefix', 'confirmation_success'):
        assert unobserved not in recipe, f'{site_id}: invented {unobserved}'


@pytest.mark.parametrize('site_id', RECIPES)
def test_observed_form_fields_and_action_have_fixture_evidence(site_id):
    recipe = RECIPES[site_id]
    form = recipe['observed_form']
    fixture = (ROOT / recipe['verification']['fixture']).read_text()
    inventory = FormInventory(fixture)
    forms = [attrs for tag, attrs in inventory.elements if tag == 'form']
    assert len(forms) == 1
    assert urljoin(recipe['optout_url'], forms[0].get('action', '')) == form['action']
    assert forms[0].get('method', 'GET').upper() == form['method']
    assert allowed(form['action'], recipe['domain'])
    assert allowed(recipe['optout_url'], recipe['domain'])
    for field, selector in recipe['fields'].items():
        tag, attrs = inventory.by_id(selector)
        assert tag == 'input'
        assert attrs['type'] == ('email' if field == 'email' else 'text')
        assert not attrs.get('value'), 'Fixtures must not contain a real profile'
    for selector in form['required_checkboxes']:
        tag, attrs = inventory.by_id(selector)
        assert tag == 'input' and attrs['type'] == 'checkbox'
    assert not any(tag == 'script' for tag, _ in inventory.elements)
    assert not any('data-sitekey' in attrs for _, attrs in inventory.elements)
    assert not any(attrs.get('name') == '_token' for _, attrs in inventory.elements)


def test_preexisting_hidden_success_is_not_promoted_to_live_evidence():
    recipe = RECIPES['searchpeoplefree']
    fixture = (ROOT / recipe['verification']['fixture']).read_text()
    inventory = FormInventory(fixture)
    for selector in recipe['observed_form']['hidden_before_submission']:
        _, attrs = inventory.by_id(selector)
        assert 'd-none' in attrs['class'].split()
    assert '.d-none { display: none; }' in fixture
    assert 'success' not in recipe


def test_search_empty_evidence_is_never_listing_removal_evidence():
    recipe = RECIPES['usphonebook']
    observed = recipe['observed_search']
    assert observed['http_status'] == 404
    inventory = FormInventory((ROOT / observed['fixture']).read_text())
    assert any('no-results-content-wrapper' in attrs.get('class', '').split()
               for _, attrs in inventory.elements)
    assert 'absent' not in recipe
    assert recipe['verification']['removal_verified'] is False
