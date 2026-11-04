from __future__ import annotations

from erase_me import catalog, ledger
from conftest import FIXTURE_SKILL_DIR

REFS = FIXTURE_SKILL_DIR / "references"
NOW = "2026-10-25T10:00:00-07:00"


def test_describe_site_item():
    cat = catalog.load_catalog(REFS, "ZZ")
    item = ledger.new_item("peoplefind", "peoplefind", "countries/zz", "web_form", "zz-tpa", now=NOW)
    info = catalog.describe(cat, item)
    assert info["name"] == "PeopleFind Testland"
    assert info["category"] == "people_search"
    assert info["optout_url"] == "https://peoplefind.example.com/optout"
    assert info["method"] == "web_form"
    assert info["requires"] == ["email_verification", "captcha", "listing_url"]
    assert info["steps"][0] == "Open the opt-out page."
    assert info["verified"] is True


def test_describe_special_item():
    cat = catalog.load_catalog(REFS, "ZZ")
    item = ledger.new_item("zz-drop", "zz-drop", "jurisdiction", "drop", "zz-tpa", now=NOW)
    info = catalog.describe(cat, item)
    assert info["name"] == "Testland Deletion Portal"
    assert info["category"] == "legal_channel"
    assert info["optout_url"] == "https://drop.example.org/start"
    assert info["method"] == "drop"
    assert info["regime_name"] == "Testland Privacy Act 2020"


def test_describe_unknown_item_is_safe():
    cat = catalog.load_catalog(REFS, "ZZ")
    item = ledger.new_item("gone", "gone", "global", "web_form", None, now=NOW)
    info = catalog.describe(cat, item)
    assert info["name"] == "gone"
    assert info["category"] == "unknown"
    assert info["requires"] == []
