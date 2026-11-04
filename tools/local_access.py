#!/usr/bin/env python3
"""Reopen an existing local profile from the machine that owns its private data."""
import argparse
import os
from pathlib import Path
import secrets
import sqlite3
import sys
import time
import webbrowser

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from webapp import auth, store


def issue(data_dir: Path, email=None):
    root = data_dir.expanduser().absolute()
    if any(p.is_symlink() for p in (root, *root.parents)):
        raise ValueError('Use the original non-symlink local data directory.')
    target = root / 'erase-me.sqlite3'
    if (not target.is_file() or target.is_symlink() or not (root / '.erase-me-web').is_file()
            or root.stat().st_uid != os.getuid() or target.stat().st_uid != os.getuid()
            or root.stat().st_mode & 0o077 or target.stat().st_mode & 0o077):
        raise ValueError('An existing private local database owned by this user is required.')
    # Do not create or adopt another app's database while recovering a session.
    with sqlite3.connect('file:' + str(target) + '?mode=ro', uri=True) as db:
        mode = db.execute("SELECT value FROM settings WHERE key='mode'").fetchone()
    if not mode or mode[0] != 'local':
        raise ValueError('This helper only opens local, inbox-free profiles.')
    store.init_db(root, mode='local')
    with store.connect() as db:
        users = db.execute("SELECT id FROM users WHERE verification_method='self_attested_local' "
                           'AND verified=1' + (' AND email=?' if email else ''),
                           (email.lower(),) if email else ()).fetchall()
        if len(users) != 1:
            raise ValueError('Specify --email to select one existing local profile.')
        token = secrets.token_urlsafe(32)
        db.execute('INSERT INTO sessions(digest,user_id,expires) VALUES(?,?,?)',
                   (auth.digest(token), users[0]['id'], time.time() + auth.SESSION_LIFETIME))
    return token


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--data-dir', type=Path, default=Path.home() / '.erase-me-web-local')
    parser.add_argument('--email')
    parser.add_argument('--port', type=int, default=8766)
    args = parser.parse_args()
    try:
        if not 1024 <= args.port <= 65535:
            raise ValueError('Invalid local port.')
        token = issue(args.data_dir, args.email)
        # Fragment is not sent in HTTP requests or access logs. The UI erases it
        # immediately and exchanges it over a protected same-origin POST.
        if not webbrowser.open(f'http://127.0.0.1:{args.port}/#local-session={token}'):
            auth.logout(token)
            raise ValueError('The browser could not be opened. No session link was printed.')
        print('Opened your existing local profile. No inbox connection or timer was started.')
        return 0
    except (ValueError, OSError, sqlite3.Error) as exc:
        print('Local access failed: ' + str(exc))
        return 1


if __name__ == '__main__':
    raise SystemExit(main())
