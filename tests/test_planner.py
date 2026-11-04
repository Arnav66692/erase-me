from __future__ import annotations

import copy
import json

import pytest

from erase_me import jurisdiction, planner, profile, sites
from conftest import FIXTURE_SKILL_DIR

REFS = FIXTURE_SKILL_DIR / "references"
NOW = "2026-10-25T10:00:00-07:00"


@pytest.fixture
def person():
    return profile.build_profile("zelda", "Zelda Quuxington", "ZZ", region="ZZ-TV", cities=["Testville"])


def make_plan(person):
    return planner.plan_items(person, REFS, now=NOW)


def test_order_specials_then_global_then_country(person):
    items = make_plan(person)
    assert [i["item_id"] for i in items] == [
        "zz-drop", "example-search", "example-callerid", "mailer", "peoplefind", "oldbook", "peoplefind-lite",
    ]


def test_special_channel_item(person):
    special = make_plan(person)[0]
    assert special["source"] == "jurisdiction"
    assert special["channel"] == "drop"
    assert special["regime"] == "zz-tpa"
    assert special["status"] == "planned"


def test_site_items_carry_primary_regime_and_channel(person):
    items = {i["item_id"]: i for i in make_plan(person)}
    assert items["peoplefind"]["regime"] == "zz-tpa"
    assert items["peoplefind"]["channel"] == "web_form"
    assert items["peoplefind"]["source"] == "countries/zz"
    assert items["example-search"]["source"] == "global"
    assert items["oldbook"]["channel"] == "email"


def test_covered_child_skipped_after_parent(person):
    items = make_plan(person)
    ids = [i["item_id"] for i in items]
    assert ids.index("peoplefind") < ids.index("peoplefind-lite")
    child = items[ids.index("peoplefind-lite")]
    assert child["status"] == "skipped"
    assert "PeopleFind Testland" in child["history"][0]["note"]


def test_not_in_force_regime_adds_no_special_channel():
    other = profile.build_profile("ana", "Ana Example", "ZY")
    items = planner.plan_items(other, REFS, now=NOW)
    assert all(i["item_id"] != "zy-portal" for i in items)
    assert all(i["regime"] is None for i in items)


def test_global_site_country_filter(tmp_path):
    refs = tmp_path / "references"
    (refs / "global").mkdir(parents=True)
    site = {"id": "uk-only", "name": "UK Only", "countries": ["GB"], "priority": 1, "covers": [], "optout": {"method": "web_form"}}
    (refs / "global" / "uk-only.json").write_text(json.dumps(site))
    person = profile.build_profile("ana", "Ana Example", "ZZ")
    assert planner.plan_items(person, refs, now=NOW) == []


def test_parent_with_lower_priority_still_covers():
    parent = {"id": "parent", "name": "Parent", "priority": 3, "covers": ["child"], "optout": {"method": "web_form"}}
    child = {"id": "child", "name": "Child", "priority": 1, "covers": [], "optout": {"method": "web_form"}}
    ordered = planner.order_sites([("countries/zz", child), ("countries/zz", parent)])
    assert [(s["id"], parent_name) for _, s, parent_name in ordered] == [("parent", None), ("child", "Parent")]


def test_coverage_cycle_keeps_one_active():
    a = {"id": "a", "name": "A", "priority": 1, "covers": ["b"]}
    b = {"id": "b", "name": "B", "priority": 1, "covers": ["a"]}
    ordered = planner.order_sites([("global", a), ("global", b)])
    active = [s["id"] for _, s, parent in ordered if parent is None]
    assert len(active) >= 1


def test_duplicate_site_ids_dropped(tmp_path):
    refs = tmp_path / "references"
    (refs / "global").mkdir(parents=True)
    (refs / "countries" / "zz").mkdir(parents=True)
    site = {"id": "dup", "name": "Dup", "countries": [], "priority": 1, "covers": [], "optout": {"method": "web_form"}}
    (refs / "global" / "dup.json").write_text(json.dumps(site))
    (refs / "countries" / "zz" / "dup.json").write_text(json.dumps(site))
    person = profile.build_profile("ana", "Ana Example", "ZZ")
    items = planner.plan_items(person, refs, now=NOW)
    assert [i["item_id"] for i in items] == ["dup"]
    assert items[0]["source"] == "global"


def test_invalid_site_ids_are_slugged_or_dropped(tmp_path):
    refs = tmp_path / "references"
    (refs / "global").mkdir(parents=True)
    for name, site_id in (("a.json", "Bad Id"), ("b.json", "!!!")):
        site = {"id": site_id, "name": site_id, "countries": [], "priority": 1, "covers": [], "optout": {"method": "web_form"}}
        (refs / "global" / name).write_text(json.dumps(site))
    person = profile.build_profile("ana", "Ana Example", "ZZ")
    assert [i["item_id"] for i in planner.plan_items(person, refs, now=NOW)] == ["bad-id"]


def test_plan_does_not_mutate_inputs(person):
    snapshot = copy.deepcopy(person)
    make_plan(person)
    assert person == snapshot


@pytest.mark.parametrize(
    "channel, expected",
    [({"id": "ca-drop"}, "drop"), ({"id": "drop"}, "drop"), ({"id": "qc-portal"}, "web_form"),
     ({"id": "qc-portal", "channel": "email"}, "email")],
)
def test_special_channel_default(channel, expected):
    regime = {"code": "zz-x", "status": "in_force", "special_channels": [dict(channel, name="X", url="https://x.example")]}
    assert planner._special_items([regime], NOW)[0]["channel"] == expected
