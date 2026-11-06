#!/usr/bin/env python3
"""Install the per-user, on-demand Chrome removal-only mail connector.

Without an explicit action this prints a plan. No account is created, credential is
read, Google request is made or recurring job is installed by this utility.
"""
from __future__ import annotations

import argparse
import json
import os
from pathlib import Path
import shlex
import stat
import sys

import install_challenge_host as files
import native_mail_host as host

HOST_SCRIPT = Path(__file__).resolve().with_name('native_mail_host.py')
FIXED_PATH = '/usr/bin:/bin:/usr/sbin:/sbin'


def plan(extension: str, *, browser='chrome', platform=None, home=None, python=None):
    files.extension_id(extension)
    system = platform or sys.platform
    home = files._path(Path.home() if home is None else Path(home))
    if browser not in ('chrome', 'chromium'):
        raise ValueError('Choose desktop Chrome or Chromium.')
    if system == 'darwin' and browser == 'chrome':
        parent = home / 'Library/Application Support/Google/Chrome/NativeMessagingHosts'
    elif system.startswith('linux'):
        parent = home / '.config' / ('google-chrome' if browser == 'chrome' else 'chromium') / 'NativeMessagingHosts'
    else:
        raise ValueError('Use macOS Chrome or Linux Chrome/Chromium.')
    executable = files._path(Path(sys.executable) if python is None else Path(python))
    script = files._path(HOST_SCRIPT)
    if not script.is_file() or not executable.is_file() or not os.access(executable, os.X_OK):
        raise ValueError('Keep the checkout and a local Python interpreter available.')
    directory = home / host.STATE_DIRECTORY
    wrapper = directory / ('run-' + browser)
    origin = 'chrome-extension://' + extension + '/'
    wrapper_text = ('#!/bin/sh\nexport PATH=' + shlex.quote(FIXED_PATH) + '\nexec '
                    + shlex.quote(str(executable)) + ' -I -B ' + shlex.quote(str(script)) + ' "$@"\n')
    manifest = {'name': host.HOST_NAME, 'description': 'Erase Me local, dedicated removal-only Gmail connector',
                'path': str(wrapper), 'type': 'stdio', 'allowed_origins': [origin]}
    return {'host': host.HOST_NAME, 'home': str(home), 'browser': browser, 'directory': str(directory),
            'wrapper_path': str(wrapper), 'wrapper_text': wrapper_text,
            'manifest_path': str(parent / (host.HOST_NAME + '.json')), 'manifest': manifest,
            'origin': origin, 'scheduled_work': False}


def _manifest(spec):
    path = Path(spec['manifest_path'])
    files._no_symlinks(path)
    if not path.exists():
        return None
    files._regular(path)
    if path.stat().st_size > 16384:
        raise ValueError('The native-host manifest is not recognized.')
    value = json.loads(path.read_text(encoding='utf-8'))
    if (not isinstance(value, dict) or set(value) != set(spec['manifest'])
            or value['name'] != host.HOST_NAME or value['path'] != spec['wrapper_path'] or value['type'] != 'stdio'
            or not isinstance(value['allowed_origins'], list) or len(value['allowed_origins']) != 1
            or not isinstance(value['allowed_origins'][0], str) or not host.ORIGIN.fullmatch(value['allowed_origins'][0])):
        raise ValueError('Refusing an unrelated native-host manifest.')
    return value


def _registration(spec):
    path = Path(spec['directory']) / 'allowed-origin.json'
    files._no_symlinks(path)
    if not path.exists():
        return None
    host._regular(path)
    if path.stat().st_size > 1024:
        raise ValueError('The native-host registration is not recognized.')
    value = json.loads(path.read_text(encoding='utf-8'))
    if (not isinstance(value, dict) or set(value) != {'version', 'origin'}
            or type(value['version']) is not int or value['version'] != 1
            or not isinstance(value['origin'], str) or not host.ORIGIN.fullmatch(value['origin'])):
        raise ValueError('Refusing an unrelated native-host registration.')
    return value


def install(spec, *, replace=False):
    home, directory, wrapper = Path(spec['home']), Path(spec['directory']), Path(spec['wrapper_path'])
    previous = _manifest(spec)
    files._no_symlinks(wrapper)
    registration = _registration(spec)
    if wrapper.exists():
        files._regular(wrapper)
    if not replace and (previous is not None or wrapper.exists() or registration is not None):
        raise ValueError('A connector already exists. Use --replace to update it.')
    files._directories(directory.parent, home, create=True)
    host.state_directory(home, create=True)
    files._directories(Path(spec['manifest_path']).parent, home, create=True)
    files._write(wrapper, spec['wrapper_text'], 0o700)
    files._write(directory / 'allowed-origin.json', json.dumps({'version': 1, 'origin': spec['origin']}) + '\n', 0o600)
    files._write(Path(spec['manifest_path']), json.dumps(spec['manifest'], indent=2) + '\n', 0o600)
    return {'ok': True, 'installed': True, 'host': host.HOST_NAME, 'browser': spec['browser'], 'scheduled_work': False}


def check(spec):
    previous = _manifest(spec)
    wrapper = Path(spec['wrapper_path'])
    files._no_symlinks(wrapper)
    ready = False
    if previous is not None and wrapper.exists():
        host.state_directory(Path(spec['home']))
        files._regular(wrapper)
        ready = (previous == spec['manifest'] and _registration(spec) == {'version': 1, 'origin': spec['origin']}
                 and stat.S_IMODE(wrapper.stat().st_mode) == 0o700 and wrapper.stat().st_size <= 16384
                 and wrapper.read_text(encoding='utf-8') == spec['wrapper_text'] and os.access(wrapper, os.X_OK))
    return {'ok': True, 'installed': ready, 'host': host.HOST_NAME, 'browser': spec['browser'], 'scheduled_work': False}


def uninstall(spec):
    previous = _manifest(spec)
    registration = _registration(spec)
    if (previous is not None and previous['allowed_origins'] != spec['manifest']['allowed_origins']
            or registration is not None and registration['origin'] != spec['origin']):
        raise ValueError('The connector is registered to a different extension.')
    if previous is not None or registration is not None or Path(spec['wrapper_path']).exists():
        host.state_directory(Path(spec['home']))
        for path in (Path(spec['manifest_path']), Path(spec['wrapper_path']), Path(spec['directory']) / 'allowed-origin.json'):
            files._no_symlinks(path)
            if path.exists():
                files._regular(path)
                path.unlink()
    return {'ok': True, 'installed': False, 'host': host.HOST_NAME, 'browser': spec['browser'],
            'private_mail_data_retained': True, 'scheduled_work': False}


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--extension-id', required=True)
    parser.add_argument('--browser', choices=('chrome', 'chromium'), default='chrome')
    actions = parser.add_mutually_exclusive_group()
    actions.add_argument('--install', action='store_true')
    actions.add_argument('--check', action='store_true')
    actions.add_argument('--uninstall', action='store_true')
    actions.add_argument('--dry-run', action='store_true')
    parser.add_argument('--replace', action='store_true')
    args = parser.parse_args(argv)
    try:
        if args.replace and not args.install:
            raise ValueError()
        spec = plan(args.extension_id, browser=args.browser)
        result = (install(spec, replace=args.replace) if args.install else check(spec) if args.check
                  else uninstall(spec) if args.uninstall else {'ok': True, 'dry_run': True, **spec})
    except (ValueError, OSError, UnicodeError, host.MailHostError):
        print(json.dumps({'ok': False, 'error': 'Local removal-mail setup could not be completed. Check the extension ID and private installation paths.'}))
        return 2
    print(json.dumps(result, indent=2))
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
