from __future__ import annotations

import os
import re
import shutil
import stat
import subprocess
from pathlib import Path

import pytest

from conftest import (
    FIXTURE_SKILL_DIR, PACKAGE_DIR, PERSON, PERSON_CITY, PERSON_EMAIL, PERSON_NAME, PERSON_PHONE,
    REAL_SKILL_DIR, SCRIPTS_DIR,
)

NETWORK_IMPORT = re.compile(
    r"^\s*(import|from)\s+(socket|http\.client|http\b|urllib\.request|urllib3|requests|ftplib|smtplib|"
    r"telnetlib|xmlrpc|asyncio|ssl)\b|urllib\.request|http\.client|import\s+socket",
    re.MULTILINE,
)


def engine_sources():
    return sorted(PACKAGE_DIR.rglob("*.py")) + [SCRIPTS_DIR / "erase_me.py"]


def test_engine_has_no_network_imports():
    offenders = [str(p) for p in engine_sources() if NETWORK_IMPORT.search(p.read_text(encoding="utf-8"))]
    assert offenders == []


def test_engine_has_no_third_party_imports():
    import sys
    stdlib = set(getattr(sys, "stdlib_module_names", ())) or None
    pattern = re.compile(r"^\s*(?:from|import)\s+([a-zA-Z_][\w]*)", re.MULTILINE)
    for path in engine_sources():
        for name in pattern.findall(path.read_text(encoding="utf-8")):
            if name in ("erase_me", "__future__"):
                continue
            if stdlib is not None:
                assert name in stdlib, f"{path}: {name}"


def test_modules_stay_small():
    for path in engine_sources():
        assert len(path.read_text(encoding="utf-8").splitlines()) < 400, path


def all_modes(root: Path):
    for current, dirs, files in os.walk(root):
        yield Path(current), stat.S_IMODE(os.stat(current).st_mode)
        for name in files:
            target = Path(current) / name
            yield target, stat.S_IMODE(os.stat(target).st_mode)


def test_every_file_and_folder_is_private_after_a_full_run(cli, ready_person, home):
    cli("record", ready_person, "oldbook", "found", "--evidence", "https://oldbook.example.com/p/1")
    cli("record", ready_person, "oldbook", "requested")
    cli("draft", ready_person, "oldbook")
    cli("report", ready_person)
    cli("report", ready_person, "--share")
    seen = 0
    for path, mode in all_modes(home):
        seen += 1
        expected = 0o700 if path.is_dir() else 0o600
        assert mode == expected, f"{path} has mode {oct(mode)}"
    assert seen >= 9


@pytest.mark.parametrize("command", ["record", "draft"])
def test_item_traversal_refused(cli, ready_person, home, command):
    extra = ["found"] if command == "record" else []
    result = cli(command, ready_person, "../../share/x", *extra)
    assert result.code == 3
    assert not (home / "share" / "x").exists()
    assert not any(p.name.startswith("x") for p in home.rglob("*"))


DISTINCTIVE_EVIDENCE = "https://peoplefind.example.com/listing/zq-unique-7731"
CUSTOM_NAME = "Quuxbrasil Pessoas"
CUSTOM_DOMAIN = "quuxbrasil-pessoas.example.com.br"


def share_card_secrets(home):
    ledger_text = (home / "people" / PERSON / "ledger.json").read_text()
    references = re.findall(r"ERASE-ME-[A-Z0-9-]+", (home / "people" / PERSON / "drafts" / "peoplefind-erasure.md").read_text())
    assert references
    return [
        PERSON_NAME, "Zelda", "Quuxington", PERSON_CITY, PERSON_EMAIL, PERSON_PHONE, "0142", "ZZ-TV", "Testland",
        "PeopleFind", "peoplefind", "example.com", "https://", "http://", DISTINCTIVE_EVIDENCE, "zq-unique-7731",
        "2026-10-25", "2026-11-25", "2026", PERSON, *references, CUSTOM_NAME, "Quuxbrasil", CUSTOM_DOMAIN,
        "quux-custom", "dpo@",
    ] + [i for i in re.findall(r'"item_id": "([^"]+)"', ledger_text)]


@pytest.mark.parametrize("template_source", ["fixture", "real", "fallback"])
def test_share_card_contains_no_personal_data(cli, ready_person, home, skill_dir, template_source):
    card = skill_dir / "templates" / "share-card.svg"
    if template_source == "real":
        real = REAL_SKILL_DIR / "templates" / "share-card.svg"
        if not real.is_file():
            pytest.skip("real share card template not written yet")
        shutil.copy(real, card)
    if template_source == "fallback":
        card.unlink()
    cli("record", ready_person, "peoplefind", "found", "--evidence", DISTINCTIVE_EVIDENCE, "--note", PERSON_NAME)
    cli("record", ready_person, "peoplefind", "requested")
    cli("draft", ready_person, "peoplefind")
    cli("add", ready_person, "quux-custom", "--name", CUSTOM_NAME, "--domain", CUSTOM_DOMAIN,
        "--email", "dpo@" + CUSTOM_DOMAIN, "--evidence", "https://" + CUSTOM_DOMAIN + "/z/1")
    result = cli("report", ready_person, "--share", "--json")
    assert result.code == 0
    svg = (home / "share" / f"{PERSON}-card.svg").read_text()
    lowered = svg.lower()
    for secret in share_card_secrets(home):
        if secret in ("https://", "http://") and template_source != "fallback":
            assert secret + "www.w3.org" in lowered or secret not in lowered.replace("http://www.w3.org", "")
            continue
        if secret in ("https://", "http://"):
            assert secret not in lowered.replace("http://www.w3.org", "")
            continue
        assert secret.lower() not in lowered, f"share card leaks {secret!r}"
    assert result.json()["data"]["counts"]["found"] == "2"


def test_report_html_escapes_profile_values(cli, today, home):
    cli("consent", "evil", "--relationship", "self", "--method", "self")
    cli("intake", "evil", "--name", "Zed <script>alert(1)</script>", "--country", "ZZ")
    cli("plan", "evil")
    cli("record", "evil", "oldbook", "found", "--note", "<img src=x onerror=alert(2)>")
    cli("report", "evil")
    html = (home / "people" / "evil" / "report.html").read_text()
    assert "<script>alert" not in html
    assert "<img src=x" not in html
    assert "&lt;script&gt;" in html


def test_stdout_does_not_leak_profile_on_record(cli, ready_person):
    result = cli("record", ready_person, "peoplefind", "found", "--note", "secret note text", "--json")
    assert "secret note text" not in result.out
    assert PERSON_EMAIL not in result.out


def _python39():
    candidate = Path("/usr/bin/python3")
    if not candidate.exists():
        return None
    out = subprocess.run([str(candidate), "-c", "import sys;print(sys.version_info[:2])"], capture_output=True, text=True)
    return str(candidate) if out.stdout.strip() == "(3, 9)" else None


@pytest.mark.skipif(_python39() is None, reason="no Python 3.9 interpreter at /usr/bin/python3")
def test_runs_on_python_39(tmp_path):
    python = _python39()
    env = {"ERASE_ME_HOME": str(tmp_path / "h"), "ERASE_ME_SKILL_DIR": str(FIXTURE_SKILL_DIR), "PATH": "/usr/bin:/bin"}
    script = str(SCRIPTS_DIR / "erase_me.py")
    steps = [
        ["init"], ["consent", "zelda", "--relationship", "self", "--method", "self"],
        ["intake", "zelda", "--name", "Zelda Quuxington", "--country", "ZZ", "--region", "ZZ-TV", "--city", "Testville"],
        ["plan", "zelda"], ["record", "zelda", "oldbook", "requested"], ["draft", "zelda", "oldbook"],
        ["deadlines", "zelda"], ["tasks", "zelda"], ["report", "zelda"], ["report", "zelda", "--share"],
        ["stats", "zelda"], ["laws", "--country", "ZZ"], ["accounts"], ["validate"],
    ]
    for step in steps:
        proc = subprocess.run([python, "-B", script, *step, "--json"], capture_output=True, text=True, env=env, timeout=60)
        assert proc.returncode == 0, (step, proc.stderr)
