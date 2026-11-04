from __future__ import annotations

import datetime as dt
import json

import pytest

from erase_me import ledger
from erase_me.errors import RefusalError, UsageError

NOW = "2026-10-25T10:00:00-07:00"
TODAY = dt.date(2026, 10, 25)


def sample():
    items = [
        ledger.new_item("peoplefind", "peoplefind", "countries/zz", "web_form", "zz-tpa", now=NOW),
        ledger.new_item("zz-drop", "zz-drop", "jurisdiction", "drop", "zz-tpa", now=NOW),
    ]
    return ledger.new_ledger("zelda", items)


def test_new_item_shape():
    item = sample()["items"][0]
    assert item == {
        "item_id": "peoplefind",
        "site_id": "peoplefind",
        "source": "countries/zz",
        "channel": "web_form",
        "regime": "zz-tpa",
        "status": "planned",
        "evidence_urls": [],
        "requested_on": None,
        "first_requested_on": None,
        "due_on": None,
        "removed_on": None,
        "history": [{"at": NOW, "status": "planned", "note": ""}],
    }


def test_new_item_rejects_bad_status_and_id():
    with pytest.raises(UsageError):
        ledger.new_item("x", "x", "global", "web_form", None, status="gone", now=NOW)
    with pytest.raises(RefusalError):
        ledger.new_item("../x", "x", "global", "web_form", None, now=NOW)


def test_all_statuses_have_transition_rules():
    assert set(ledger.TRANSITIONS) == set(ledger.STATUSES)
    for targets in ledger.TRANSITIONS.values():
        assert set(targets) <= set(ledger.STATUSES)


@pytest.mark.parametrize(
    "old, new, allowed",
    [
        ("planned", "found", True),
        ("planned", "requested", True),
        ("planned", "removed", False),
        ("found", "requested", True),
        ("requested", "removed", True),
        ("requested", "planned", False),
        ("removed", "relisted", True),
        ("removed", "found", False),
        ("relisted", "requested", True),
        ("skipped", "planned", True),
        ("not_found", "found", True),
        ("rejected", "requested", True),
    ],
)
def test_can_transition(old, new, allowed):
    assert ledger.can_transition(old, new) is allowed


def test_transition_returns_new_ledger_and_keeps_original():
    original = sample()
    snapshot = json.dumps(original, sort_keys=True)
    updated = ledger.transition(
        original, "peoplefind", "found", evidence="https://peoplefind.example.com/p/1", note="match", now=NOW, today=TODAY
    )
    assert json.dumps(original, sort_keys=True) == snapshot
    item = ledger.find_item(updated, "peoplefind")
    assert item["status"] == "found"
    assert item["evidence_urls"] == ["https://peoplefind.example.com/p/1"]
    assert item["history"][-1] == {"at": NOW, "status": "found", "note": "match"}


def test_requested_sets_dates():
    found = ledger.transition(sample(), "peoplefind", "found", now=NOW, today=TODAY)
    requested = ledger.transition(found, "peoplefind", "requested", now=NOW, today=TODAY, due_on=dt.date(2026, 11, 25))
    item = ledger.find_item(requested, "peoplefind")
    assert item["requested_on"] == "2026-10-25"
    assert item["due_on"] == "2026-11-25"
    removed = ledger.transition(requested, "peoplefind", "removed", now=NOW, today=dt.date(2026, 11, 1))
    assert ledger.find_item(removed, "peoplefind")["removed_on"] == "2026-11-01"


def test_illegal_transition_lists_allowed():
    with pytest.raises(UsageError) as info:
        ledger.transition(sample(), "peoplefind", "removed", now=NOW, today=TODAY)
    assert "found" in str(info.value)


def test_unknown_status_and_item():
    with pytest.raises(UsageError):
        ledger.transition(sample(), "peoplefind", "vanished", now=NOW, today=TODAY)
    with pytest.raises(UsageError):
        ledger.transition(sample(), "nope", "found", now=NOW, today=TODAY)
    with pytest.raises(RefusalError):
        ledger.transition(sample(), "../../consent", "found", now=NOW, today=TODAY)


def test_same_status_needs_new_info():
    found = ledger.transition(sample(), "peoplefind", "found", now=NOW, today=TODAY)
    with pytest.raises(UsageError):
        ledger.transition(found, "peoplefind", "found", now=NOW, today=TODAY)
    again = ledger.transition(found, "peoplefind", "found", evidence="https://peoplefind.example.com/p/2", now=NOW, today=TODAY)
    assert len(ledger.find_item(again, "peoplefind")["evidence_urls"]) == 1
    twice = ledger.transition(again, "peoplefind", "found", evidence="https://peoplefind.example.com/p/2", now=NOW, today=TODAY)
    assert ledger.find_item(twice, "peoplefind")["evidence_urls"] == ["https://peoplefind.example.com/p/2"]


@pytest.mark.parametrize("url", ["javascript:alert(1)", "ftp://x.example", "not a url", "https://", "http://a b.example"])
def test_bad_evidence_rejected(url):
    with pytest.raises(UsageError):
        ledger.transition(sample(), "peoplefind", "found", evidence=url, now=NOW, today=TODAY)


def test_note_is_cleaned_and_capped():
    raw = "line one\nline two\x00\x1b[31m" + "x" * 5000
    updated = ledger.transition(sample(), "peoplefind", "found", note=raw, now=NOW, today=TODAY)
    note = ledger.find_item(updated, "peoplefind")["history"][-1]["note"]
    assert note.startswith("line one line two[31m")
    assert "\x00" not in note and "\x1b" not in note
    assert len(note) == ledger.MAX_NOTE


def test_merge_keeps_existing_and_appends_new():
    existing = ledger.transition(sample(), "peoplefind", "found", now=NOW, today=TODAY)
    planned = [
        ledger.new_item("peoplefind", "peoplefind", "countries/zz", "web_form", "zz-tpa", now=NOW),
        ledger.new_item("oldbook", "oldbook", "countries/zz", "email", "zz-tpa", now=NOW),
    ]
    merged = ledger.merge_plan(existing, "zelda", planned)
    assert [i["item_id"] for i in merged["items"]] == ["peoplefind", "zz-drop", "oldbook"]
    assert ledger.find_item(merged, "peoplefind")["status"] == "found"
    assert ledger.merge_plan(None, "zelda", planned)["items"][0]["status"] == "planned"


def test_save_and_load(home):
    data = sample()
    ledger.save_ledger(data)
    assert ledger.load_ledger("zelda") == data


def test_load_missing_says_run_plan(home):
    with pytest.raises(UsageError) as info:
        ledger.load_ledger("zelda")
    assert "plan" in str(info.value)


def test_load_rejects_bad_item_ids(home):
    from erase_me import paths, storage
    paths.ensure_person_dir("zelda")
    bad = {"person_id": "zelda", "items": [{"item_id": "../x", "status": "planned"}]}
    storage.write_json_private(paths.ledger_path("zelda"), bad)
    with pytest.raises(RefusalError):
        ledger.load_ledger("zelda")
