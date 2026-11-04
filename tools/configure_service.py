#!/usr/bin/env python3
"""Private, terminal-only service configuration. Passwords never appear in output."""
from __future__ import annotations

import argparse
import getpass
import json
import os
from pathlib import Path
import re
import stat
import sys
import tempfile
from urllib.parse import urlsplit
import warnings

ROOT = Path(__file__).resolve().parents[1]
MARKER = '.erase-me-service'
FILENAME = 'config.json'
ENV_KEYS = frozenset({
    'ERASE_LOCAL_INTAKE', 'ERASE_WEB_HOME', 'ERASE_WEB_ORIGIN', 'ERASE_SMTP_HOST', 'ERASE_SMTP_PORT',
    'ERASE_SMTP_FROM', 'ERASE_SMTP_USER', 'ERASE_SMTP_PASSWORD', 'ERASE_SMTP_SSL',
    'ERASE_REMOVAL_INBOX', 'ERASE_IMAP_HOST', 'ERASE_IMAP_PORT', 'ERASE_IMAP_USER',
    'ERASE_IMAP_PASSWORD', 'ERASE_IMAP_AUTHSERV_ID', 'ERASE_IMAP_FOLDER',
    'ERASE_ME_ADAPTER', 'ERASE_BROWSE_BIN', 'ERASE_BROWSER_RECIPES',
    'ERASE_TESSERACT_BIN', 'ERASE_WHISPER_BIN', 'ERASE_FFMPEG_BIN', 'ERASE_WHISPER_MODEL',
})
PATH_KEYS = frozenset({'ERASE_WEB_HOME', 'ERASE_ME_ADAPTER', 'ERASE_BROWSE_BIN',
                       'ERASE_BROWSER_RECIPES', 'ERASE_TESSERACT_BIN', 'ERASE_WHISPER_BIN',
                       'ERASE_FFMPEG_BIN', 'ERASE_WHISPER_MODEL'})
HOST_RE = re.compile(r'(?=.{1,253}\Z)[A-Za-z0-9](?:[A-Za-z0-9.-]*[A-Za-z0-9])?\Z')
EMAIL_RE = re.compile(r'[A-Za-z0-9.!#$%&\'*+/=?^_`{|}~-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\Z')


def default_config() -> Path:
    return Path.home() / '.erase-me-service' / FILENAME


def _owned_regular(path: Path) -> None:
    info = path.lstat()
    if not stat.S_ISREG(info.st_mode) or info.st_uid != os.getuid() or info.st_nlink != 1:
        raise ValueError('Service files must be regular files owned by the current user.')


def safe_directory(directory: Path, *, create=False) -> Path:
    root = Path(directory).expanduser().absolute()
    if any(ord(c) < 32 or ord(c) == 127 for c in str(root)):
        raise ValueError('Service directory paths must not contain control characters.')
    for part in (root, *root.parents):
        if part.is_symlink():
            raise ValueError('Service configuration paths must not contain symbolic links.')
    resolved, home = root.resolve(), Path.home().resolve()
    if resolved == Path(resolved.anchor) or resolved == home or resolved in home.parents:
        raise ValueError('Use a dedicated private service directory.')
    if resolved == ROOT or ROOT in resolved.parents:
        raise ValueError('Keep service credentials outside the code repository.')
    if not root.exists():
        if not create:
            raise ValueError('No service configuration exists. Run configure_service.py first.')
        root.mkdir(mode=0o700, parents=True)
    if not root.is_dir() or root.stat().st_uid != os.getuid():
        raise ValueError('Service directory must belong to the current user.')
    marker = root / MARKER
    if not marker.exists():
        if not create or any(root.iterdir()):
            raise ValueError('Refusing an unmarked nonempty service directory.')
        fd = os.open(marker, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
        with os.fdopen(fd, 'w') as stream:
            stream.write('Private Erase Me service configuration.\n')
    _owned_regular(marker)
    if create:
        os.chmod(root, 0o700)
        os.chmod(marker, 0o600)
    elif stat.S_IMODE(root.stat().st_mode) & 0o077:
        raise ValueError('Service directory must be private (chmod 700).')
    return root


def validate_config(data: object) -> dict:
    if (not isinstance(data, dict) or set(data) != {'version', 'port', 'environment'}
            or type(data.get('version')) is not int or data.get('version') != 1):
        raise ValueError('Invalid service configuration structure.')
    port = data.get('port')
    if type(port) is not int or not 1024 <= port <= 65535:
        raise ValueError('The local service port must be between 1024 and 65535.')
    environment = data.get('environment')
    if not isinstance(environment, dict) or not set(environment).issubset(ENV_KEYS):
        raise ValueError('Configuration contains unsupported environment keys.')
    result = {}
    for key, value in environment.items():
        if not isinstance(value, str) or len(value) > 4096 or any(ord(c) < 32 or ord(c) == 127 for c in value):
            raise ValueError(f'{key} must be one line of text without control characters.')
        if not value:
            continue
        if key in PATH_KEYS:
            value = str(Path(value).expanduser())
            if not Path(value).is_absolute():
                raise ValueError(f'{key} must be an absolute path.')
        if key in {'ERASE_SMTP_HOST', 'ERASE_IMAP_HOST', 'ERASE_IMAP_AUTHSERV_ID'}:
            if not HOST_RE.fullmatch(value) or '..' in value or any(not segment for segment in value.split('.')):
                raise ValueError(f'{key} must be a hostname, not a URL.')
        if key in {'ERASE_SMTP_FROM', 'ERASE_REMOVAL_INBOX'} and not EMAIL_RE.fullmatch(value):
            raise ValueError(f'{key} must be a bare email address without a display name.')
        if key == 'ERASE_REMOVAL_INBOX':
            local = value.split('@')[0]
            if '+' in local or len(local) > 25 or not re.fullmatch(r'[A-Za-z0-9._-]+', local):
                raise ValueError('Use an untagged removal mailbox with a local part of at most 25 simple characters.')
        if key in {'ERASE_SMTP_PORT', 'ERASE_IMAP_PORT'} and (not value.isdigit() or not 1 <= int(value) <= 65535):
            raise ValueError(f'{key} must be a valid port number.')
        if key == 'ERASE_LOCAL_INTAKE' and value not in {'true', 'false'}:
            raise ValueError('ERASE_LOCAL_INTAKE must be true or false.')
        if key == 'ERASE_SMTP_SSL' and value not in {'true', 'false'}:
            raise ValueError('ERASE_SMTP_SSL must be true or false.')
        if key == 'ERASE_WEB_ORIGIN':
            try:
                parsed = urlsplit(value)
                origin_port = parsed.port
            except ValueError:
                raise ValueError('ERASE_WEB_ORIGIN must be a bare HTTPS origin.') from None
            if (parsed.scheme != 'https' or not parsed.hostname or parsed.username or parsed.password
                    or parsed.path not in ('', '/') or parsed.query or parsed.fragment
                    or origin_port is not None and not 1 <= origin_port <= 65535):
                raise ValueError('ERASE_WEB_ORIGIN must be a bare HTTPS origin.')
        result[key] = value
    if result.get('ERASE_LOCAL_INTAKE') == 'true' and result.get('ERASE_WEB_ORIGIN'):
        raise ValueError('Local profiles cannot be exposed at a public origin.')
    return {'version': 1, 'port': port, 'environment': result}


def save_config(path: Path, data: dict, *, replace=False) -> Path:
    data = validate_config(data)
    path = Path(path).expanduser().absolute()
    if path.name != FILENAME:
        raise ValueError('Service configuration must be named config.json.')
    root = safe_directory(path.parent, create=True)
    if path.exists() or path.is_symlink():
        _owned_regular(path)
        if not replace:
            raise ValueError('Configuration already exists. Use --replace to update it.')
    fd, temporary = tempfile.mkstemp(prefix='.config-', dir=root)
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
    safe_directory(path.parent)
    if path.name != FILENAME or not path.exists():
        raise ValueError('No config.json found. Run configure_service.py first.')
    _owned_regular(path)
    if stat.S_IMODE(path.stat().st_mode) & 0o077 or path.stat().st_size > 65536:
        raise ValueError('Configuration must be a private file (chmod 600), at most 64 KiB.')
    try:
        return validate_config(json.loads(path.read_text(encoding='utf-8')))
    except (UnicodeError, json.JSONDecodeError):
        raise ValueError('Invalid service configuration JSON.') from None


def auto_environment() -> dict:
    env = {'ERASE_WEB_HOME': str(Path.home() / '.erase-me-web'),
           'ERASE_ME_ADAPTER': str(ROOT / 'tools/browser_adapter.py'),
           'ERASE_BROWSER_RECIPES': str(ROOT / 'config/broker-recipes.json')}
    candidates = [Path.home() / '.agents/skills/gstack/browse/dist/browse',
                  Path.home() / '.codex/skills/gstack/browse/dist/browse']
    for candidate in candidates:
        if candidate.is_file() and os.access(candidate, os.X_OK):
            env['ERASE_BROWSE_BIN'] = str(candidate)
            break
    model = Path.home() / '.local/share/whisper-models/ggml-base.en.bin'
    if model.is_file():
        env['ERASE_WHISPER_MODEL'] = str(model)
    return env


def prompt_config(existing=None, *, ask=input, secret=getpass.getpass) -> dict:
    current = existing or {'version': 1, 'port': 8766, 'environment': auto_environment()}
    env = dict(current['environment'])
    print('Enter credentials only in this local terminal. Password input is hidden.')
    print('Use your provider’s SMTP/IMAP settings and a dedicated removal mailbox.')
    fields = [('ERASE_SMTP_FROM', 'Sending email address', ''),
              ('ERASE_SMTP_HOST', 'SMTP hostname', ''),
              ('ERASE_SMTP_PORT', 'SMTP port', '587'),
              ('ERASE_SMTP_SSL', 'Implicit SMTP TLS (true for 465; false for STARTTLS)', 'false'),
              ('ERASE_SMTP_USER', 'SMTP login username', ''),
              ('ERASE_REMOVAL_INBOX', 'Dedicated removal inbox (must support plus addressing)', ''),
              ('ERASE_IMAP_HOST', 'IMAP hostname', ''),
              ('ERASE_IMAP_PORT', 'IMAP TLS port', '993'),
              ('ERASE_IMAP_USER', 'IMAP login username', ''),
              ('ERASE_IMAP_AUTHSERV_ID', 'Trusted Authentication-Results server ID from your provider', '')]
    for key, label, default in fields:
        sender = env.get('ERASE_SMTP_FROM', '').rsplit('@', 1)[-1].lower()
        if sender in ('gmail.com', 'googlemail.com'):
            default = {'ERASE_SMTP_HOST': 'smtp.gmail.com', 'ERASE_SMTP_PORT': '465',
                       'ERASE_SMTP_SSL': 'true', 'ERASE_SMTP_USER': env['ERASE_SMTP_FROM'],
                       'ERASE_IMAP_HOST': 'imap.gmail.com', 'ERASE_IMAP_PORT': '993',
                       'ERASE_IMAP_AUTHSERV_ID': 'mx.google.com'}.get(key, default)
        if key == 'ERASE_IMAP_USER':
            default = env.get('ERASE_REMOVAL_INBOX', default)
        value = env.get(key, default)
        answer = ask(f'{label}' + (f' [{value}]' if value else '') + ': ').strip()
        env[key] = answer or value
    for key, label in [('ERASE_SMTP_PASSWORD', 'SMTP app password/token'), ('ERASE_IMAP_PASSWORD', 'IMAP app password/token')]:
        answer = secret(label + (' [press Enter to keep existing]' if env.get(key) else '') + ': ')
        env[key] = answer or env.get(key, '')
    return validate_config({'version': 1, 'port': current['port'], 'environment': env})


def prompt_gmail(address: str, existing=None, *, secret=getpass.getpass) -> dict:
    """One-password setup for one person's own Gmail removal pilot."""
    if (not EMAIL_RE.fullmatch(address) or address.rsplit('@', 1)[-1].lower()
            not in ('gmail.com', 'googlemail.com')):
        raise ValueError('--gmail requires a bare Gmail address.')
    current = existing or {'version': 1, 'port': 8766, 'environment': auto_environment()}
    env = dict(current['environment'])
    same_login = (env.get('ERASE_SMTP_USER', '').casefold() == address.casefold()
                  and env.get('ERASE_IMAP_USER', '').casefold() == address.casefold())
    keep_existing = same_login and env.get('ERASE_SMTP_PASSWORD') and env.get('ERASE_IMAP_PASSWORD')
    env.update({'ERASE_SMTP_FROM': address, 'ERASE_SMTP_HOST': 'smtp.gmail.com',
                'ERASE_SMTP_PORT': '465', 'ERASE_SMTP_SSL': 'true', 'ERASE_SMTP_USER': address,
                'ERASE_REMOVAL_INBOX': address, 'ERASE_IMAP_HOST': 'imap.gmail.com',
                'ERASE_IMAP_PORT': '993', 'ERASE_IMAP_USER': address,
                'ERASE_IMAP_AUTHSERV_ID': 'mx.google.com'})
    validate_config({'version': 1, 'port': current['port'], 'environment': env})
    print('Single-user Gmail pilot: this mailbox is used only for its owner’s removals.')
    print('Enter a provider-issued app password in this local terminal. Input is hidden.')
    password = secret('Gmail app password' + (' [press Enter to keep existing]' if keep_existing else '') + ': ')
    if password:
        env['ERASE_SMTP_PASSWORD'] = password
        env['ERASE_IMAP_PASSWORD'] = password
    elif not keep_existing:
        raise ValueError('An app password is required for a new Gmail connection; nothing was saved.')
    return validate_config({'version': 1, 'port': current['port'], 'environment': env})


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--config', type=Path, default=default_config())
    parser.add_argument('--replace', action='store_true')
    parser.add_argument('--port', type=int, default=None)
    modes = parser.add_mutually_exclusive_group()
    modes.add_argument('--local', action='store_true', help='local profiles without connecting any email account')
    modes.add_argument('--gmail', metavar='EMAIL', help='single-user Gmail pilot; asks once for an app password locally')
    args = parser.parse_args()
    try:
        if not args.local and not sys.stdin.isatty():
            raise ValueError('Run this command in your own interactive terminal; do not pipe credentials.')
        exists = args.config.expanduser().exists()
        if exists and not args.replace:
            raise ValueError('Configuration already exists. Use --replace to update it.')
        existing = load_config(args.config) if exists else None
        with warnings.catch_warnings():
            warnings.simplefilter('error', getpass.GetPassWarning)
            if args.local:
                env = auto_environment()
                if existing:
                    env.update({k: v for k, v in existing['environment'].items() if k in PATH_KEYS})
                if not existing or existing['environment'].get('ERASE_LOCAL_INTAKE') != 'true':
                    env['ERASE_WEB_HOME'] = str(Path.home() / '.erase-me-web-local')
                env['ERASE_LOCAL_INTAKE'] = 'true'
                config = {'version': 1, 'port': existing['port'] if existing else 8766, 'environment': env}
            else:
                config = prompt_gmail(args.gmail, existing) if args.gmail else prompt_config(existing)
        if args.port is not None:
            config['port'] = args.port
        path = save_config(args.config, config, replace=args.replace)
    except (ValueError, OSError) as exc:
        print(f'Configuration not saved: {exc}')
        return 1
    except (KeyboardInterrupt, EOFError):
        print('\nConfiguration cancelled; no changes saved.')
        return 1
    except getpass.GetPassWarning:
        print('Configuration not saved: this terminal cannot hide password input.')
        return 1
    print(f'Private configuration saved to {path}. No emails were sent and no service was started.')
    print('Recurring checks are off. Next: python3 tools/run_service.py --check')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
