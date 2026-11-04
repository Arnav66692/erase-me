from __future__ import annotations

import os
import stat

import pytest

from erase_me import consent
from erase_me.errors import RefusalError, UsageError


def test_self_consent_record(today):
    record = consent.build_consent("zelda", "self", "self")
    assert record["person_id"] == "zelda"
    assert record["relationship"] == "self"
    assert record["method"] == "self"
    assert record["consented_on"] == "2026-10-25"
    assert record["recorded_at"].startswith("2026-10-25T")
    assert record["authorization_file"] is None
    assert record["agent_name"] is None
    assert "my own personal data" in record["statement"]


def test_family_consent_names_agent(today):
    record = consent.build_consent("mom", "parent", "verbal", agent_name="Arnie Example")
    assert "Arnie Example may search" in record["statement"]
    assert record["agent_name"] == "Arnie Example"


def test_family_consent_without_agent_name_refused(today):
    with pytest.raises(UsageError):
        consent.build_consent("mom", "parent", "written")


@pytest.mark.parametrize("relationship", ["friend", "", "SELF", None])
def test_unknown_relationship_rejected(relationship):
    with pytest.raises(UsageError):
        consent.build_consent("mom", relationship, "verbal")


def test_unknown_method_rejected():
    with pytest.raises(UsageError):
        consent.build_consent("mom", "parent", "telepathy")


def test_self_method_only_for_self():
    with pytest.raises(UsageError):
        consent.build_consent("mom", "parent", "self")
    with pytest.raises(UsageError):
        consent.build_consent("me", "self", "verbal")


def test_signed_authorization_needs_existing_file(tmp_path, today):
    with pytest.raises(UsageError):
        consent.build_consent("mom", "parent", "signed_authorization", agent_name="A")
    with pytest.raises(UsageError):
        consent.build_consent("mom", "parent", "signed_authorization", authorization_file=str(tmp_path / "nope.pdf"),
                              agent_name="A")
    signed = tmp_path / "signed.pdf"
    signed.write_bytes(b"%PDF")
    record = consent.build_consent("mom", "parent", "signed_authorization", authorization_file=str(signed), agent_name="A")
    assert record["authorization_file"] == str(signed.resolve())


def test_bad_person_id_refused():
    with pytest.raises(RefusalError):
        consent.build_consent("../x", "self", "self")


def test_save_load_and_require(home, today):
    record = consent.build_consent("zelda", "self", "self")
    path = consent.save_consent(record)
    assert stat.S_IMODE(os.stat(path).st_mode) == 0o600
    assert consent.has_consent("zelda")
    assert consent.load_consent("zelda") == record
    assert consent.require_consent("zelda") == record


def test_require_consent_refuses_without_file(home):
    assert not consent.has_consent("nobody")
    with pytest.raises(RefusalError) as info:
        consent.require_consent("nobody")
    assert "consent" in str(info.value).lower()


def test_require_consent_refuses_mismatched_record(home, today):
    record = consent.build_consent("zelda", "self", "self")
    consent.save_consent(record)
    tampered = dict(record, person_id="other")
    from erase_me import paths, storage
    storage.write_json_private(paths.consent_path("zelda"), tampered)
    with pytest.raises(RefusalError):
        consent.require_consent("zelda")


def test_build_does_not_mutate_inputs(today):
    record = consent.build_consent("zelda", "self", "self")
    copy = dict(record)
    consent.build_consent("zelda", "self", "self")
    assert record == copy


def test_operator_email_for_family(today):
    record = consent.build_consent("mom", "parent", "verbal", agent_name="Arnie", operator_email="Arnie@Agent.example")
    assert record["operator_email"] == "arnie@agent.example"


def test_operator_email_validated(today):
    with pytest.raises(UsageError):
        consent.build_consent("mom", "parent", "verbal", agent_name="A", operator_email="nope")


def test_operator_email_defaults_to_none(today):
    assert consent.build_consent("zelda", "self", "self")["operator_email"] is None
