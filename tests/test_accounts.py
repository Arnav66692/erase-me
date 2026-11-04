from __future__ import annotations

import pytest

from erase_me import accounts
from erase_me.errors import UsageError
from conftest import FIXTURE_SKILL_DIR

REFS = FIXTURE_SKILL_DIR / "references"


def test_load_and_list_all():
    data = accounts.load_accounts(REFS)
    assert data["attribution"] == "JustDeleteMe contributors"
    assert [s["name"] for s in accounts.search(data, None)] == ["Example Forum", "Example Shop", "Example Social"]


def test_search_by_name_and_domain():
    data = accounts.load_accounts(REFS)
    assert [s["name"] for s in accounts.search(data, "SHOP")] == ["Example Shop"]
    assert [s["name"] for s in accounts.search(data, "shop.example.net")] == ["Example Shop"]
    assert accounts.search(data, "zzz") == []


def test_limit():
    data = accounts.load_accounts(REFS)
    assert len(accounts.search(data, "example", limit=2)) == 2


def test_missing_file(tmp_path):
    with pytest.raises(UsageError):
        accounts.load_accounts(tmp_path)
