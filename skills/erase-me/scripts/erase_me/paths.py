"""Where things live on disk, and the 700/600 permission rules."""
from __future__ import annotations

import os
import re
from pathlib import Path

from .errors import RefusalError
from .ids import is_valid_person_id, validate_item_id, validate_person_id

HOME_ENV = "ERASE_ME_HOME"
SKILL_ENV = "ERASE_ME_SKILL_DIR"
DEFAULT_HOME_NAME = ".erase-me"
MARKER_NAME = ".erase-me-home"
MARKER_TEXT = "This folder is an Erase Me home. It holds private data. Keep it private.\n"
DIR_MODE = 0o700
FILE_MODE = 0o600
PEOPLE_DIR = "people"
SHARE_DIR = "share"
DRAFTS_DIR = "drafts"
DRAFT_KIND_CHARS = frozenset("abcdefghijklmnopqrstuvwxyz_")
PERSON_FILES = ("consent.json", "profile.json", "ledger.json", "report.html", "consent_log.jsonl")
AUTHORIZATION_PREFIX = "authorization."
DRAFT_NAME_RE = re.compile(r"[a-z0-9][a-z0-9-]{0,63}-[a-z_]+\.md")
SHARE_NAME_RE = re.compile(r"[a-z0-9][a-z0-9-]{0,39}-card\.svg")


def _env_path(name: str) -> "Path | None":
    raw = os.environ.get(name, "").strip()
    if not raw:
        return None
    return Path(raw).expanduser()


def home_dir() -> Path:
    override = _env_path(HOME_ENV)
    if override is not None:
        return override
    return Path.home() / DEFAULT_HOME_NAME


def skill_dir() -> Path:
    override = _env_path(SKILL_ENV)
    if override is not None:
        return override
    return Path(__file__).resolve().parents[2]


def references_dir() -> Path:
    return skill_dir() / "references"


def templates_dir() -> Path:
    return skill_dir() / "templates"


def _refuse_symlink(path: Path) -> None:
    if path.is_symlink():
        raise RefusalError(f"Refusing to use {path} because it is a symbolic link.")


def _check_owner(path: Path) -> None:
    if os.lstat(path).st_uid != os.getuid():
        raise RefusalError(f"Refusing to use {path} because another user owns it.")


def _check_location(root: Path) -> None:
    resolved = root.resolve()
    user_home = Path.home().resolve()
    if resolved == Path(resolved.anchor) or resolved == user_home or resolved in user_home.parents:
        raise RefusalError(
            f"Refusing to use {root} as the Erase Me home. Pick a dedicated folder like {user_home / DEFAULT_HOME_NAME}."
        )


def _write_marker(root: Path) -> None:
    marker = root / MARKER_NAME
    fd = os.open(str(marker), os.O_WRONLY | os.O_CREAT | os.O_EXCL, FILE_MODE)
    with os.fdopen(fd, "w", encoding="utf-8") as handle:
        handle.write(MARKER_TEXT)


def prepare_home() -> Path:
    """Create or adopt the home. A non-empty folder without the marker is never taken over."""
    root = home_dir()
    _refuse_symlink(root)
    _check_location(root)
    if not root.exists():
        root.mkdir(mode=DIR_MODE, parents=True)
    if not root.is_dir():
        raise RefusalError(f"Refusing to use {root} because it is not a folder.")
    _check_owner(root)
    if not (root / MARKER_NAME).is_file():
        if any(root.iterdir()):
            raise RefusalError(
                f"Refusing to use {root}: it already holds files and is not an Erase Me home. "
                "Set ERASE_ME_HOME to an empty or new folder."
            )
        _write_marker(root)
    os.chmod(root, DIR_MODE)
    return root


def ensure_private_dir(path: Path) -> Path:
    """Create path (and missing parents under home) with mode 700, checking links and ownership."""
    root = prepare_home()
    chain = [path] + [p for p in path.parents if root in p.parents]
    for directory in reversed(chain):
        _refuse_symlink(directory)
        directory.mkdir(mode=DIR_MODE, exist_ok=True)
        _check_owner(directory)
        os.chmod(directory, DIR_MODE)
    return path


def _chmod_if(path: Path, mode: int, is_dir: bool) -> None:
    if path.is_symlink():
        return
    if (is_dir and path.is_dir()) or (not is_dir and path.is_file()):
        os.chmod(path, mode)


def _known_person_paths(person: Path):
    yield person, True
    for name in PERSON_FILES:
        yield person / name, False
    for entry in person.glob(AUTHORIZATION_PREFIX + "*"):
        yield entry, False
    drafts = person / DRAFTS_DIR
    yield drafts, True
    if drafts.is_dir() and not drafts.is_symlink():
        for entry in drafts.iterdir():
            if DRAFT_NAME_RE.fullmatch(entry.name):
                yield entry, False


def enforce_known_modes(root: Path) -> None:
    """Tighten only paths Erase Me itself creates. Nothing else in the folder is touched."""
    targets = [(root, True), (root / MARKER_NAME, False), (root / PEOPLE_DIR, True), (root / SHARE_DIR, True)]
    people = root / PEOPLE_DIR
    if people.is_dir() and not people.is_symlink():
        for person in people.iterdir():
            if is_valid_person_id(person.name) and person.is_dir() and not person.is_symlink():
                targets.extend(_known_person_paths(person))
    share = root / SHARE_DIR
    if share.is_dir() and not share.is_symlink():
        targets.extend((e, False) for e in share.iterdir() if SHARE_NAME_RE.fullmatch(e.name))
    for path, is_dir in targets:
        _chmod_if(path, DIR_MODE if is_dir else FILE_MODE, is_dir)


def init_home() -> Path:
    root = prepare_home()
    ensure_private_dir(root / PEOPLE_DIR)
    ensure_private_dir(root / SHARE_DIR)
    enforce_known_modes(root)
    return root


def person_dir(person_id: str) -> Path:
    validate_person_id(person_id)
    return home_dir() / PEOPLE_DIR / person_id


def ensure_person_dir(person_id: str) -> Path:
    target = person_dir(person_id)
    ensure_private_dir(target / DRAFTS_DIR)
    return target


def share_dir() -> Path:
    return home_dir() / SHARE_DIR


def ensure_share_dir() -> Path:
    return ensure_private_dir(share_dir())


def consent_path(person_id: str) -> Path:
    return person_dir(person_id) / "consent.json"


def consent_log_path(person_id: str) -> Path:
    return person_dir(person_id) / "consent_log.jsonl"


def profile_path(person_id: str) -> Path:
    return person_dir(person_id) / "profile.json"


def ledger_path(person_id: str) -> Path:
    return person_dir(person_id) / "ledger.json"


def report_path(person_id: str) -> Path:
    return person_dir(person_id) / "report.html"


def share_card_path(person_id: str) -> Path:
    validate_person_id(person_id)
    return share_dir() / f"{person_id}-card.svg"


def draft_path(person_id: str, item_id: str, kind: str) -> Path:
    validate_item_id(item_id)
    if not kind or not set(kind) <= DRAFT_KIND_CHARS:
        raise RefusalError("Draft kind must be lowercase letters only.")
    return person_dir(person_id) / DRAFTS_DIR / f"{item_id}-{kind}.md"
