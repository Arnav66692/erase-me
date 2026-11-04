"""Shared fixtures. Tests never touch the real ~/.erase-me or real sites."""
from __future__ import annotations

import io
import json
import shutil
import sys
from contextlib import redirect_stderr, redirect_stdout
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
SCRIPTS_DIR = ROOT / "skills" / "erase-me" / "scripts"
PACKAGE_DIR = SCRIPTS_DIR / "erase_me"
REAL_SKILL_DIR = ROOT / "skills" / "erase-me"
FIXTURE_SKILL_DIR = Path(__file__).resolve().parent / "fixtures" / "skill"

for extra in (str(SCRIPTS_DIR), str(ROOT / "tools")):
    if extra not in sys.path:
        sys.path.insert(0, extra)


@pytest.fixture(autouse=True)
def isolated_home(tmp_path, monkeypatch):
    """Every test gets a throwaway home so the real one is never used."""
    home = tmp_path / "erase-home"
    monkeypatch.setenv("ERASE_ME_HOME", str(home))
    monkeypatch.setenv("ERASE_ME_SKILL_DIR", str(FIXTURE_SKILL_DIR))
    return home


@pytest.fixture
def home(isolated_home):
    return isolated_home


@pytest.fixture
def skill_dir(tmp_path, monkeypatch):
    """A writable copy of the fixture skill dir."""
    target = tmp_path / "skill"
    shutil.copytree(FIXTURE_SKILL_DIR, target)
    monkeypatch.setenv("ERASE_ME_SKILL_DIR", str(target))
    return target


@pytest.fixture
def today(monkeypatch):
    """Pin the engine clock. Returns a setter for later changes."""
    import datetime as dt

    from erase_me import clock

    state = {"day": dt.date(2026, 10, 25)}

    def fake_today():
        return state["day"]

    def fake_now_iso():
        return state["day"].isoformat() + "T10:00:00-07:00"

    monkeypatch.setattr(clock, "today", fake_today)
    monkeypatch.setattr(clock, "now_iso", fake_now_iso)

    def set_day(value):
        state["day"] = value if isinstance(value, dt.date) else dt.date.fromisoformat(value)
        return state["day"]

    return set_day


class CliResult:
    def __init__(self, code, out, err):
        self.code = code
        self.out = out
        self.err = err

    def json(self):
        return json.loads(self.out)


@pytest.fixture
def cli():
    """Run the CLI in process and capture output."""
    from erase_me import cli as cli_module

    def run(*args):
        out, err = io.StringIO(), io.StringIO()
        with redirect_stdout(out), redirect_stderr(err):
            try:
                code = cli_module.main([str(a) for a in args])
            except SystemExit as exc:
                code = exc.code if isinstance(exc.code, int) else 2
        return CliResult(code, out.getvalue(), err.getvalue())

    return run


PERSON = "zelda"
PERSON_NAME = "Zelda Quuxington"
PERSON_CITY = "Testville"
PERSON_EMAIL = "zelda.q@quux-mail.example"
PERSON_PHONE = "+99 555 0142 777"


@pytest.fixture
def ready_person(cli, today):
    """A person with consent, a profile and a plan."""
    assert cli("init").code == 0
    assert cli("consent", PERSON, "--relationship", "self", "--method", "self").code == 0
    result = cli(
        "intake", PERSON, "--name", PERSON_NAME, "--country", "ZZ", "--region", "ZZ-TV",
        "--city", PERSON_CITY, "--email", PERSON_EMAIL, "--phone", PERSON_PHONE,
        "--variant", "Z Quuxington", "--age-range", "30-39",
    )
    assert result.code == 0, result.err
    assert cli("plan", PERSON).code == 0
    return PERSON
