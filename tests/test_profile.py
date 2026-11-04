from __future__ import annotations

import pytest

from erase_me import profile
from erase_me.errors import UsageError


def build(**overrides):
    args = dict(person_id="zelda", full_name="Zelda Quuxington", country="zz")
    args.update(overrides)
    return profile.build_profile(**args)


def test_minimal_profile_normalizes():
    record = build()
    assert record == {
        "person_id": "zelda",
        "full_name": "Zelda Quuxington",
        "name_variants": [],
        "country": "ZZ",
        "region": None,
        "cities": [],
        "age_range": None,
        "phones": [],
        "emails": [],
        "language": "en",
    }


def test_full_profile():
    record = build(
        region="zz-tv", cities=["Testville", "Oldtown"], age_range="30-39",
        phones=["+99 555 0142"], emails=["Zelda@Quux.example"], variants=["Z Quuxington", "Zelda Quuxington"],
        language="tr",
    )
    assert record["region"] == "ZZ-TV"
    assert record["cities"] == [
        {"city": "Testville", "region": "ZZ-TV", "country": "ZZ", "current": True},
        {"city": "Oldtown", "region": "ZZ-TV", "country": "ZZ", "current": False},
    ]
    assert record["emails"] == ["zelda@quux.example"]
    assert record["name_variants"] == ["Z Quuxington"]
    assert record["language"] == "tr"


@pytest.mark.parametrize(
    "overrides",
    [
        {"full_name": "  "},
        {"full_name": "x" * 201},
        {"full_name": "Bad\nName"},
        {"country": "USA"},
        {"country": "1Z"},
        {"region": "ZY-TV"},
        {"region": "ZZTV"},
        {"age_range": "old"},
        {"phones": ["12"]},
        {"phones": ["call me"]},
        {"emails": ["not-an-email"]},
        {"language": "english!"},
        {"cities": [" "]},
        {"variants": ["Bad\tName"]},
    ],
)
def test_invalid_fields_rejected(overrides):
    with pytest.raises(UsageError):
        build(**overrides)


@pytest.mark.parametrize("age", ["30-39", "80+", "5-9"])
def test_age_ranges(age):
    assert build(age_range=age)["age_range"] == age


def test_name_parts():
    assert profile.name_parts(build()) == ("Zelda", "Quuxington")
    assert profile.name_parts(build(full_name="Cher")) == ("Cher", "")
    assert profile.name_parts(build(full_name="Ana Maria de Souza")) == ("Ana", "Souza")


def test_current_city():
    assert profile.current_city(build()) is None
    record = build(cities=["Testville", "Oldtown"])
    assert profile.current_city(record)["city"] == "Testville"


def test_save_and_load(home):
    record = build()
    profile.save_profile(record)
    assert profile.load_profile("zelda") == record


def test_load_missing_profile_is_usage_error(home):
    with pytest.raises(UsageError) as info:
        profile.load_profile("zelda")
    assert "intake" in str(info.value)
