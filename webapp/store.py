"""Private SQLite persistence shared by the web API and the job worker."""
from __future__ import annotations

import os
import sqlite3
from datetime import datetime, timezone
from pathlib import Path

_DATABASE: Path | None = None
SCHEMA = """
CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS users (
 id TEXT PRIMARY KEY, name TEXT NOT NULL, age INTEGER NOT NULL,
 email TEXT NOT NULL UNIQUE, country TEXT, region TEXT, city TEXT,
 verified INTEGER NOT NULL DEFAULT 0, authorized_at TEXT NOT NULL,
 verification_method TEXT NOT NULL DEFAULT 'email_code',
 authorization_version TEXT NOT NULL DEFAULT '2026-10-28-v1',
 authorization_statement TEXT NOT NULL DEFAULT '',
 status TEXT NOT NULL DEFAULT 'active', created_at TEXT NOT NULL, next_check_at TEXT
);
CREATE TABLE IF NOT EXISTS items (
 id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 site_id TEXT NOT NULL, name TEXT NOT NULL, domain TEXT NOT NULL,
 status TEXT NOT NULL, detail TEXT NOT NULL DEFAULT '', url TEXT,
 updated_at TEXT NOT NULL, UNIQUE(user_id, site_id)
);
CREATE TABLE IF NOT EXISTS activity (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 at TEXT NOT NULL, message TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS questions (
 id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 prompt TEXT NOT NULL, field TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS challenges (
 user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
 digest TEXT NOT NULL, salt TEXT NOT NULL, expires REAL NOT NULL,
 attempts INTEGER NOT NULL DEFAULT 0, created REAL NOT NULL,
 flow_digest TEXT, signup_json TEXT
);
CREATE TABLE IF NOT EXISTS sessions (
 digest TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 expires REAL NOT NULL
);
CREATE TABLE IF NOT EXISTS rate_limits (
 subject TEXT PRIMARY KEY, count INTEGER NOT NULL, window REAL NOT NULL
);
CREATE INDEX IF NOT EXISTS items_user ON items(user_id);
CREATE INDEX IF NOT EXISTS activity_user ON activity(user_id, id);
CREATE INDEX IF NOT EXISTS sessions_user ON sessions(user_id);
"""


def now() -> str:
    return datetime.now(timezone.utc).isoformat()


def init_db(data_dir: Path, mode: str | None = None) -> Path:
    global _DATABASE
    root = Path(data_dir).expanduser()
    if root.is_symlink() or root.resolve() in (Path.home().resolve(), Path('/')):
        raise ValueError('Use a dedicated, non-symlink directory for Erase Me web data.')
    if root.exists() and not root.is_dir():
        raise ValueError('The web data path must be a directory.')
    if root.exists() and root.stat().st_uid != os.getuid():
        raise ValueError('The web data directory must belong to the current user.')
    marker = root / '.erase-me-web'
    if root.exists() and any(root.iterdir()) and not marker.is_file():
        raise ValueError('Refusing to adopt a nonempty directory without an Erase Me web marker.')
    root.mkdir(parents=True, exist_ok=True, mode=0o700)
    os.chmod(root, 0o700)
    if marker.is_symlink():
        raise ValueError('Invalid web data marker.')
    if not marker.exists():
        fd = os.open(marker, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
        with os.fdopen(fd, 'w') as handle:
            handle.write('Private Erase Me web data.\n')
    target = root / 'erase-me.sqlite3'
    if target.is_symlink():
        raise ValueError('The web database must not be a symlink.')
    if not target.exists():
        fd = os.open(target, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
        os.close(fd)
    os.chmod(target, 0o600)
    _DATABASE = target
    with connect() as db:
        db.executescript(SCHEMA)
        user_columns = {row['name'] for row in db.execute('PRAGMA table_info(users)')}
        if 'verification_method' not in user_columns:
            db.execute("ALTER TABLE users ADD COLUMN verification_method TEXT NOT NULL DEFAULT 'email_code'")
        challenge_columns = {row['name'] for row in db.execute('PRAGMA table_info(challenges)')}
        for column in ('flow_digest', 'signup_json'):
            if column not in challenge_columns:
                db.execute(f'ALTER TABLE challenges ADD COLUMN {column} TEXT')
        if mode:
            saved = db.execute("SELECT value FROM settings WHERE key='mode'").fetchone()
            if saved and saved['value'] != mode:
                raise ValueError('Demo and live data must use separate ERASE_WEB_HOME directories.')
            db.execute("INSERT OR IGNORE INTO settings(key,value) VALUES('mode',?)", (mode,))
    return target


class ClosingConnection(sqlite3.Connection):
    def __exit__(self, exc_type, exc_value, traceback):
        try:
            return super().__exit__(exc_type, exc_value, traceback)
        finally:
            self.close()


def connect() -> sqlite3.Connection:
    if _DATABASE is None:
        raise RuntimeError('Call init_db before using the web database.')
    db = sqlite3.connect(_DATABASE, timeout=20, factory=ClosingConnection)
    db.row_factory = sqlite3.Row
    db.execute('PRAGMA foreign_keys=ON')
    db.execute('PRAGMA secure_delete=ON')
    return db


def event(db: sqlite3.Connection, user_id: str, message: str) -> None:
    db.execute('INSERT INTO activity(user_id,at,message) VALUES(?,?,?)', (user_id, now(), message))
