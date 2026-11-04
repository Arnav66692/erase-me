from __future__ import annotations

import json

import pytest

from conftest import PERSON, PERSON_EMAIL, PERSON_NAME, PERSON_PHONE


def items_by_id(result):
    return {i["item_id"]: i for i in result.json()["data"]["items"]}


def test_no_command_shows_help(cli):
    result = cli()
    assert result.code == 2
    assert "usage" in (result.out + result.err).lower()


def test_help_command(cli):
    result = cli("help")
    assert result.code == 0
    assert "search-urls" in result.out
    assert "add" in result.out
    sub = cli("help", "record")
    assert sub.code == 0
    assert "--evidence" in sub.out
    assert cli("help", "nope").code == 2


def test_unknown_command_is_usage_error(cli):
    assert cli("explode").code == 2


def test_init_json(cli, home):
    result = cli("init", "--json")
    assert result.code == 0
    payload = result.json()
    assert payload["ok"] is True
    assert payload["command"] == "init"
    assert payload["data"]["home"] == str(home)


def test_json_flag_before_command(cli):
    result = cli("--json", "init")
    assert result.json()["ok"] is True


def test_consent_and_intake_do_not_echo_personal_data(cli, today):
    cli("init")
    consent = cli("consent", PERSON, "--relationship", "self", "--method", "self")
    assert consent.code == 0
    assert "zelda" in consent.out
    intake = cli("intake", PERSON, "--name", PERSON_NAME, "--country", "zz", "--region", "zz-tv",
                 "--city", "Testville", "--email", PERSON_EMAIL, "--phone", PERSON_PHONE, "--json")
    assert intake.code == 0, intake.err
    text = intake.out + intake.err
    for secret in (PERSON_NAME, PERSON_EMAIL, PERSON_PHONE, "Testville"):
        assert secret not in text
    data = intake.json()["data"]
    assert data["country"] == "ZZ" and data["cities"] == 1 and data["emails"] == 1


def test_consent_usage_errors(cli):
    assert cli("consent", PERSON, "--relationship", "friend", "--method", "verbal").code == 2
    assert cli("consent", PERSON, "--relationship", "parent", "--method", "signed_authorization").code == 2


def test_family_consent_with_agent(cli, today):
    result = cli("consent", "mom", "--relationship", "parent", "--method", "verbal",
                 "--agent-name", "Arnie Example", "--operator-email", "arnie@agent.example", "--json")
    assert result.code == 0
    assert result.json()["data"]["relationship"] == "parent"


def test_intake_bad_country(cli, today):
    cli("consent", PERSON, "--relationship", "self", "--method", "self")
    result = cli("intake", PERSON, "--name", PERSON_NAME, "--country", "Testland")
    assert result.code == 2
    assert "two-letter" in result.err


def test_laws_by_country_without_consent(cli):
    result = cli("laws", "--country", "ZZ", "--region", "ZZ-TV", "--json")
    assert result.code == 0
    laws = result.json()["data"]["laws"]
    assert [law["code"] for law in laws] == ["zz-tv-rpa", "zz-tpa"]
    assert laws[0]["warnings"]


def test_laws_human_output(cli):
    result = cli("laws", "--country", "ZY")
    assert result.code == 0
    assert "Notyetland Personal Data Act" in result.out
    assert "Not in force" in result.out


def test_laws_none_match(cli):
    result = cli("laws", "--country", "QQ")
    assert result.code == 0
    assert "No privacy law" in result.out


def test_laws_needs_person_or_country(cli):
    assert cli("laws").code == 2
    assert cli("laws", "zelda", "--country", "ZZ").code == 2


def test_laws_for_person(cli, ready_person):
    result = cli("laws", ready_person, "--json")
    assert result.code == 0
    assert result.json()["data"]["country"] == "ZZ"


def test_plan_is_actionable(cli, ready_person):
    result = cli("plan", ready_person, "--json")
    assert result.code == 0
    items = items_by_id(result)
    pf = items["peoplefind"]
    for key in ("item_id", "name", "category", "search_urls", "optout_url", "method", "requires", "steps", "status"):
        assert key in pf
    assert pf["search_urls"] == ["https://peoplefind.example.com/zelda-quuxington/tv/testville"]
    assert pf["optout_url"] == "https://peoplefind.example.com/optout"
    assert items["peoplefind-lite"]["status"] == "skipped"
    assert list(items)[0] == "zz-drop"
    assert result.json()["data"]["added"] == 0


def test_plan_rerun_keeps_progress(cli, ready_person):
    cli("record", ready_person, "peoplefind", "found")
    again = cli("plan", ready_person, "--json")
    assert items_by_id(again)["peoplefind"]["status"] == "found"


def test_plan_human_output(cli, ready_person):
    result = cli("plan", ready_person)
    assert "PeopleFind Testland" in result.out
    assert "https://peoplefind.example.com/optout" in result.out


def test_search_urls_single_item(cli, ready_person):
    result = cli("search-urls", ready_person, "--item", "oldbook", "--json")
    assert result.code == 0
    items = result.json()["data"]["items"]
    assert len(items) == 1
    assert items[0]["search_urls"] == ["https://oldbook.example.com/phone/995550142777"]


def test_search_urls_skips_skipped(cli, ready_person):
    ids = [i["item_id"] for i in cli("search-urls", ready_person, "--json").json()["data"]["items"]]
    assert "peoplefind-lite" not in ids
    assert "example-search" in ids


def test_search_urls_bad_item(cli, ready_person):
    assert cli("search-urls", ready_person, "--item", "../x").code == 3
    assert cli("search-urls", ready_person, "--item", "nope").code == 2


def test_record_flow_sets_due_date(cli, ready_person):
    found = cli("record", ready_person, "peoplefind", "found", "--evidence", "https://peoplefind.example.com/p/1", "--json")
    assert found.code == 0
    assert found.json()["data"]["status"] == "found"
    requested = cli("record", ready_person, "peoplefind", "requested", "--json")
    data = requested.json()["data"]
    assert data["previous_status"] == "found"
    assert data["due_on"] == "2026-11-25"


def test_record_requested_without_regime_uses_expected_days(cli, today, skill_dir):
    for name in ("zz-tpa.json", "zz-tv-rpa.json"):
        (skill_dir / "references" / "jurisdictions" / name).rename(skill_dir / name)
    cli("consent", PERSON, "--relationship", "self", "--method", "self")
    cli("intake", PERSON, "--name", PERSON_NAME, "--country", "ZZ")
    cli("plan", PERSON)
    result = cli("record", PERSON, "oldbook", "requested", "--json")
    assert result.json()["data"]["due_on"] == "2026-11-24"


def test_record_illegal_transition(cli, ready_person):
    result = cli("record", ready_person, "peoplefind", "removed")
    assert result.code == 2
    assert "cannot go from planned to removed" in result.err


def test_record_bad_status_and_evidence(cli, ready_person):
    assert cli("record", ready_person, "peoplefind", "gone").code == 2
    assert cli("record", ready_person, "peoplefind", "found", "--evidence", "javascript:alert(1)").code == 2


def test_draft_writes_file_and_never_sends(cli, ready_person, home):
    cli("record", ready_person, "oldbook", "found", "--evidence", "https://oldbook.example.com/p/9")
    result = cli("draft", ready_person, "oldbook", "--json")
    assert result.code == 0, result.err
    data = result.json()["data"]
    assert data["sent"] is False
    path = home / "people" / "zelda" / "drafts" / "oldbook-erasure.md"
    assert data["drafts"][0]["path"] == str(path)
    assert "Zelda Quuxington" in path.read_text()
    assert data["drafts"][0]["recipient_email"] == "privacy@oldbook.example.com"


def test_draft_human_says_not_sent(cli, ready_person):
    result = cli("draft", ready_person, "oldbook")
    assert result.code == 0
    assert "not sent" in result.out.lower()


def test_draft_for_family_adds_authorization_cover(cli, today, home, tmp_path):
    signed = tmp_path / "signed.pdf"
    signed.write_bytes(b"%PDF signed")
    cli("consent", "mom", "--relationship", "parent", "--method", "signed_authorization", "--authorization-file", str(signed),
        "--agent-name", "Arnie Example", "--operator-email", "arnie@agent.example")
    cli("intake", "mom", "--name", "Mabel Quuxington", "--country", "ZZ", "--region", "ZZ-TV", "--city", "Testville")
    cli("plan", "mom")
    result = cli("draft", "mom", "oldbook", "--json")
    assert result.code == 0, result.err
    kinds = [d["kind"] for d in result.json()["data"]["drafts"]]
    assert kinds == ["erasure", "authorization"]
    cover = home / "people" / "mom" / "drafts" / "oldbook-authorization.md"
    assert "My name is Arnie Example" in cover.read_text()


def test_draft_kind_choices(cli, ready_person):
    assert cli("draft", ready_person, "oldbook", "--kind", "threat").code == 2
    assert cli("draft", ready_person, "oldbook", "--kind", "authorization").code == 3


def test_draft_refuses_not_in_force(cli, today):
    cli("consent", "ana", "--relationship", "self", "--method", "self")
    cli("intake", "ana", "--name", "Ana Example", "--country", "ZY")
    cli("plan", "ana")
    plan = cli("plan", "ana", "--json").json()["data"]["items"]
    assert all(i["regime"] is None for i in plan)


def test_deadlines_lists_overdue(cli, ready_person, today):
    cli("record", ready_person, "peoplefind", "found")
    cli("record", ready_person, "peoplefind", "requested")
    assert cli("deadlines", ready_person, "--json").json()["data"]["overdue"] == []
    today("2026-12-01")
    result = cli("deadlines", ready_person, "--json")
    rows = result.json()["data"]["overdue"]
    assert rows[0]["item_id"] == "peoplefind"
    assert rows[0]["next_kind"] == "followup"
    assert rows[0]["name"] == "PeopleFind Testland"
    assert "draft zelda peoplefind --kind followup" in rows[0]["next_command"]
    human = cli("deadlines", ready_person)
    assert "PeopleFind Testland" in human.out


def test_deadlines_human_when_none(cli, ready_person):
    assert "Nothing is overdue" in cli("deadlines", ready_person).out


def test_tasks_digest(cli, ready_person):
    cli("record", ready_person, "peoplefind", "found")
    cli("record", ready_person, "oldbook", "needs_human", "--note", "They want ID")
    result = cli("tasks", ready_person, "--json")
    groups = {g["requirement"]: g for g in result.json()["data"]["groups"]}
    assert "captcha" in groups and "needs_human" in groups
    human = cli("tasks", ready_person)
    assert "CAPTCHAs to solve" in human.out


def test_tasks_with_only_upcoming_steps(cli, ready_person):
    out = cli("tasks", ready_person).out
    assert "Nothing needs you right now." in out
    assert "Coming up" in out
    assert "ID documents requested" in out


def test_tasks_empty(cli, ready_person):
    for item in ("peoplefind", "oldbook", "example-callerid", "example-search", "mailer"):
        cli("record", ready_person, item, "skipped")
    out = cli("tasks", ready_person).out
    assert "Nothing needs you right now." in out
    assert "Coming up" not in out


def test_stats(cli, ready_person):
    cli("record", ready_person, "peoplefind", "found")
    result = cli("stats", ready_person, "--json")
    data = result.json()["data"]
    assert data["found"] == 1
    assert data["removal_rate"] == "0%"
    assert "1 listing found" in cli("stats", ready_person).out


def test_report_html(cli, ready_person, home):
    result = cli("report", ready_person, "--json")
    assert result.code == 0
    path = home / "people" / "zelda" / "report.html"
    assert result.json()["data"]["path"] == str(path)
    assert "PeopleFind Testland" in path.read_text()


def test_report_share(cli, ready_person, home):
    result = cli("report", ready_person, "--share", "--json")
    path = home / "share" / "zelda-card.svg"
    assert result.json()["data"]["path"] == str(path)
    assert path.read_text().startswith("<svg")
    assert "Share card saved" in cli("report", ready_person, "--share").out


def test_accounts(cli):
    result = cli("accounts", "--search", "shop", "--json")
    assert result.code == 0
    data = result.json()["data"]
    assert [s["name"] for s in data["sites"]] == ["Example Shop"]
    assert data["attribution"] == "JustDeleteMe contributors"
    assert "Example Shop" in cli("accounts", "--search", "shop").out
    assert "No account" in cli("accounts", "--search", "zzzz").out


def test_validate_command(cli, skill_dir):
    ok = cli("validate", "--json")
    assert ok.code == 0
    assert ok.json()["data"]["errors"] == []
    (skill_dir / "references" / "global" / "bad.json").write_text("{")
    bad = cli("validate")
    assert bad.code == 2
    assert "references/global/bad.json" in bad.out


def test_json_error_envelope(cli):
    result = cli("plan", "nobody", "--json")
    assert result.code == 3
    payload = json.loads(result.out)
    assert payload["ok"] is False
    assert payload["exit_code"] == 3
    assert "consent" in payload["error"].lower()


def test_entry_script_runs(tmp_path):
    import subprocess
    import sys
    from conftest import SCRIPTS_DIR
    env = {"ERASE_ME_HOME": str(tmp_path / "h"), "PATH": "/usr/bin:/bin"}
    proc = subprocess.run([sys.executable, str(SCRIPTS_DIR / "erase_me.py"), "init", "--json"],
                          capture_output=True, text=True, env=env, timeout=60)
    assert proc.returncode == 0, proc.stderr
    assert json.loads(proc.stdout)["ok"] is True


def make_open_deadline(skill_dir):
    path = skill_dir / "references" / "jurisdictions" / "zz-tpa.json"
    data = json.loads(path.read_text())
    data["deadline"] = {"days": None, "day_type": "calendar", "basis": "days", "extension_days": None,
                        "extension_note": "", "citation": "s. 12(3)"}
    path.write_text(json.dumps(data))


def test_record_statutory_flag(cli, ready_person):
    cli("record", ready_person, "peoplefind", "found")
    data = cli("record", ready_person, "peoplefind", "requested", "--json").json()["data"]
    assert data["statutory"] is True


def test_null_deadline_regime_suggests_followup(cli, skill_dir, ready_person, today):
    make_open_deadline(skill_dir)
    cli("record", ready_person, "peoplefind", "found")
    result = cli("record", ready_person, "oldbook", "requested", "--json")
    data = result.json()["data"]
    assert data["due_on"] == "2026-11-24"
    assert data["statutory"] is False
    human = cli("record", ready_person, "peoplefind", "requested")
    assert "(suggested follow-up, not a legal deadline)" in human.out
    today("2026-12-01")
    rows = cli("deadlines", ready_person, "--json").json()["data"]["overdue"]
    assert {r["item_id"]: r["statutory"] for r in rows} == {"oldbook": False, "peoplefind": False}
    assert all(r["next_kind"] == "followup" for r in rows)
    assert "(suggested follow-up, not a legal deadline)" in cli("deadlines", ready_person).out
