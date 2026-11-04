from __future__ import annotations

import datetime as dt

from erase_me import catalog, ledger, tasks
from conftest import FIXTURE_SKILL_DIR

REFS = FIXTURE_SKILL_DIR / "references"
NOW = "2026-10-25T10:00:00-07:00"
T = dt.date(2026, 10, 25)


def build():
    items = [
        ledger.new_item("zz-drop", "zz-drop", "jurisdiction", "drop", "zz-tpa", now=NOW),
        ledger.new_item("peoplefind", "peoplefind", "countries/zz", "web_form", "zz-tpa", now=NOW),
        ledger.new_item("oldbook", "oldbook", "countries/zz", "email", "zz-tpa", now=NOW),
        ledger.new_item("example-callerid", "example-callerid", "global", "in_app", None, now=NOW),
        ledger.new_item("mailer", "mailer", "countries/zz", "postal", None, now=NOW),
        ledger.new_item("example-search", "example-search", "global", "search_removal", None, now=NOW),
    ]
    data = ledger.new_ledger("zelda", items)
    data = ledger.transition(data, "peoplefind", "found", now=NOW, today=T)
    data = ledger.transition(data, "oldbook", "needs_human", note="Asked for ID", now=NOW, today=T)
    data = ledger.transition(data, "example-callerid", "found", now=NOW, today=T)
    data = ledger.transition(data, "mailer", "blocked", now=NOW, today=T)
    return data


def groups_by_name(result):
    return {g["requirement"]: [i["item_id"] for i in g["items"]] for g in result["groups"]}


def test_digest_groups():
    result = tasks.digest(build(), catalog.load_catalog(REFS, "ZZ"))
    groups = groups_by_name(result)
    assert list(groups) == ["needs_human", "captcha", "email_verification", "id_upload", "phone_call", "app_install"]
    assert groups["needs_human"] == ["oldbook"]
    assert groups["captcha"] == ["peoplefind", "mailer"]
    assert groups["email_verification"] == ["peoplefind"]
    assert groups["id_upload"] == ["oldbook"]
    assert groups["phone_call"] == ["example-callerid"]
    assert groups["app_install"] == ["example-callerid"]
    assert result["total_items"] == 4


def test_digest_entry_shape():
    result = tasks.digest(build(), catalog.load_catalog(REFS, "ZZ"))
    needs = result["groups"][0]
    assert needs["label"]
    entry = needs["items"][0]
    assert entry["name"] == "OldBook Directory"
    assert entry["status"] == "needs_human"
    assert entry["last_note_untrusted"] == "Asked for ID"
    blocked = next(i for i in result["groups"][1]["items"] if i["item_id"] == "mailer")
    assert "blocked" in blocked["reason"]


def test_digest_empty():
    result = tasks.digest({"person_id": "zelda", "items": []}, catalog.load_catalog(REFS, "ZZ"))
    assert result == {"groups": [], "upcoming": [], "total_items": 0, "upcoming_items": 0}


def test_planned_special_channel_listed_when_it_needs_people():
    data = ledger.new_ledger("zelda", [ledger.new_item("zz-drop", "zz-drop", "jurisdiction", "drop", "zz-tpa", now=NOW)])
    cat = catalog.load_catalog(REFS, "ZZ")
    cat["specials"]["zz-drop"]["channel"] = dict(cat["specials"]["zz-drop"]["channel"], requires=["email_verification"])
    groups = groups_by_name(tasks.digest(data, cat))
    assert groups == {"email_verification": ["zz-drop"]}


def test_planned_items_are_listed_as_coming_up():
    result = tasks.digest(build(), catalog.load_catalog(REFS, "ZZ"))
    upcoming = groups_by_name({"groups": result["upcoming"]})
    assert upcoming == {"account": ["example-search"]}
    assert result["upcoming_items"] == 1
    assert "example-search" not in [i for g in result["groups"] for i in (e["item_id"] for e in g["items"])]


def test_only_upcoming_steps():
    items = [
        ledger.new_item("oldbook", "oldbook", "countries/zz", "email", "zz-tpa", now=NOW),
        ledger.new_item("example-callerid", "example-callerid", "global", "in_app", None, now=NOW),
        ledger.new_item("mailer", "mailer", "countries/zz", "postal", None, now=NOW),
    ]
    result = tasks.digest(ledger.new_ledger("zelda", items), catalog.load_catalog(REFS, "ZZ"))
    assert result["groups"] == []
    assert groups_by_name({"groups": result["upcoming"]}) == {
        "id_upload": ["oldbook"], "phone_call": ["example-callerid"], "app_install": ["example-callerid"],
    }
