from __future__ import annotations

import os
import stat
from pathlib import Path

import pytest

from erase_me import paths
from erase_me.errors import RefusalError


def mode_of(path):
    return stat.S_IMODE(os.stat(path).st_mode)


def test_home_uses_env(home):
    assert paths.home_dir() == home


def test_home_defaults_to_user_folder(monkeypatch, tmp_path):
    monkeypatch.delenv("ERASE_ME_HOME", raising=False)
    monkeypatch.setenv("HOME", str(tmp_path))
    assert paths.home_dir() == tmp_path / ".erase-me"


def test_blank_home_env_falls_back(monkeypatch, tmp_path):
    monkeypatch.setenv("ERASE_ME_HOME", "   ")
    monkeypatch.setenv("HOME", str(tmp_path))
    assert paths.home_dir() == tmp_path / ".erase-me"


def test_skill_dir_override(monkeypatch, tmp_path):
    monkeypatch.setenv("ERASE_ME_SKILL_DIR", str(tmp_path))
    assert paths.skill_dir() == tmp_path
    assert paths.references_dir() == tmp_path / "references"
    assert paths.templates_dir() == tmp_path / "templates"


def test_skill_dir_default_is_package_grandparent(monkeypatch):
    monkeypatch.delenv("ERASE_ME_SKILL_DIR", raising=False)
    expected = Path(paths.__file__).resolve().parents[2]
    assert paths.skill_dir() == expected
    assert expected.name == "erase-me"


def test_init_home_sets_modes(home):
    created = paths.init_home()
    assert created == home
    for sub in (home, home / "people", home / "share"):
        assert sub.is_dir()
        assert mode_of(sub) == 0o700


def test_init_home_tightens_existing_modes(home):
    paths.init_home()
    loose_dir = home / "people" / "mom"
    loose_dir.mkdir()
    os.chmod(loose_dir, 0o755)
    loose_file = loose_dir / "profile.json"
    loose_file.write_text("{}")
    os.chmod(loose_file, 0o644)
    os.chmod(home, 0o755)
    paths.init_home()
    assert mode_of(home) == 0o700
    assert mode_of(loose_dir) == 0o700
    assert mode_of(loose_file) == 0o600


def test_person_dir_validates_id(home):
    assert paths.person_dir("mom") == home / "people" / "mom"
    with pytest.raises(RefusalError):
        paths.person_dir("../../etc")


def test_ensure_person_dir_creates_private_tree(home):
    target = paths.ensure_person_dir("mom")
    assert target.is_dir()
    for sub in (home, home / "people", target, target / "drafts"):
        assert mode_of(sub) == 0o700


def test_share_dir(home):
    assert paths.share_dir() == home / "share"
    created = paths.ensure_share_dir()
    assert mode_of(created) == 0o700


def test_person_file_names(home):
    assert paths.consent_path("mom") == home / "people" / "mom" / "consent.json"
    assert paths.profile_path("mom").name == "profile.json"
    assert paths.ledger_path("mom").name == "ledger.json"
    assert paths.report_path("mom").name == "report.html"
    assert paths.share_card_path("mom") == home / "share" / "mom-card.svg"


def test_draft_path_validates_item(home):
    assert paths.draft_path("mom", "spokeo", "erasure").name == "spokeo-erasure.md"
    with pytest.raises(RefusalError):
        paths.draft_path("mom", "../x", "erasure")
    with pytest.raises(RefusalError):
        paths.draft_path("mom", "spokeo", "../erasure")


def test_symlinked_home_is_refused(tmp_path, monkeypatch):
    real = tmp_path / "real"
    real.mkdir()
    link = tmp_path / "link"
    link.symlink_to(real)
    monkeypatch.setenv("ERASE_ME_HOME", str(link))
    with pytest.raises(RefusalError):
        paths.init_home()
