from __future__ import annotations

import datetime as dt
import os
import stat

import pytest

from erase_me import catalog, consent, drafts, jurisdiction, ledger, profile, templates
from erase_me.errors import RefusalError, UsageError
from conftest import FIXTURE_SKILL_DIR

REFS = FIXTURE_SKILL_DIR / "references"
TEMPLATES = FIXTURE_SKILL_DIR / "templates"
TODAY = dt.date(2026, 10, 25)
NOW = "2026-10-25T10:00:00-07:00"


@pytest.fixture
def person():
    return profile.build_profile(
        "zelda", "Zelda Quuxington", "ZZ", region="ZZ-TV", cities=["Testville"], emails=["zelda@quux.example"]
    )


@pytest.fixture
def cat(person):
    return catalog.load_catalog(REFS, person["country"])


def self_consent():
    return {"person_id": "zelda", "relationship": "self", "method": "self", "agent_name": None}


def item(site_id="oldbook", regime="zz-tpa", **extra):
    base = ledger.new_item(site_id, site_id, "countries/zz", "email", regime, now=NOW)
    base.update(extra)
    return base


def prepare(person, cat, the_item, kind="erasure", who=None):
    return drafts.prepare_draft(
        record=person, consent_record=who or self_consent(), item=the_item, kind=kind,
        cat=cat, templates_root=TEMPLATES, today=TODAY,
    )


def test_erasure_draft_filled(person, cat):
    the_item = item(evidence_urls=["https://oldbook.example.com/p/9"])
    result = prepare(person, cat, the_item)
    text = result["text"]
    assert result["template_id"] == "tpa-erasure"
    assert result["sent"] is False
    assert text.startswith("Subject: Request for erasure of personal data under TPA s. 17\n\n")
    assert "To OldBook Directory (privacy@oldbook.example.com)" in text
    assert "Zelda Quuxington" in text
    assert "Testville, ZZ-TV, ZZ" in text
    assert "- https://oldbook.example.com/p/9" in text
    assert "2026-11-25" in text
    assert "ERASE-ME-OLDBOOK-20261025" in text
    assert text.rstrip().endswith(templates.DISCLAIMER)
    assert result["missing"] == []
    assert result["recipient_email"] == "privacy@oldbook.example.com"


def test_family_agent_values(person, cat):
    who = {"person_id": "zelda", "relationship": "parent", "method": "verbal", "agent_name": "Arnie Example"}
    text = prepare(person, cat, item(), who=who)["text"]
    assert "I am Arnie Example (parent)" in text


def test_missing_values_marked(cat):
    bare = profile.build_profile("zelda", "Zelda Quuxington", "ZZ")
    result = prepare(bare, cat, item())
    assert "[[MISSING: email]]" in result["text"]
    assert "[[MISSING: listing_urls]]" in result["text"]
    assert "email" in result["missing"]


def test_followup_uses_original_dates(person, cat):
    requested = item(status="requested", requested_on="2026-09-01", due_on="2026-10-01")
    result = prepare(person, cat, requested, kind="followup")
    assert result["template_id"] == "followup-generic"
    assert "On 2026-09-01 I asked" in result["text"]
    assert "2026-10-01 has passed" in result["text"]


def test_complaint_names_regulator(person, cat):
    requested = item(status="requested", requested_on="2026-09-01", due_on="2026-10-01")
    text = prepare(person, cat, requested, kind="complaint")["text"]
    assert "To Testville Data Office (https://tdo.example.org/complain)" in text


def test_special_channel_recipient(person, cat):
    special = ledger.new_item("zz-drop", "zz-drop", "jurisdiction", "drop", "zz-tpa", now=NOW)
    text = prepare(person, cat, special)["text"]
    assert "To Testland Deletion Portal" in text


def test_not_in_force_regime_refused(cat):
    other = profile.build_profile("ana", "Ana Example", "ZY")
    with pytest.raises(RefusalError) as info:
        prepare(other, catalog.load_catalog(REFS, "ZY"), item(regime="zy-npa"))
    assert "not in force" in str(info.value)


def test_unknown_kind_rejected(person, cat):
    with pytest.raises(UsageError):
        prepare(person, cat, item(), kind="threat")


def test_no_regime_without_generic_template(person, cat):
    with pytest.raises(UsageError) as info:
        prepare(person, cat, item(regime=None))
    assert "template" in str(info.value)


def test_no_regime_uses_generic_fallback(person, cat, tmp_path):
    import shutil
    root = tmp_path / "templates"
    shutil.copytree(TEMPLATES, root)
    (root / "requests" / "generic-erasure.md").write_text(
        "---\nid: generic-erasure\nkind: erasure\nregimes: *\nsubject: Please delete {{full_name}}\n---\n"
        "Please delete my data.\n\n" + templates.DISCLAIMER + "\n"
    )
    result = drafts.prepare_draft(
        record=person, consent_record=self_consent(), item=item(regime=None), kind="erasure",
        cat=cat, templates_root=root, today=TODAY,
    )
    assert result["template_id"] == "generic-erasure"
    assert result["text"].startswith("Subject: Please delete Zelda Quuxington")


def test_complaint_without_regulator_refused(person, cat):
    with pytest.raises(RefusalError):
        prepare(person, cat, item(regime=None), kind="complaint")


def test_save_draft_private(home):
    path = drafts.save_draft("zelda", "oldbook", "erasure", "Subject: x\n\nbody\n")
    assert path.name == "oldbook-erasure.md"
    assert stat.S_IMODE(os.stat(path).st_mode) == 0o600
    assert stat.S_IMODE(os.stat(path.parent).st_mode) == 0o700


def test_unverified_regime_warns(person, cat):
    the_item = item(regime="zz-tv-rpa")
    result = prepare(person, cat, the_item)
    assert any("not verified" in w.lower() for w in result["warnings"])


def family_consent():
    return {
        "person_id": "zelda", "relationship": "parent", "method": "signed_authorization",
        "agent_name": "Arnie Example", "operator_email": "arnie@agent.example",
    }


def test_authorization_cover_for_family(person, cat):
    result = prepare(person, cat, item(), kind="authorization", who=family_consent())
    assert result["template_id"] == "authorized-agent-cover"
    text = result["text"]
    assert "My name is Arnie Example. Zelda Quuxington is my parent" in text
    assert "authorized agent under TPA s. 30" in text
    assert "Reply to me at arnie@agent.example" in text
    assert result["missing"] == []


def test_authorization_refused_for_self(person, cat):
    with pytest.raises(RefusalError):
        prepare(person, cat, item(), kind="authorization")


def test_authorization_warns_when_law_has_no_agent_rule(person, cat):
    result = prepare(person, cat, item(regime="zz-tv-rpa"), kind="authorization", who=family_consent())
    assert any("authorized agent" in w for w in result["warnings"])


def test_companion_kinds():
    assert drafts.companion_kinds(family_consent(), "erasure") == ["authorization"]
    assert drafts.companion_kinds(family_consent(), "objection") == ["authorization"]
    assert drafts.companion_kinds(family_consent(), "followup") == []
    assert drafts.companion_kinds(self_consent(), "erasure") == []


def test_self_operator_email_is_profile_email(person, cat):
    values = drafts.build_values(
        person, self_consent(), item(), {"name": "X"}, cat["regimes"]["zz-tpa"], None, TODAY
    )
    assert values["operator_email"] == "zelda@quux.example"
    assert values["citation_agent"] == "TPA s. 30"


def test_objection_falls_back_to_generic_erasure(person, cat, tmp_path):
    import shutil
    root = tmp_path / "templates"
    shutil.copytree(TEMPLATES, root)
    (root / "requests" / "generic-erasure.md").write_text(
        "---\nid: generic-erasure\nkind: erasure\nregimes: any\nsubject: Delete\n---\nBody\n\n" + templates.DISCLAIMER + "\n"
    )
    result = drafts.prepare_draft(
        record=person, consent_record=self_consent(), item=item(), kind="objection",
        cat=cat, templates_root=root, today=TODAY,
    )
    assert result["template_id"] == "generic-erasure"


def test_objection_without_any_template_is_clear(person, cat):
    with pytest.raises(UsageError) as info:
        prepare(person, cat, item(), kind="objection")
    assert "objection" in str(info.value)


def open_deadline_cat(cat):
    import copy
    changed = copy.deepcopy(cat)
    changed["regimes"]["zz-tpa"]["deadline"] = {
        "days": None, "day_type": "calendar", "basis": "days", "extension_days": None, "citation": "s. 12(3)",
    }
    return changed


def test_null_deadline_fills_plain_phrases(person, cat):
    result = prepare(person, open_deadline_cat(cat), item(due_on="2026-11-24", requested_on="2026-10-25"))
    text = result["text"]
    assert "Please respond as soon as reasonably practicable, and in any case by 2026-11-24." in text
    assert "must respond" not in text
    assert "days" not in text.split("Please respond", 1)[1].split("\n", 1)[0]
    assert "deadline_sentence" not in result["missing"]


def test_statutory_deadline_sentence_cites_law(person, cat):
    result = prepare(person, cat, item(requested_on="2026-10-25"))
    line = [ln for ln in result["text"].splitlines() if "must respond" in ln][0]
    assert line.startswith("Under TPA s. 12(3), ") and "within one month, by 2026-11-25" in line


def test_past_sentence_without_fixed_deadline(person, cat):
    values = drafts.build_values(person, self_consent(), item(requested_on="2026-10-25"), {"name": "X"},
                                 open_deadline_cat(cat)["regimes"]["zz-tpa"], None, TODAY)
    assert values["deadline_sentence_past"] == "I asked for a reply by 2026-11-24."


def test_no_regime_sentence_is_a_request_not_a_law(person, cat):
    values = drafts.build_values(person, self_consent(), item(regime=None), {"name": "X", "expected_days": 10},
                                 None, None, TODAY)
    assert values["deadline_sentence"].startswith("Please respond within 10 days")


def test_null_deadline_values(person, cat):
    values = drafts.build_values(person, self_consent(), item(), {"name": "X"},
                                 open_deadline_cat(cat)["regimes"]["zz-tpa"], None, TODAY)
    assert values["deadline_days"] == drafts.NO_FIXED_DAYS_TEXT == "a reasonable time"
    assert values["deadline_date"] == drafts.NO_FIXED_DATE_TEXT == "as soon as reasonably practicable"


def test_partial_regime_is_drafted_like_in_force(person, cat):
    regime = cat["regimes"]["zz-tv-rpa"]
    assert regime["status"] == "partial"
    result = prepare(person, cat, item(regime="zz-tv-rpa"))
    assert result["template_id"] == "tpa-erasure"
    assert "Testville Regional Privacy Act" in result["text"]


def test_no_regime_past_sentence_claims_no_legal_due_date(person, cat):
    values = drafts.build_values(person, self_consent(), item(regime=None, requested_on="2026-10-25"),
                                 {"name": "X", "expected_days": 10}, None, None, TODAY, kind="followup")
    assert values["deadline_sentence_past"] == "I asked for a reply by 2026-11-04."
    assert "due" not in values["deadline_sentence_past"]
