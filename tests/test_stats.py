from __future__ import annotations

import datetime as dt

from erase_me import ledger, stats

NOW = "2026-10-01T10:00:00-07:00"
T = dt.date(2026, 10, 1)


def build():
    items = [ledger.new_item(f"site-{n}", f"site-{n}", "global", "web_form", None, now=NOW) for n in range(6)]
    data = ledger.new_ledger("zelda", items)
    data = ledger.transition(data, "site-0", "found", now=NOW, today=T)
    data = ledger.transition(data, "site-0", "requested", now=NOW, today=T)
    data = ledger.transition(data, "site-0", "removed", now=NOW, today=T)
    data = ledger.transition(data, "site-1", "found", now=NOW, today=T)
    data = ledger.transition(data, "site-1", "requested", now=NOW, today=T)
    data = ledger.transition(data, "site-2", "not_found", now=NOW, today=T)
    data = ledger.transition(data, "site-3", "requested", now=NOW, today=T)
    data = ledger.transition(data, "site-3", "removed", now=NOW, today=T)
    data = ledger.transition(data, "site-4", "skipped", now=NOW, today=T)
    return data


def test_counts():
    result = stats.compute(build(), dt.date(2026, 10, 31))
    assert result["total"] == 6
    assert result["sites_checked"] == 4
    assert result["found"] == 3
    assert result["requested"] == 3
    assert result["removed"] == 2
    assert result["relisted"] == 0
    assert result["removal_rate"] == "67%"
    assert result["removal_rate_value"] == 0.6667
    assert result["days_since_start"] == 30
    assert result["by_status"]["planned"] == 1
    assert result["by_status"]["skipped"] == 1


def test_relisted_counts_as_ever():
    data = ledger.transition(build(), "site-0", "relisted", now=NOW, today=T)
    data = ledger.transition(data, "site-0", "removed", now=NOW, today=T)
    result = stats.compute(data, T)
    assert result["relisted"] == 1
    assert result["removed"] == 2


def test_empty_ledger():
    result = stats.compute({"person_id": "zelda", "items": []}, T)
    assert result["removal_rate"] == "n/a"
    assert result["removal_rate_value"] is None
    assert result["days_since_start"] == 0
    assert result["found"] == 0


def test_rate_rounding():
    items = [ledger.new_item(f"s-{n}", f"s-{n}", "global", "web_form", None, now=NOW) for n in range(3)]
    data = ledger.new_ledger("zelda", items)
    for n in range(3):
        data = ledger.transition(data, f"s-{n}", "found", now=NOW, today=T)
    data = ledger.transition(data, "s-0", "removed", now=NOW, today=T)
    data = ledger.transition(data, "s-1", "removed", now=NOW, today=T)
    assert stats.compute(data, T)["removal_rate"] == "67%"
