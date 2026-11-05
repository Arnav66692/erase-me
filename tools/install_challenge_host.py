#!/usr/bin/env python3
"""Install or inspect a per-user Chrome bridge to local text/audio recognition.

No daemon, timer, model download, browser launch or system-wide installation is used.
Without --install, --check or --uninstall, only an installation plan is printed.
"""
from __future__ import annotations

import argparse
import json
import os
from pathlib import Path
import re
import shlex
import shutil
import stat
import sys
import tempfile

HOST_NAME = 'org.eraseme.challenge'
HOST_SCRIPT = Path(__file__).resolve().with_name('native_challenge_host.py')
MARKER = '.erase-me-challenge-host'
MARKER_TEXT = 'Erase Me per-user native challenge host.\n'
FIXED_PATH = '/usr/bin:/bin:/usr/sbin:/sbin'
TOOL_VARIABLES = {'ERASE_TESSERACT_BIN': 'tesseract', 'ERASE_FFMPEG_BIN': 'ffmpeg',
                  'ERASE_WHISPER_BIN': 'whisper-cli'}
MODEL_VARIABLE = 'ERASE_WHISPER_MODEL'


def extension_id(value: str) -> str:
    if not isinstance(value, str) or not re.fullmatch(r'[a-p]{32}', value):
        raise ValueError('Use the 32-letter extension ID shown by desktop Chrome.')
    return value


def _path(value: Path) -> Path:
    path = Path(value).expanduser().absolute()
    if any(ord(char) < 32 or ord(char) == 127 for char in str(path)) or '..' in path.parts:
        raise ValueError('Installation paths must not contain control characters or traversal.')
    return path


def _recognizer_environment(home: Path) -> dict[str, str]:
    """Resolve the operator's tools now, before a GUI browser strips the PATH."""
    environment = {}
    for variable, command in TOOL_VARIABLES.items():
        supplied = os.environ.get(variable, '').strip()
        candidate = supplied or shutil.which(command)
        environment[variable] = str(_path(Path(candidate)).resolve()) if candidate else ''
    model = os.environ.get(MODEL_VARIABLE, '').strip()
    environment[MODEL_VARIABLE] = str(_path(Path(model) if model else home / '.local/share/whisper-models/ggml-base.en.bin').resolve())
    return environment


def _wrapper(executable: str, script: str, environment: dict[str, str]) -> str:
    lines = ['#!/bin/sh', 'export PATH=' + shlex.quote(FIXED_PATH)]
    lines.extend('export ' + variable + '=' + shlex.quote(environment[variable])
                 for variable in (*TOOL_VARIABLES, MODEL_VARIABLE))
    lines.append('exec ' + shlex.quote(executable) + ' -I -B ' + shlex.quote(script))
    return '\n'.join(lines) + '\n'


def _wrapper_environment(text: str, spec: dict) -> dict[str, str] | None:
    """Read only our fixed wrapper grammar; never execute shell text to inspect it."""
    lines = text.splitlines()
    if len(lines) != 7:
        return None
    environment = {}
    try:
        for line, variable in zip(lines[2:6], (*TOOL_VARIABLES, MODEL_VARIABLE)):
            parts = shlex.split(line)
            if len(parts) != 2 or parts[0] != 'export' or not parts[1].startswith(variable + '='):
                return None
            value = parts[1][len(variable) + 1:]
            if value and (not Path(value).is_absolute() or _path(Path(value)) != Path(value)):
                return None
            if variable == MODEL_VARIABLE and not value:
                return None
            environment[variable] = value
    except ValueError:
        return None
    return environment if text == _wrapper(spec['python_path'], spec['host_script'], environment) else None


def _recognizers(environment: dict[str, str]) -> dict[str, bool]:
    available = {}
    for variable, command in TOOL_VARIABLES.items():
        candidate = environment[variable] or shutil.which(command, path=FIXED_PATH)
        available[variable] = bool(candidate and Path(candidate).is_file() and os.access(candidate, os.X_OK))
    return {'image': available['ERASE_TESSERACT_BIN'],
            'audio': available['ERASE_FFMPEG_BIN'] and available['ERASE_WHISPER_BIN']
                     and Path(environment[MODEL_VARIABLE]).is_file()}


def plan(extension: str, *, browser: str = 'chrome', platform: str | None = None,
         home: Path | None = None, python: Path | None = None) -> dict:
    extension_id(extension)
    system = platform or sys.platform
    home = _path(home if home is not None else Path.home())
    if browser not in ('chrome', 'chromium'):
        raise ValueError('Choose desktop Chrome or Chromium.')
    if system == 'darwin' and browser == 'chrome':
        parent = home / 'Library/Application Support/Google/Chrome/NativeMessagingHosts'
    elif system.startswith('linux'):
        parent = home / '.config' / ('google-chrome' if browser == 'chrome' else 'chromium') / 'NativeMessagingHosts'
    else:
        raise ValueError('Supported installations are macOS Chrome and Linux Chrome or Chromium.')
    script = _path(HOST_SCRIPT)
    executable = _path(python if python is not None else Path(sys.executable))
    if not script.is_file() or not executable.is_file() or not os.access(executable, os.X_OK):
        raise ValueError('Use an available local Python interpreter and repository checkout.')
    directory = home / '.erase-me-challenge'
    wrapper = directory / ('run-' + browser)
    manifest_path = parent / (HOST_NAME + '.json')
    recognition = _recognizer_environment(home)
    wrapper_text = _wrapper(str(executable), str(script), recognition)
    manifest = {'name': HOST_NAME, 'description': 'Erase Me local text and audio challenge recognition',
                'path': str(wrapper), 'type': 'stdio', 'allowed_origins': ['chrome-extension://' + extension + '/']}
    return {'host': HOST_NAME, 'browser': browser, 'home': str(home), 'directory': str(directory),
            'manifest_path': str(manifest_path), 'wrapper_path': str(wrapper), 'wrapper_text': wrapper_text,
            'manifest': manifest, 'python_path': str(executable), 'host_script': str(script),
            'recognizer_environment': recognition}


def _no_symlinks(path: Path) -> None:
    if any(part.is_symlink() for part in (path, *path.parents)):
        raise ValueError('Installation paths must not contain symbolic links.')


def _regular(path: Path) -> None:
    info = path.lstat()
    if (not stat.S_ISREG(info.st_mode) or info.st_uid != os.getuid() or info.st_nlink != 1
            or stat.S_IMODE(info.st_mode) & 0o077):
        raise ValueError('Native-host files must be private regular files owned by this user.')


def _directories(path: Path, home: Path, *, create: bool = False) -> bool:
    _no_symlinks(path)
    try:
        relative = path.relative_to(home)
    except ValueError:
        raise ValueError('Native-host files must stay in the current user directory.') from None
    if not home.is_dir() or home.stat().st_uid != os.getuid() or stat.S_IMODE(home.stat().st_mode) & 0o022:
        raise ValueError('The user directory must exist and belong to this user.')
    current = home
    for part in relative.parts:
        current = current / part
        if not current.exists():
            if not create:
                return False
            current.mkdir(mode=0o700)
        info = current.stat()
        if not stat.S_ISDIR(info.st_mode) or info.st_uid != os.getuid() or stat.S_IMODE(info.st_mode) & 0o022:
            raise ValueError('Installation directories must be user-owned and not writable by other users.')
    return True


def _private_directory(spec: dict, *, create: bool = False) -> bool:
    directory, home = Path(spec['directory']), Path(spec['home'])
    if not _directories(directory, home, create=create):
        return False
    if stat.S_IMODE(directory.stat().st_mode) & 0o077:
        raise ValueError('The native-host directory must have private permissions.')
    marker = directory / MARKER
    if not marker.exists():
        if not create or any(directory.iterdir()):
            raise ValueError('Refusing an unrelated or unmarked native-host directory.')
        _write(marker, MARKER_TEXT, 0o600)
    _regular(marker)
    if marker.read_text(encoding='utf-8') != MARKER_TEXT:
        raise ValueError('The native-host directory marker is not recognized.')
    return True


def _write(path: Path, text: str, mode: int) -> None:
    descriptor, temporary = tempfile.mkstemp(prefix='.erase-native-', dir=path.parent)
    try:
        os.fchmod(descriptor, mode)
        with os.fdopen(descriptor, 'w', encoding='utf-8') as stream:
            stream.write(text)
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(temporary, path)
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)


def _existing_manifest(spec: dict) -> dict | None:
    path = Path(spec['manifest_path'])
    _no_symlinks(path)
    if not path.exists():
        return None
    _regular(path)
    if path.stat().st_size > 16384:
        raise ValueError('The native-host manifest is not recognized.')
    try:
        value = json.loads(path.read_text(encoding='utf-8'))
    except (ValueError, UnicodeError):
        raise ValueError('The native-host manifest is not recognized.') from None
    if (not isinstance(value, dict) or set(value) != set(spec['manifest']) or value.get('name') != HOST_NAME
            or value.get('path') != spec['wrapper_path'] or value.get('type') != 'stdio'
            or not isinstance(value.get('allowed_origins'), list) or len(value['allowed_origins']) != 1
            or not isinstance(value['allowed_origins'][0], str)
            or not re.fullmatch(r'chrome-extension://[a-p]{32}/', value['allowed_origins'][0])):
        raise ValueError('Refusing an unrelated native-host manifest.')
    return value


def install(spec: dict, *, replace: bool = False) -> dict:
    manifest, wrapper = Path(spec['manifest_path']), Path(spec['wrapper_path'])
    previous = _existing_manifest(spec)
    _no_symlinks(wrapper)
    if wrapper.exists():
        _regular(wrapper)
    if not replace and (previous is not None or wrapper.exists()):
        raise ValueError('A native host already exists. Use --replace to update this installation.')
    _private_directory(spec, create=True)
    _directories(manifest.parent, Path(spec['home']), create=True)
    # The executable is ready before Chrome can discover its manifest.
    _write(wrapper, spec['wrapper_text'], 0o700)
    _write(manifest, json.dumps(spec['manifest'], indent=2) + '\n', 0o600)
    return {'ok': True, 'installed': True, 'host': HOST_NAME, 'browser': spec['browser'],
            'manifest_path': str(manifest), 'scheduled_work': False}


def check(spec: dict) -> dict:
    previous = _existing_manifest(spec)
    wrapper = Path(spec['wrapper_path'])
    ready = False
    recognizers = {'image': False, 'audio': False}
    if previous is not None and _private_directory(spec) and wrapper.exists():
        _no_symlinks(wrapper)
        _regular(wrapper)
        if wrapper.stat().st_size <= 16384:
            environment = _wrapper_environment(wrapper.read_text(encoding='utf-8'), spec)
            ready = previous == spec['manifest'] and environment is not None and os.access(wrapper, os.X_OK)
            if ready:
                recognizers = _recognizers(environment)
    return {'ok': True, 'installed': ready, 'host': HOST_NAME, 'browser': spec['browser'],
            'recognizers': recognizers, 'scheduled_work': False}


def uninstall(spec: dict) -> dict:
    previous = _existing_manifest(spec)
    wrapper = Path(spec['wrapper_path'])
    _no_symlinks(wrapper)
    if previous is not None and previous['allowed_origins'] != spec['manifest']['allowed_origins']:
        raise ValueError('The installed native host belongs to a different extension ID.')
    if previous is not None or wrapper.exists():
        if not _private_directory(spec):
            raise ValueError('The managed native-host directory is missing.')
        if wrapper.exists():
            _regular(wrapper)
            wrapper.unlink()
        if previous is not None:
            Path(spec['manifest_path']).unlink()
    return {'ok': True, 'installed': False, 'host': HOST_NAME, 'browser': spec['browser'], 'scheduled_work': False}


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--extension-id', required=True, help='32-letter ID from chrome://extensions')
    parser.add_argument('--browser', choices=('chrome', 'chromium'), default='chrome')
    actions = parser.add_mutually_exclusive_group()
    actions.add_argument('--install', action='store_true')
    actions.add_argument('--check', action='store_true')
    actions.add_argument('--uninstall', action='store_true')
    actions.add_argument('--dry-run', action='store_true')
    parser.add_argument('--replace', action='store_true', help='update an existing user-owned installation')
    args = parser.parse_args(argv)
    try:
        if args.replace and not args.install:
            raise ValueError('Use --replace only with --install.')
        spec = plan(args.extension_id, browser=args.browser)
        result = (install(spec, replace=args.replace) if args.install else check(spec) if args.check
                  else uninstall(spec) if args.uninstall else {'ok': True, 'dry_run': True, **spec})
    except (ValueError, OSError, UnicodeError):
        print(json.dumps({'ok': False, 'error': 'Challenge host setup could not be completed. Check the extension ID, browser and user-owned installation paths.'}))
        return 2
    print(json.dumps(result, indent=2))
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
