#!/usr/bin/env python3
"""Prepare private IMAP-only settings. Connect only for an explicit read-only login test."""
from __future__ import annotations

import argparse
import getpass
import hashlib
import imaplib
import json
import os
from pathlib import Path
import re
import secrets
import stat
import ssl
import sys
import tempfile
import warnings

ROOT = Path(__file__).resolve().parents[1]
MARKER = '.erase-me-removal-mail'
MARKER_TEXT = 'Private Erase Me removal-only mailbox configuration.\n'
ENV_KEYS = frozenset({'ERASE_DEDICATED_MAILBOX', 'ERASE_REMOVAL_INBOX', 'ERASE_IMAP_HOST',
                      'ERASE_IMAP_PORT', 'ERASE_IMAP_USER', 'ERASE_IMAP_PASSWORD',
                      'ERASE_IMAP_AUTHSERV_ID', 'ERASE_IMAP_FOLDER', 'ERASE_MAIL_CAPABILITY_SECRET'})
EMAIL_RE = re.compile(r'[A-Za-z0-9.!#$%&\'*+/=?^_`{|}~-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\Z')


def default_config() -> Path:
    return Path.home() / '.erase-me-removal-mail' / 'config.json'


def hostname(value: str) -> str:
    if not isinstance(value, str) or len(value) > 253:
        raise ValueError('Use a valid provider hostname, without a URL or port.')
    labels = value.lower().split('.')
    if (len(labels) < 2 or any(not re.fullmatch(r'[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?', x) for x in labels)
            or labels[-1].isdigit()):
        raise ValueError('Use a valid provider hostname, without a URL or port.')
    return value.lower()


def canonical_email(value: str) -> str:
    if not isinstance(value, str) or len(value) > 254 or not EMAIL_RE.fullmatch(value):
        raise ValueError('Use a bare valid email address.')
    local, domain = value.casefold().split('@')
    hostname(domain)
    # Other providers can support plus aliases too. Removing the tag is a
    # conservative refusal, not a claim that every provider routes this way.
    local = local.split('+', 1)[0]
    if domain in ('gmail.com', 'googlemail.com'):
        local, domain = local.replace('.', ''), 'gmail.com'
    if not local:
        raise ValueError('Use a bare valid email address.')
    return local + '@' + domain


def personal_digest(address: str) -> str:
    return hashlib.sha256(canonical_email(address).encode()).hexdigest()


def validate_config(data: object) -> dict:
    if (not isinstance(data, dict) or set(data) != {'version', 'personal_email_sha256', 'environment'}
            or type(data.get('version')) is not int or data['version'] != 1
            or not isinstance(data.get('personal_email_sha256'), str)
            or not re.fullmatch(r'[a-f0-9]{64}', data['personal_email_sha256'])):
        raise ValueError('Invalid dedicated mailbox configuration structure.')
    env = data.get('environment')
    if not isinstance(env, dict) or set(env) != ENV_KEYS:
        raise ValueError('Only the dedicated IMAP settings are permitted.')
    for value in env.values():
        if (not isinstance(value, str) or not value or len(value) > 4096
                or any(ord(c) < 32 or ord(c) == 127 for c in value)):
            raise ValueError('Mailbox settings must be nonempty text without control characters.')
    if env['ERASE_DEDICATED_MAILBOX'] != 'true':
        raise ValueError('An explicit removal-only mailbox assertion is required.')
    mailbox = env['ERASE_REMOVAL_INBOX']
    canonical_email(mailbox)
    local, _ = mailbox.split('@')
    if len(local) > 25 or not re.fullmatch(r'[A-Za-z0-9._-]+', local):
        raise ValueError('Use an untagged removal mailbox with at most 25 simple local-part characters.')
    if personal_digest(mailbox) == data['personal_email_sha256']:
        raise ValueError('The removal mailbox must be separate from the personal inbox, including aliases.')
    if env['ERASE_IMAP_USER'].casefold() != mailbox.casefold():
        raise ValueError('IMAP login must be the dedicated mailbox address.')
    hostname(env['ERASE_IMAP_HOST'])
    hostname(env['ERASE_IMAP_AUTHSERV_ID'])
    port = env['ERASE_IMAP_PORT']
    if not port.isascii() or not port.isdigit() or not 1 <= int(port) <= 65535:
        raise ValueError('Use a valid IMAP TLS port.')
    if not re.fullmatch(r'[a-f0-9]{64}', env['ERASE_MAIL_CAPABILITY_SECRET']):
        raise ValueError('The mailbox capability secret must be generated locally.')
    return {'version': 1, 'personal_email_sha256': data['personal_email_sha256'], 'environment': dict(env)}


def _regular(path: Path) -> None:
    info = path.lstat()
    if not stat.S_ISREG(info.st_mode) or info.st_uid != os.getuid() or info.st_nlink != 1:
        raise ValueError('Mailbox files must be regular files owned by this user.')
    if stat.S_IMODE(info.st_mode) & 0o077:
        raise ValueError('Mailbox files must be private, with permissions 600.')


def safe_directory(directory: Path, *, create: bool = False) -> Path:
    root = Path(directory).expanduser().absolute()
    if any(ord(c) < 32 or ord(c) == 127 for c in str(root)):
        raise ValueError('Mailbox paths must not contain control characters.')
    if any(p.is_symlink() for p in (root, *root.parents)):
        raise ValueError('Mailbox paths must not contain symbolic links.')
    resolved, home = root.resolve(), Path.home().resolve()
    if resolved == Path(resolved.anchor) or resolved == home or resolved in home.parents:
        raise ValueError('Use a dedicated private mailbox directory.')
    if resolved == ROOT or ROOT in resolved.parents:
        raise ValueError('Keep mailbox credentials outside the source repository.')
    if not root.exists():
        if not create:
            raise ValueError('No removal mailbox configuration exists.')
        root.mkdir(parents=True, mode=0o700)
    if not root.is_dir() or root.stat().st_uid != os.getuid():
        raise ValueError('The mailbox directory must belong to this user.')
    if stat.S_IMODE(root.stat().st_mode) & 0o077:
        raise ValueError('The mailbox directory must be private, with permissions 700.')
    marker = root / MARKER
    if not marker.exists():
        if not create or any(root.iterdir()):
            raise ValueError('Refusing an unmarked or unrelated mailbox directory.')
        fd = os.open(marker, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
        with os.fdopen(fd, 'w') as stream:
            stream.write(MARKER_TEXT)
    _regular(marker)
    try:
        marker_text = marker.read_text(encoding='utf-8')
    except UnicodeError:
        raise ValueError('The mailbox directory marker is not recognized.') from None
    if marker_text != MARKER_TEXT:
        raise ValueError('The mailbox directory marker is not recognized.')
    return root


def save_config(path: Path, data: dict, *, replace: bool = False) -> Path:
    data = validate_config(data)
    path = Path(path).expanduser().absolute()
    if path.name != 'config.json':
        raise ValueError('The mailbox configuration must be named config.json.')
    root = safe_directory(path.parent, create=True)
    if path.exists() or path.is_symlink():
        _regular(path)
        if not replace:
            raise ValueError('Configuration exists. Use --replace to update it.')
    fd, temporary = tempfile.mkstemp(prefix='.mailbox-', dir=root)
    try:
        with os.fdopen(fd, 'w', encoding='utf-8') as stream:
            json.dump(data, stream, indent=2)
            stream.write('\n')
            stream.flush()
            os.fsync(stream.fileno())
        os.chmod(temporary, 0o600)
        os.replace(temporary, path)
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)
    return path


def load_config(path: Path) -> dict:
    path = Path(path).expanduser().absolute()
    if path.name != 'config.json':
        raise ValueError('The mailbox configuration must be named config.json.')
    safe_directory(path.parent)
    _regular(path)
    if path.stat().st_size > 65536:
        raise ValueError('The mailbox configuration is too large.')
    try:
        return validate_config(json.loads(path.read_text(encoding='utf-8')))
    except (UnicodeError, json.JSONDecodeError):
        raise ValueError('Invalid mailbox configuration JSON.') from None


def make_config(mailbox: str, personal_email: str, imap_host: str, authserv_id: str,
                *, port: int = 993, folder: str = 'INBOX', password: str,
                capability_secret: str | None = None) -> dict:
    canonical_email(mailbox)
    address = mailbox.casefold()
    env = {'ERASE_DEDICATED_MAILBOX': 'true', 'ERASE_REMOVAL_INBOX': address,
           'ERASE_IMAP_HOST': hostname(imap_host), 'ERASE_IMAP_PORT': str(port),
           'ERASE_IMAP_USER': address, 'ERASE_IMAP_PASSWORD': password,
           'ERASE_IMAP_AUTHSERV_ID': hostname(authserv_id), 'ERASE_IMAP_FOLDER': folder,
           'ERASE_MAIL_CAPABILITY_SECRET': capability_secret or secrets.token_hex(32)}
    return validate_config({'version': 1, 'personal_email_sha256': personal_digest(personal_email), 'environment': env})


def test_connection(data: dict) -> bool:
    """Explicit TLS login and read-only selection only. Never searches or fetches mail."""
    env = validate_config(data)['environment']
    client = None
    try:
        client = imaplib.IMAP4_SSL(env['ERASE_IMAP_HOST'], int(env['ERASE_IMAP_PORT']),
                                  ssl_context=ssl.create_default_context(), timeout=15)
        client.login(env['ERASE_IMAP_USER'], env['ERASE_IMAP_PASSWORD'])
        status, _ = client.select(env['ERASE_IMAP_FOLDER'], readonly=True)
        return status == 'OK'
    except (OSError, imaplib.IMAP4.error, ValueError):
        return False
    finally:
        if client is not None:
            try:
                client.logout()
            except (OSError, imaplib.IMAP4.error):
                pass


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--config', type=Path, default=default_config())
    parser.add_argument('--check', action='store_true', help='validate local configuration without connecting or displaying secrets')
    parser.add_argument('--test-connection', action='store_true', help='explicitly test TLS login and read-only selection, without searching or reading messages')
    parser.add_argument('--replace', action='store_true')
    parser.add_argument('--dedicated', action='store_true', help='assert this separate mailbox contains removal-related mail only')
    parser.add_argument('--mailbox')
    parser.add_argument('--personal-email')
    parser.add_argument('--imap-host')
    parser.add_argument('--authserv-id')
    parser.add_argument('--port', type=int, default=993)
    parser.add_argument('--folder', default='INBOX')
    args = parser.parse_args(argv)
    try:
        if args.check or args.test_connection:
            data = load_config(args.config)
            if args.test_connection:
                if not test_connection(data):
                    print('Dedicated mailbox connection test failed. Check provider settings and credentials privately. No messages were read and no scheduled work was started.')
                    return 1
                print('Dedicated mailbox TLS login and read-only selection succeeded. No messages were read and no scheduled work was started.')
            else:
                print('Removal mailbox configuration is valid. No connection, email or scheduled work was started.')
            return 0
        if not args.dedicated:
            raise ValueError('--dedicated is required. Use a separate mailbox containing removal-related mail only.')
        if not all((args.mailbox, args.personal_email, args.imap_host, args.authserv_id)):
            raise ValueError('Provide --mailbox, --personal-email, --imap-host and --authserv-id.')
        # Validate every non-secret field before opening the credential prompt.
        candidate = make_config(args.mailbox, args.personal_email, args.imap_host, args.authserv_id,
                                port=args.port, folder=args.folder, password='validation-only-placeholder')
        if not sys.stdin.isatty():
            raise ValueError('Run setup in your own interactive terminal. Do not pipe passwords.')
        if args.config.expanduser().exists() and not args.replace:
            raise ValueError('Configuration exists. Use --replace to update it.')
        with warnings.catch_warnings():
            warnings.simplefilter('error', getpass.GetPassWarning)
            password = getpass.getpass('Dedicated removal mailbox IMAP app password or token: ')
        candidate['environment']['ERASE_IMAP_PASSWORD'] = password
        save_config(args.config, candidate, replace=args.replace)
        print('Private removal mailbox configuration saved. No network connection or scheduled work was started.')
        print('Validate it with: python3 tools/configure_removal_mailbox.py --check')
        return 0
    except ValueError as exc:
        print('Mailbox setup could not finish: ' + str(exc))
        return 1
    except (OSError, getpass.GetPassWarning):
        print('Mailbox setup could not finish. Check private paths and the hidden terminal prompt. No connection or timer was started.')
        return 1
    except (KeyboardInterrupt, EOFError):
        print('\nMailbox setup cancelled. No connection or timer was started.')
        return 1


if __name__ == '__main__':
    raise SystemExit(main())
