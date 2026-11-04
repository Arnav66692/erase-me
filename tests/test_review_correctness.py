"""Code review fixes: region matching, no-law letters, deadline wording, dates, stats, legal routes."""
from __future__ import annotations

import copy
import datetime as dt
import json

import pytest

from erase_me import catalog, deadlines, drafts, jurisdiction, ledger, letter_values, profile, stats
from erase_me.errors import RefusalError
from conftest import FIXTURE_SKILL_DIR, REAL_SKILL_DIR

REFS = FIXTURE_SKILL_DIR / "references"
TEMPLATES = FIXTURE_SKILL_DIR / "templates"
NOW = "2026-10-25T10:00:00-07:00"
TODAY = dt.date(2026, 10, 25)
D = dt.date


# 1. Region matching -----------------------------------------------------------

def test_regional_regime_needs_matching_region():
    ccpa_like = {"code": "us-ca-ccpa", "applies_to": {"countries": ["US"], "regions": ["US-CA"]}}
    federal = {"code": "us-x", "applies_to": {"countries": ["US"], "regions": []}}
    regimes = [ccpa_like, federal]
    assert [r["code"] for r in jurisdiction.match_regimes(regimes, "US", "US-FL")] == ["us-x"]
    assert [r["code"] for r in jurisdiction.match_regimes(regimes, "US", None)] == ["us-x"]
    assert [r["code"] for r in jurisdiction.match_regimes(regimes, "US", "US-CA")] == ["us-ca-ccpa", "us-x"]


@pytest.fixture
def real_skill(monkeypatch):
    monkeypatch.setenv("ERASE_ME_SKILL_DIR", str(REAL_SKILL_DIR))
    return REAL_SKILL_DIR


def real_person(cli, person, country, region=None, city="Testville", email="zelda.q@quux-mail.example"):
    assert cli("consent", person, "--relationship", "self", "--method", "self").code == 0
    args = ["intake", person, "--name", "Zelda Quuxington", "--country", country, "--city", city, "--email", email]
    if region:
        args += ["--region", region]
    assert cli(*args).code == 0
    result = cli("plan", person, "--json")
    assert result.code == 0, result.err
    return result.json()["data"]["items"]


@pytest.mark.realdata
@pytest.mark.parametrize(
    "region, wanted, unwanted",
    [
        ("US-FL", set(), {"us-ca-ccpa", "us-tx-tdpsa"}),
        ("US-TX", {"us-tx-tdpsa"}, {"us-ca-ccpa"}),
        ("US-CA", {"us-ca-ccpa"}, {"us-tx-tdpsa"}),
    ],
)
def test_real_us_states(cli, today, real_skill, region, wanted, unwanted):
    laws = {law["code"] for law in cli("laws", "--country", "US", "--region", region, "--json").json()["data"]["laws"]}
    assert wanted <= laws and not (unwanted & laws)
    items = real_person(cli, "zq", "US", region)
    ids = {i["item_id"] for i in items}
    assert ("ca-drop" in ids) is (region == "US-CA")
    assert all(i["regime"] in wanted or i["regime"] is None for i in items)


@pytest.mark.realdata
def test_real_ontario_gets_no_quebec_law(cli, today, real_skill):
    laws = {law["code"] for law in cli("laws", "--country", "CA", "--region", "CA-ON", "--json").json()["data"]["laws"]}
    assert "ca-qc-law25" not in laws and "ca-pipeda" in laws
    items = real_person(cli, "zq", "CA", "CA-ON")
    assert "google-eu-delisting" not in {i["item_id"] for i in items}
    assert all(i["regime"] != "ca-qc-law25" for i in items)
    quebec = real_person(cli, "zq2", "CA", "CA-QC")
    assert "google-eu-delisting" in {i["item_id"] for i in quebec}


# 2. No-law letters -------------------------------------------------------------

@pytest.mark.realdata
@pytest.mark.parametrize("country, region", [("IN", None), ("US", "US-FL")])
def test_real_no_law_letters_have_nothing_missing(cli, today, real_skill, home, country, region):
    real_person(cli, "zq", country, region)
    added = cli("add", "zq", "lista-quux", "--name", "Lista Quux", "--domain", "lista-quux.example.com",
                "--email", "privacy@lista-quux.example.com", "--evidence", "https://lista-quux.example.com/p/1", "--json")
    assert added.json()["data"]["regime"] is None
    erasure = cli("draft", "zq", "lista-quux", "--json").json()["data"]["drafts"][0]
    assert erasure["missing"] == [], erasure["missing"]
    text = (home / "people" / "zq" / "drafts" / "lista-quux-erasure.md").read_text()
    assert "[[MISSING" not in text and "your own privacy policy" in text
    cli("record", "zq", "lista-quux", "requested")
    today("2026-12-30")
    followup = cli("draft", "zq", "lista-quux", "--kind", "followup", "--json").json()["data"]["drafts"][0]
    assert followup["missing"] == [] and followup["premature"] is False
    text = (home / "people" / "zq" / "drafts" / "lista-quux-followup.md").read_text()
    assert "[[MISSING" not in text and "On 2026-10-25 I asked" in text


def test_law_sentence_and_basis():
    regime = {"short_name": "APPI", "name": "Act on the Protection of Personal Information (Act No. 57 of 2003), as amended.",
              "rights": [{"right": "erasure", "citation": "APPI Art. 35(5) and (6)"}]}
    values = letter_values.law_values(regime, None)
    assert values["law_sentence"] == "Where the APPI applies, this request is made under APPI Art. 35(5) and (6)."
    assert values["law_basis"] == "the APPI"
    assert values["law_name"].endswith("as amended")
    none = letter_values.law_values(None, None)
    assert "your own privacy policy" in none["law_sentence"]
    assert none["law_basis"] == "your privacy policy"
    assert none["escalation_sentence"]
    assert none["law_name"] is None


# 3 and 5. Deadline sentences and law references --------------------------------

@pytest.mark.parametrize(
    "rule, phrase",
    [
        ({"days": 30, "day_type": "calendar", "basis": "one_month", "citation": "Art. 12(3)"}, "within one month, by 2026-11-25"),
        ({"days": 20, "day_type": "business", "basis": "days", "citation": "Art. 24"}, "within 20 business days, by 2026-11-20"),
        ({"days": 45, "day_type": "calendar", "basis": "days", "citation": "s. 9"}, "within 45 days, by 2026-12-09"),
    ],
)
def test_deadline_sentence_respects_basis(rule, phrase):
    regime = {"short_name": "TPA", "deadline": rule}
    item = ledger.new_item("x", "x", "global", "web_form", "zz", now=NOW)
    values = letter_values.deadline_values(item, regime, {}, TODAY, kind="erasure", recipient="X")
    assert phrase in values["deadline_sentence"]
    assert values["deadline_sentence"].startswith("Under TPA ")


@pytest.mark.parametrize(
    "short, citation, expected",
    [
        ("UK GDPR", "UK GDPR Art. 17", "UK GDPR Art. 17"),
        ("GDPR", "Art. 17", "GDPR Art. 17"),
        ("CCPA", "Cal. Civ. Code 1798.99.86", "Cal. Civ. Code 1798.99.86 (CCPA)"),
        ("Privacy Act", "Privacy Act 1988 Sch 1, APP 11.2", "Privacy Act 1988 Sch 1, APP 11.2"),
        ("LFPDPPP (2025)", "LFPDPPP 2025, Art. 24 and 25", "LFPDPPP 2025, Art. 24 and 25"),
        ("TPA", None, None),
    ],
)
def test_law_reference(short, citation, expected):
    assert letter_values.law_ref(short, citation) == expected


def test_duplicate_law_names_collapse():
    assert letter_values.dedupe_law("under the UK GDPR UK GDPR Art. 17", "UK GDPR") == "under the UK GDPR Art. 17"
    assert letter_values.dedupe_law("under TPA TPA s. 17", "TPA") == "under TPA s. 17"
    assert letter_values.dedupe_law("nothing here", None) == "nothing here"


def test_fixture_letter_has_no_doubled_short_name():
    person = profile.build_profile("zelda", "Zelda Quuxington", "ZZ", region="ZZ-TV", cities=["Testville"])
    cat = catalog.load_catalog(REFS, "ZZ")
    item = ledger.new_item("oldbook", "oldbook", "countries/zz", "email", "zz-tpa", now=NOW)
    result = drafts.prepare_draft(record=person, consent_record={"relationship": "self"}, item=item, kind="erasure",
                                  cat=cat, templates_root=TEMPLATES, today=TODAY)
    assert "TPA TPA" not in result["text"]
    assert result["subject"] == "Request for erasure of personal data under TPA s. 17"


# 4. Extensions ------------------------------------------------------------------

def test_extension_respects_basis_and_day_type():
    assert deadlines.extended_due(D(2026, 11, 25), {"basis": "one_month", "extension_days": 60}) == D(2027, 1, 25)
    assert deadlines.extended_due(D(2026, 1, 31), {"basis": "one_month", "extension_days": 60}) == D(2026, 3, 31)
    friday = D(2026, 10, 23)
    assert deadlines.extended_due(friday, {"basis": "days", "day_type": "business", "extension_days": 1}) == D(2026, 10, 26)
    assert deadlines.extended_due(friday, {"basis": "days", "day_type": "calendar", "extension_days": 1}) == D(2026, 10, 24)


# 6. Relationship words -----------------------------------------------------------

@pytest.mark.parametrize("enum, word", [("other_family", "family member"), ("parent", "parent"),
                                        ("grandparent", "grandparent"), ("self", "self")])
def test_relationship_words(enum, word):
    assert letter_values.relationship_word(enum) == word


# 7. Complaint wording and premature drafts ----------------------------------------

@pytest.fixture
def zz_person():
    return profile.build_profile("zelda", "Zelda Quuxington", "ZZ", region="ZZ-TV", cities=["Testville"],
                                 emails=["zelda@quux.example"])


def draft(person, item, kind, today=TODAY):
    return drafts.prepare_draft(record=person, consent_record={"relationship": "self"}, item=item, kind=kind,
                                cat=catalog.load_catalog(REFS, "ZZ"), templates_root=TEMPLATES, today=today)


def requested_item(due="2026-10-01"):
    item = ledger.new_item("oldbook", "oldbook", "countries/zz", "email", "zz-tpa", now=NOW)
    return dict(item, status="requested", requested_on="2026-09-01", due_on=due)


def test_complaint_past_sentence_is_third_person(zz_person):
    item = requested_item()
    values = letter_values.deadline_values(item, catalog.load_catalog(REFS, "ZZ")["regimes"]["zz-tpa"], {}, TODAY,
                                           kind="complaint", recipient="OldBook Directory")
    assert values["deadline_sentence_past"] == "Under TPA s. 12(3), the response from OldBook Directory was due by 2026-10-01."
    followup = letter_values.deadline_values(item, catalog.load_catalog(REFS, "ZZ")["regimes"]["zz-tpa"], {}, TODAY,
                                             kind="followup", recipient="OldBook Directory")
    assert followup["deadline_sentence_past"] == "Under TPA s. 12(3), your response was due by 2026-10-01."


@pytest.mark.parametrize("kind", ["followup", "complaint"])
def test_premature_followup_and_complaint(zz_person, kind):
    early = draft(zz_person, requested_item(due="2026-11-25"), kind)
    assert early["premature"] is True
    assert any("not due until 2026-11-25" in w for w in early["warnings"])
    late = draft(zz_person, requested_item(due="2026-10-01"), kind)
    assert late["premature"] is False


def test_followup_before_any_request_is_premature(zz_person):
    item = ledger.new_item("oldbook", "oldbook", "countries/zz", "email", "zz-tpa", now=NOW)
    result = draft(zz_person, item, "followup")
    assert result["premature"] is True
    assert any("not been requested" in w for w in result["warnings"])
    assert draft(zz_person, item, "erasure")["premature"] is False


# 8. Ledger dates ---------------------------------------------------------------------

def test_removed_on_cleared_and_first_request_kept():
    data = ledger.new_ledger("zelda", [ledger.new_item("s", "s", "global", "web_form", None, now=NOW)])
    data = ledger.transition(data, "s", "requested", now=NOW, today=D(2026, 9, 1), due_on=D(2026, 10, 1))
    data = ledger.transition(data, "s", "requested", now=NOW, today=D(2026, 10, 5), due_on=D(2026, 11, 4))
    item = ledger.find_item(data, "s")
    assert (item["first_requested_on"], item["requested_on"], item["due_on"]) == ("2026-09-01", "2026-10-05", "2026-11-04")
    data = ledger.transition(data, "s", "requested", now=NOW, today=D(2026, 11, 10), due_on=D(2026, 12, 10))
    assert ledger.find_item(data, "s")["first_requested_on"] == "2026-09-01"
    data = ledger.transition(data, "s", "removed", now=NOW, today=D(2026, 11, 20))
    data = ledger.transition(data, "s", "relisted", now=NOW, today=D(2027, 1, 1))
    assert ledger.find_item(data, "s")["removed_on"] is None


def test_followup_letter_uses_first_request_date(zz_person):
    item = dict(requested_item(), first_requested_on="2026-08-01", requested_on="2026-09-01")
    assert "On 2026-08-01 I asked" in draft(zz_person, item, "followup")["text"]


# 9. Stats --------------------------------------------------------------------------

def test_found_counts_any_listing_state():
    items = [ledger.new_item(f"s-{n}", f"s-{n}", "global", "web_form", None, now=NOW) for n in range(4)]
    data = ledger.new_ledger("zelda", items)
    data = ledger.transition(data, "s-0", "requested", now=NOW, today=TODAY)
    data = ledger.transition(data, "s-0", "rejected", now=NOW, today=TODAY)
    data = ledger.transition(data, "s-1", "requested", now=NOW, today=TODAY)
    data = ledger.transition(data, "s-1", "removed", now=NOW, today=TODAY)
    data = ledger.transition(data, "s-2", "not_found", now=NOW, today=TODAY)
    result = stats.compute(data, TODAY)
    assert result["found"] == 2
    assert result["removal_rate"] == "50%"


@pytest.mark.parametrize("removed, found, expected", [(1, 8, "13%"), (1, 200, "1%"), (1, 3, "33%"), (2, 3, "67%"),
                                                      (0, 0, "n/a"), (1, 40, "3%")])
def test_rate_rounds_half_up(removed, found, expected):
    assert stats.format_rate(removed, found) == expected


def test_labels_singular_and_plural():
    assert stats.labels({"sites_checked": 1, "found": 1, "requested": 1, "removed": 1}) == {
        "sites_checked_label": "site checked", "found_label": "listing found",
        "requested_label": "removal request", "removed_label": "listing erased",
    }
    assert stats.labels({"sites_checked": 0, "found": 2, "requested": 3, "removed": 0})["found_label"] == "listings found"


def test_stats_human_and_share_card_wording(cli, ready_person, home, skill_dir):
    cli("record", ready_person, "peoplefind", "found")
    out = cli("stats", ready_person).out
    assert "1 listing found" in out and "0 listings erased" in out and "1 site checked" in out
    (skill_dir / "templates" / "share-card.svg").write_text("<svg>{{found}} {{found_label}}, {{removed}} {{removed_label}}</svg>")
    cli("report", ready_person, "--share")
    assert (home / "share" / "zelda-card.svg").read_text() == "<svg>1 listing found, 0 listings erased</svg>"


# 10. legal_route items --------------------------------------------------------------

def test_legal_route_draft_refused(cli, ready_person, skill_dir):
    path = skill_dir / "references" / "countries" / "zz" / "oldbook.json"
    data = json.loads(path.read_text())
    data["category"] = "legal_route"
    path.write_text(json.dumps(data))
    result = cli("draft", ready_person, "oldbook")
    assert result.code == 3
    assert "add zelda" in result.err and "legal request route" in result.err
