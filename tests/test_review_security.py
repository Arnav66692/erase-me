"""Security review fixes: home safety, consent hardening, family letters, untrusted text, email domains."""
from __future__ import annotations

import hashlib
import json
import os
import stat

import pytest

from erase_me import consent, ledger, paths, storage
from erase_me.errors import RefusalError, UsageError
from conftest import PERSON


def mode(path):
    return stat.S_IMODE(os.stat(path).st_mode)


# 11. Home safety ------------------------------------------------------------------

def test_init_writes_marker(cli, home):
    assert cli("init").code == 0
    marker = home / ".erase-me-home"
    assert marker.is_file() and mode(marker) == 0o600


@pytest.mark.parametrize("target", ["/", "HOME", "PARENT"])
def test_init_refuses_dangerous_roots(cli, tmp_path, monkeypatch, target):
    user_home = tmp_path / "users" / "zelda"
    user_home.mkdir(parents=True)
    monkeypatch.setenv("HOME", str(user_home))
    root = {"/": "/", "HOME": str(user_home), "PARENT": str(tmp_path / "users")}[target]
    monkeypatch.setenv("ERASE_ME_HOME", root)
    result = cli("init")
    assert result.code == 3
    assert not (user_home / ".erase-me-home").exists()


def test_init_refuses_non_empty_folder_without_marker(cli, home):
    home.mkdir()
    (home / "notes.txt").write_text("mine")
    os.chmod(home / "notes.txt", 0o644)
    result = cli("init")
    assert result.code == 3
    assert mode(home / "notes.txt") == 0o644
    assert cli("consent", PERSON, "--relationship", "self", "--method", "self").code == 3


def test_empty_existing_folder_is_adopted(cli, home):
    home.mkdir()
    assert cli("init").code == 0
    assert (home / ".erase-me-home").is_file()


def test_init_never_walks_unknown_paths(cli, home):
    cli("init")
    stray = home / "people" / "Not-A-Person"
    stray.mkdir()
    (stray / "x.txt").write_text("x")
    os.chmod(stray / "x.txt", 0o644)
    other = home / "people" / "mom"
    other.mkdir()
    (other / "random.txt").write_text("x")
    os.chmod(other / "random.txt", 0o644)
    (other / "profile.json").write_text("{}")
    os.chmod(other / "profile.json", 0o644)
    cli("init")
    assert mode(stray / "x.txt") == 0o644
    assert mode(other / "random.txt") == 0o644
    assert mode(other / "profile.json") == 0o600


def test_foreign_owner_refused(home, monkeypatch):
    paths.init_home()
    real_uid = os.getuid()
    monkeypatch.setattr(paths.os, "getuid", lambda: real_uid + 1)
    with pytest.raises(RefusalError):
        paths.ensure_person_dir("zelda")


def test_temp_file_is_private_before_replace(tmp_path, monkeypatch):
    seen = {}
    real_replace = os.replace

    def spy(src, dst):
        seen["mode"] = mode(src)
        return real_replace(src, dst)

    monkeypatch.setattr(storage.os, "replace", spy)
    target = tmp_path / "f.json"
    storage.write_text_private(target, "x")
    assert seen["mode"] == 0o600


# 12. Consent hardening ----------------------------------------------------------------

def test_family_consent_requires_agent_name(cli, today):
    result = cli("consent", "mom", "--relationship", "parent", "--method", "verbal")
    assert result.code == 2 and "--agent-name" in result.err


def test_consent_refuses_overwrite_without_replace(cli, today, home):
    assert cli("consent", PERSON, "--relationship", "self", "--method", "self").code == 0
    again = cli("consent", PERSON, "--relationship", "self", "--method", "self")
    assert again.code == 3 and "--replace" in again.err
    assert cli("consent", PERSON, "--relationship", "self", "--method", "self", "--replace").code == 0
    log = home / "people" / PERSON / "consent_log.jsonl"
    entries = [json.loads(line) for line in log.read_text().splitlines()]
    assert [e["action"] for e in entries] == ["recorded", "replaced"]
    assert mode(log) == 0o600


def test_signed_authorization_copied_with_hash(cli, today, home, tmp_path):
    signed = tmp_path / "Signed Auth.PDF"
    signed.write_bytes(b"%PDF-1.4 fake signed authorization")
    os.chmod(signed, 0o644)
    result = cli("consent", "mom", "--relationship", "parent", "--method", "signed_authorization",
                 "--authorization-file", str(signed), "--agent-name", "Arnie Example", "--json")
    assert result.code == 0, result.err
    record = json.loads((home / "people" / "mom" / "consent.json").read_text())
    copy = home / "people" / "mom" / "authorization.pdf"
    assert record["authorization_file"] == str(copy)
    assert copy.read_bytes() == signed.read_bytes() and mode(copy) == 0o600
    assert record["authorization_sha256"] == hashlib.sha256(signed.read_bytes()).hexdigest()
    log = (home / "people" / "mom" / "consent_log.jsonl").read_text()
    assert record["authorization_sha256"] in log


def test_unusual_authorization_extension_is_neutralized(today, home, tmp_path):
    odd = tmp_path / "auth.sh"
    odd.write_text("echo hi")
    record = consent.build_consent("mom", "parent", "signed_authorization", authorization_file=str(odd), agent_name="A")
    consent.save_consent(record)
    assert (home / "people" / "mom" / "authorization.bin").is_file()


def test_oversized_authorization_refused(today, tmp_path, monkeypatch):
    big = tmp_path / "big.pdf"
    big.write_bytes(b"x" * 20)
    monkeypatch.setattr(consent, "MAX_AUTHORIZATION_BYTES", 10)
    with pytest.raises(UsageError):
        consent.build_consent("mom", "parent", "signed_authorization", authorization_file=str(big), agent_name="A")


# 13. Family letters ---------------------------------------------------------------------

def family_person(cli, method, tmp_path, extra=()):
    args = ["consent", "mom", "--relationship", "parent", "--method", method, "--agent-name", "Arnie Example", *extra]
    if method == "signed_authorization":
        signed = tmp_path / "signed.pdf"
        signed.write_bytes(b"%PDF signed")
        args += ["--authorization-file", str(signed)]
    assert cli(*args).code == 0
    cli("intake", "mom", "--name", "Mabel Quuxington", "--country", "ZZ", "--region", "ZZ-TV", "--city", "Testville")
    cli("plan", "mom")


@pytest.mark.parametrize("method", ["verbal", "written"])
def test_verbal_or_written_family_letters_have_no_cover(cli, today, home, tmp_path, method):
    family_person(cli, method, tmp_path)
    result = cli("draft", "mom", "oldbook", "--json")
    drafts = result.json()["data"]["drafts"]
    assert [d["kind"] for d in drafts] == ["erasure"]
    assert any("must send this from their own email or sign it themselves" in w for w in drafts[0]["warnings"])
    assert not (home / "people" / "mom" / "drafts" / "oldbook-authorization.md").exists()
    assert cli("draft", "mom", "oldbook", "--kind", "authorization").code == 3


def test_signed_authorization_gets_cover(cli, today, home, tmp_path):
    family_person(cli, "signed_authorization", tmp_path)
    drafts = cli("draft", "mom", "oldbook", "--json").json()["data"]["drafts"]
    assert [d["kind"] for d in drafts] == ["erasure", "authorization"]


# 14. Untrusted text ------------------------------------------------------------------------

def test_note_is_one_line_and_capped():
    note = ledger.clean_note("first line\nsecond\tline   " + "y" * 500)
    assert "\n" not in note and note.startswith("first line second line y")
    assert len(note) == ledger.MAX_NOTE == 200


def test_custom_name_capped(cli, ready_person):
    assert cli("add", PERSON, "long-site", "--name", "N" * 81, "--domain", "long.example.com").code == 2
    assert cli("add", PERSON, "long-site", "--name", "N" * 80, "--domain", "long.example.com").code == 0


def test_json_marks_notes_untrusted(cli, ready_person):
    cli("record", ready_person, "oldbook", "needs_human", "--note", "page says hi")
    plan = cli("plan", ready_person, "--json").json()["data"]["items"]
    item = next(i for i in plan if i["item_id"] == "oldbook")
    assert item["last_note_untrusted"] == "page says hi" and "last_note" not in item
    groups = cli("tasks", ready_person, "--json").json()["data"]["groups"]
    entry = groups[0]["items"][0]
    assert entry["last_note_untrusted"] == "page says hi" and "last_note" not in entry


# 15. Custom email domain ---------------------------------------------------------------------

@pytest.mark.parametrize(
    "email, mismatch",
    [("dpo@lista.example.com.br", False), ("dpo@mail.lista.example.com.br", False),
     ("dpo@gmail.example.com", True), ("dpo@notlista.example.com.br", True)],
)
def test_email_domain_mismatch(cli, ready_person, email, mismatch):
    result = cli("add", PERSON, "lista", "--name", "Lista", "--domain", "lista.example.com.br", "--email", email, "--json")
    assert result.json()["data"]["email_domain_mismatch"] is mismatch
    human = cli("draft", PERSON, "lista")
    assert ("does not match" in human.out) is mismatch
    entry = cli("draft", PERSON, "lista", "--json").json()["data"]["drafts"][0]
    assert entry["email_domain_mismatch"] is mismatch


def test_add_human_warns_on_mismatch(cli, ready_person):
    out = cli("add", PERSON, "lista", "--name", "Lista", "--domain", "lista.example.com.br",
              "--email", "dpo@other.example.com").out
    assert "Warning:" in out and "does not match" in out
