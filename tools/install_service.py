#!/usr/bin/env python3
"""Generate or explicitly install/start a per-user persistent Erase Me service."""
from __future__ import annotations

import argparse
import os
from pathlib import Path
import plistlib
import platform
import subprocess
import sys
import tempfile

from configure_service import ROOT, default_config, load_config, safe_directory, _owned_regular
from run_service import readiness, can_start

LABEL = 'org.erase-me.worker'


def arguments(config_path: Path) -> list[str]:
    return [str(Path(sys.executable).resolve()), str(ROOT / 'tools/run_service.py'), '--config', str(config_path)]


def manifest(config_path: Path, system: str) -> tuple[str, bytes]:
    args = arguments(config_path)
    if any(ord(c) < 32 or ord(c) == 127 for value in [*args, str(ROOT)] for c in value):
        raise ValueError('Service command paths must not contain control characters.')
    if system == 'Darwin':
        return LABEL + '.plist', plistlib.dumps({
            'Label': LABEL, 'ProgramArguments': args, 'WorkingDirectory': str(ROOT),
            'RunAtLoad': True, 'KeepAlive': {'SuccessfulExit': False}, 'ThrottleInterval': 60,
            'ProcessType': 'Background', 'Umask': 0o077,
        })
    if system == 'Linux':
        # systemd uses its own quoting and %-specifier expansion, not shell syntax.
        def quote(value, *, command_argument=False):
            value = value.replace('\\', '\\\\').replace('"', '\\"').replace('%', '%%')
            if command_argument:
                value = value.replace('$', '$$')
            return '"' + value + '"'
        text = ('[Unit]\nDescription=Erase Me local removal worker\nAfter=network-online.target\n\n'
                '[Service]\nType=simple\nExecStart=' + ' '.join(quote(v, command_argument=True) for v in args) + '\n'
                'WorkingDirectory=' + quote(str(ROOT)) + '\nRestart=on-failure\nRestartSec=60\nUMask=0077\n'
                '\n[Install]\nWantedBy=default.target\n')
        return LABEL + '.service', text.encode()
    raise ValueError('Service manifests currently support macOS launchd and Linux systemd.')


def write_private(path: Path, content: bytes, *, replace=False) -> None:
    if path.exists() or path.is_symlink():
        _owned_regular(path)
        if not replace:
            raise ValueError('A service manifest already exists. Use --replace after reviewing it.')
    fd, temporary = tempfile.mkstemp(prefix='.manifest-', dir=path.parent)
    try:
        with os.fdopen(fd, 'wb') as handle:
            os.fchmod(handle.fileno(), 0o600)
            handle.write(content)
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(temporary, path)
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)


def install_directory(system: str) -> Path:
    directory = Path.home() / ('Library/LaunchAgents' if system == 'Darwin' else '.config/systemd/user')
    for entry in (directory, *directory.parents):
        if entry.is_symlink():
            raise ValueError('The service install path must not contain symbolic links.')
    directory.mkdir(parents=True, exist_ok=True, mode=0o700)
    if directory.stat().st_uid != os.getuid():
        raise ValueError('The service install directory must belong to this user.')
    return directory


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--config', type=Path, default=default_config())
    parser.add_argument('--platform', choices=['Darwin', 'Linux'], default=platform.system())
    parser.add_argument('--install', action='store_true', help='copy into the current user service manager directory')
    parser.add_argument('--start', action='store_true', help='start the installed service now (requires --install)')
    parser.add_argument('--replace', action='store_true')
    args = parser.parse_args()
    try:
        if args.start and not args.install:
            raise ValueError('--start requires --install.')
        if args.install and args.platform != platform.system():
            raise ValueError('Cannot install a manifest for a different operating system.')
        path = args.config.expanduser().absolute()
        config = load_config(path)
        if args.start and not can_start(readiness(config)):
            raise ValueError('Run run_service.py --check and resolve all setup checks before starting.')
        name, content = manifest(path, args.platform)
        target = (install_directory(args.platform) if args.install else safe_directory(path.parent)) / name
        write_private(target, content, replace=args.replace)
        print(f'Manifest written to {target}. Credentials are referenced privately, never embedded.')
        if not args.install:
            print('Nothing installed or started. Review this file, then pass --install and optionally --start.')
            return 0
        if args.platform == 'Linux':
            subprocess.run(['systemctl', '--user', 'daemon-reload'], check=True)
            subprocess.run(['systemctl', '--user', 'enable', name], check=True)
            if args.start:
                subprocess.run(['systemctl', '--user', 'start', name], check=True)
        elif args.start:
            subprocess.run(['launchctl', 'bootstrap', f'gui/{os.getuid()}', str(target)], check=True)
        print('Service installed' + (' and start requested.' if args.start else '; it has not been started now.'))
        return 0
    except (ValueError, OSError, subprocess.CalledProcessError) as exc:
        print(f'Service setup stopped: {exc}')
        return 1


if __name__ == '__main__':
    raise SystemExit(main())
