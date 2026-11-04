from __future__ import annotations

import copy
import json

import pytest

from erase_me import jurisdiction
from erase_me.errors import UsageError
from conftest import FIXTURE_SKILL_DIR

REFS = FIXTURE_SKILL_DIR / "references"


@pytest.fixture
def regimes():
    return jurisdiction.load_regimes(REFS)


def by_code(regimes, code):
    return next(r for r in regimes if r["code"] == code)


def test_load_all_sorted(regimes):
    assert [r["code"] for r in regimes] == ["zy-npa", "zz-tpa", "zz-tv-rpa"]


def test_load_missing_dir_returns_empty(tmp_path):
    assert jurisdiction.load_regimes(tmp_path) == []


def test_load_invalid_json_is_friendly(tmp_path):
    folder = tmp_path / "jurisdictions"
    folder.mkdir()
    (folder / "bad.json").write_text("{")
    with pytest.raises(UsageError) as info:
        jurisdiction.load_regimes(tmp_path)
    assert "bad.json" in str(info.value)


def test_match_by_country_and_region(regimes):
    matched = jurisdiction.match_regimes(regimes, "ZZ", "ZZ-TV")
    assert [r["code"] for r in matched] == ["zz-tv-rpa", "zz-tpa"]


def test_match_by_country_only(regimes):
    assert [r["code"] for r in jurisdiction.match_regimes(regimes, "ZZ", None)] == ["zz-tpa"]


def test_match_nothing(regimes):
    assert jurisdiction.match_regimes(regimes, "QQ", None) == []


def test_regulator_prefers_region_then_country_then_star(regimes):
    tpa = by_code(regimes, "zz-tpa")
    assert jurisdiction.pick_regulator(tpa, "ZZ", "ZZ-TV")["name"] == "Testville Data Office"
    assert jurisdiction.pick_regulator(tpa, "ZZ", "ZZ-XX")["name"] == "Testland Privacy Authority"
    assert jurisdiction.pick_regulator(tpa, "ZZ", None)["name"] == "Testland Privacy Authority"
    assert jurisdiction.pick_regulator(tpa, "QQ", None)["name"] == "Fallback Privacy Board"


def test_regulator_none_when_no_entry(regimes):
    npa = by_code(regimes, "zy-npa")
    assert jurisdiction.pick_regulator(npa, "QQ", None) is None


def test_warnings(regimes):
    assert jurisdiction.regime_warnings(by_code(regimes, "zz-tpa")) == []
    rpa = jurisdiction.regime_warnings(by_code(regimes, "zz-tv-rpa"))
    assert any("not verified" in w.lower() for w in rpa)
    assert any("partly" in w.lower() for w in rpa)
    npa = jurisdiction.regime_warnings(by_code(regimes, "zy-npa"))
    assert any("not in force" in w.lower() for w in npa)


def test_usable_for_requests(regimes):
    assert jurisdiction.usable_for_requests(by_code(regimes, "zz-tpa"))
    assert jurisdiction.usable_for_requests(by_code(regimes, "zz-tv-rpa"))
    assert not jurisdiction.usable_for_requests(by_code(regimes, "zy-npa"))


def test_primary_regime_prefers_verified_then_region(regimes):
    matched = jurisdiction.match_regimes(regimes, "ZZ", "ZZ-TV")
    assert jurisdiction.primary_regime(matched, "ZZ-TV")["code"] == "zz-tpa"
    assert jurisdiction.primary_regime([], "ZZ-TV") is None
    npa_only = [by_code(regimes, "zy-npa")]
    assert jurisdiction.primary_regime(npa_only, None) is None


def test_primary_regime_region_breaks_tie(regimes):
    tpa = by_code(regimes, "zz-tpa")
    regional = dict(copy.deepcopy(by_code(regimes, "zz-tv-rpa")), verified=True)
    assert jurisdiction.primary_regime([tpa, regional], "ZZ-TV")["code"] == "zz-tv-rpa"


def test_right_citation(regimes):
    tpa = by_code(regimes, "zz-tpa")
    assert jurisdiction.right_citation(tpa, "erasure") == "s. 17"
    assert jurisdiction.right_citation(tpa, "delisting") is None


def test_summary_shape(regimes):
    tpa = by_code(regimes, "zz-tpa")
    before = json.dumps(tpa, sort_keys=True)
    summary = jurisdiction.summarize(tpa, "ZZ", "ZZ-TV")
    assert json.dumps(tpa, sort_keys=True) == before
    assert summary["code"] == "zz-tpa"
    assert summary["regulator"]["name"] == "Testville Data Office"
    assert summary["deadline"]["days"] == 30
    assert summary["verified"] is True
    assert summary["usable_for_requests"] is True
    assert summary["warnings"] == []
    assert summary["rights"][0]["right"] == "erasure"
    assert summary["special_channels"][0]["id"] == "zz-drop"
