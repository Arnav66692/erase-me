from __future__ import annotations

import datetime as dt

import pytest

from erase_me import deadlines, ledger

D = dt.date
NOW = "2026-10-25T10:00:00-07:00"


@pytest.mark.parametrize(
    "start, expected",
    [
        (D(2026, 1, 31), D(2026, 2, 28)),
        (D(2028, 1, 31), D(2028, 2, 29)),
        (D(2026, 10, 25), D(2026, 11, 25)),
        (D(2026, 12, 15), D(2027, 1, 15)),
        (D(2026, 3, 31), D(2026, 4, 30)),
    ],
)
def test_add_calendar_month(start, expected):
    assert deadlines.add_months(start, 1) == expected


def test_add_months_many():
    assert deadlines.add_months(D(2026, 11, 30), 3) == D(2027, 2, 28)


def test_add_business_days_skips_weekends():
    friday = D(2026, 10, 23)
    assert deadlines.add_business_days(friday, 1) == D(2026, 10, 26)
    assert deadlines.add_business_days(friday, 10) == D(2026, 11, 6)
    saturday = D(2026, 10, 24)
    assert deadlines.add_business_days(saturday, 1) == D(2026, 10, 26)
    assert deadlines.add_business_days(friday, 0) == friday


def test_compute_due_one_month():
    rule = {"days": 30, "day_type": "calendar", "basis": "one_month", "extension_days": 60}
    assert deadlines.compute_due(D(2026, 1, 31), rule) == D(2026, 2, 28)


def test_compute_due_calendar_days():
    rule = {"days": 45, "day_type": "calendar", "basis": "days"}
    assert deadlines.compute_due(D(2026, 10, 25), rule) == D(2026, 12, 9)


def test_compute_due_business_days():
    rule = {"days": 10, "day_type": "business", "basis": "days"}
    assert deadlines.compute_due(D(2026, 10, 23), rule) == D(2026, 11, 6)


def test_compute_due_fallback():
    assert deadlines.compute_due(D(2026, 10, 25), None) == D(2026, 11, 24)
    assert deadlines.compute_due(D(2026, 10, 25), None, fallback_days=7) == D(2026, 11, 1)
    assert deadlines.compute_due(D(2026, 10, 25), {"days": "x"}) == D(2026, 11, 24)


def test_extended_due():
    assert deadlines.extended_due(D(2026, 11, 25), {"extension_days": 60}) == D(2027, 1, 24)
    assert deadlines.extended_due(D(2026, 11, 25), {"extension_days": 0}) is None
    assert deadlines.extended_due(D(2026, 11, 25), {"extension_days": None}) is None
    assert deadlines.extended_due(D(2026, 11, 25), None) is None


def requested_ledger(regime="zz-tpa", requested_on="2026-10-25", due_on="2026-11-25"):
    item = ledger.new_item("peoplefind", "peoplefind", "countries/zz", "web_form", regime, now=NOW)
    item = dict(item, status="requested", requested_on=requested_on, due_on=due_on)
    other = ledger.new_item("oldbook", "oldbook", "countries/zz", "email", regime, now=NOW)
    return ledger.new_ledger("zelda", [item, other])


REGIMES = {
    "zz-tpa": {
        "code": "zz-tpa",
        "deadline": {"days": 30, "day_type": "calendar", "basis": "one_month", "extension_days": 60},
        "regulators": [{"country": "ZZ"}],
    },
    "zz-open": {
        "code": "zz-open",
        "deadline": {"days": None, "day_type": "calendar", "basis": "days", "extension_days": None},
        "regulators": [{"country": "ZZ"}],
    },
}


def test_overdue_none_before_due():
    assert deadlines.overdue(requested_ledger(), REGIMES, D(2026, 11, 25)) == []


def test_overdue_followup_inside_extension():
    rows = deadlines.overdue(requested_ledger(), REGIMES, D(2026, 11, 26))
    assert rows == [{
        "item_id": "peoplefind",
        "site_id": "peoplefind",
        "regime": "zz-tpa",
        "requested_on": "2026-10-25",
        "due_on": "2026-11-25",
        "extended_due_on": "2027-01-25",
        "days_overdue": 1,
        "next_kind": "followup",
        "statutory": True,
    }]


def test_overdue_complaint_after_extension():
    assert deadlines.overdue(requested_ledger(), REGIMES, D(2027, 1, 25))[0]["next_kind"] == "followup"
    rows = deadlines.overdue(requested_ledger(), REGIMES, D(2027, 1, 26))
    assert rows[0]["next_kind"] == "complaint"


def test_overdue_without_regime_suggests_followup():
    rows = deadlines.overdue(requested_ledger(regime=None), REGIMES, D(2027, 6, 1))
    assert rows[0]["next_kind"] == "followup"


def test_overdue_ignores_items_without_due():
    rows = deadlines.overdue(requested_ledger(due_on=None), REGIMES, D(2027, 6, 1))
    assert rows == []


@pytest.mark.parametrize(
    "rule, expected",
    [
        ({"days": 30, "basis": "days"}, True),
        ({"days": None, "basis": "one_month"}, True),
        ({"days": None, "basis": "days"}, False),
        ({"basis": "days"}, False),
        (None, False),
    ],
)
def test_is_statutory(rule, expected):
    assert deadlines.is_statutory(rule) is expected


def test_null_deadline_uses_named_followup_constant():
    rule = {"days": None, "day_type": "calendar", "basis": "days"}
    assert deadlines.NO_FIXED_DEADLINE_FOLLOWUP_DAYS == 30
    assert deadlines.compute_due(D(2026, 10, 25), rule, fallback_days=7) == D(2026, 11, 24)


def test_null_deadline_overdue_is_not_statutory_and_never_suggests_complaint():
    rows = deadlines.overdue(requested_ledger(regime="zz-open"), REGIMES, D(2028, 1, 1))
    assert rows[0]["statutory"] is False
    assert rows[0]["next_kind"] == "followup"
    assert rows[0]["extended_due_on"] is None


def test_no_regime_overdue_is_not_statutory():
    rows = deadlines.overdue(requested_ledger(regime=None), REGIMES, D(2027, 6, 1))
    assert rows[0]["statutory"] is False
