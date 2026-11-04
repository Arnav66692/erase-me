"""Every command that touches a person refuses with exit 3 when consent is missing."""
from __future__ import annotations

import pytest

GATED = [
    ("intake", "nobody", "--name", "Zelda Quuxington", "--country", "ZZ"),
    ("laws", "nobody"),
    ("plan", "nobody"),
    ("add", "nobody", "some-site", "--name", "Some Site", "--domain", "some.example.com"),
    ("search-urls", "nobody"),
    ("record", "nobody", "peoplefind", "found"),
    ("draft", "nobody", "peoplefind"),
    ("deadlines", "nobody"),
    ("tasks", "nobody"),
    ("report", "nobody"),
    ("report", "nobody", "--share"),
    ("stats", "nobody"),
]


@pytest.mark.parametrize("args", GATED, ids=lambda a: " ".join(a[:2]))
def test_gated_command_refuses_without_consent(cli, home, args):
    result = cli(*args)
    assert result.code == 3, result.err
    assert "consent" in result.err.lower()
    assert not (home / "people" / "nobody" / "profile.json").exists()


@pytest.mark.parametrize("args", GATED, ids=lambda a: " ".join(a[:2]))
def test_gated_command_refuses_bad_person_id(cli, args):
    bad = list(args)
    bad[1] = "../../etc"
    assert cli(*bad).code == 3


@pytest.mark.parametrize(
    "args",
    [("init",), ("consent", "nobody", "--relationship", "self", "--method", "self"), ("laws", "--country", "ZZ"),
     ("accounts",), ("validate",), ("help",)],
    ids=lambda a: a[0],
)
def test_exempt_commands_run_without_consent(cli, args):
    assert cli(*args).code == 0
