"""Installer tests use temporary homes and never change a real Chrome profile."""
import json
import os
from pathlib import Path
import shlex
import stat
import struct
import subprocess
import sys

import pytest

import install_challenge_host as installer

EXTENSION = 'abcdefghijklmnop' * 2


@pytest.fixture
def spec(tmp_path):
    home = tmp_path / 'synthetic-home'
    home.mkdir(mode=0o700)
    return installer.plan(EXTENSION, home=home, platform='darwin')


@pytest.mark.parametrize('system,browser,subpath', [
    ('darwin', 'chrome', 'Library/Application Support/Google/Chrome/NativeMessagingHosts'),
    ('linux', 'chrome', '.config/google-chrome/NativeMessagingHosts'),
    ('linux', 'chromium', '.config/chromium/NativeMessagingHosts'),
])
def test_plan_is_user_scoped_origin_exact_and_has_no_side_effects(tmp_path, system, browser, subpath):
    home = tmp_path / 'synthetic-home'
    home.mkdir()
    value = installer.plan(EXTENSION, home=home, platform=system, browser=browser)
    assert Path(value['manifest_path']) == home / subpath / (installer.HOST_NAME + '.json')
    assert value['manifest']['allowed_origins'] == ['chrome-extension://' + EXTENSION + '/']
    assert value['manifest']['type'] == 'stdio'
    assert value['manifest']['path'] == value['wrapper_path']
    assert installer.HOST_NAME == 'org.eraseme.challenge'
    assert list(home.iterdir()) == []


@pytest.mark.parametrize('extension', ['', 'a' * 31, 'a' * 33, 'q' * 32, 'A' * 32, 'a' * 31 + ';', '../' + 'a' * 32, 'https://example.test'])
def test_invalid_extension_ids_fail_without_creating_files(tmp_path, extension):
    with pytest.raises(ValueError):
        installer.plan(extension, home=tmp_path, platform='darwin')
    assert list(tmp_path.iterdir()) == []


@pytest.mark.parametrize('system,browser', [('win32', 'chrome'), ('darwin', 'chromium'), ('freebsd', 'chrome'), ('linux', 'firefox')])
def test_unsupported_platforms_and_browsers_are_not_installed(tmp_path, system, browser):
    with pytest.raises(ValueError):
        installer.plan(EXTENSION, home=tmp_path, platform=system, browser=browser)
    assert list(tmp_path.iterdir()) == []


def test_install_sets_private_permissions_check_is_read_only_and_uninstall_is_bounded(spec):
    assert installer.check(spec)['installed'] is False
    assert not Path(spec['directory']).exists()
    result = installer.install(spec)
    assert result['installed'] is True and result['scheduled_work'] is False
    manifest, wrapper, directory = (Path(spec[key]) for key in ('manifest_path', 'wrapper_path', 'directory'))
    assert json.loads(manifest.read_text()) == spec['manifest']
    assert wrapper.read_text() == spec['wrapper_text']
    assert stat.S_IMODE(manifest.stat().st_mode) == 0o600
    assert stat.S_IMODE(wrapper.stat().st_mode) == 0o700
    assert stat.S_IMODE(directory.stat().st_mode) == 0o700
    assert installer.check(spec)['installed'] is True
    unrelated = manifest.parent / 'unrelated.json'
    unrelated.write_text('keep')
    assert installer.uninstall(spec)['installed'] is False
    assert not manifest.exists() and not wrapper.exists()
    assert unrelated.read_text() == 'keep'
    assert installer.uninstall(spec)['installed'] is False


def test_replacement_is_explicit_and_may_update_the_allowed_extension(spec):
    installer.install(spec)
    with pytest.raises(ValueError, match='--replace'):
        installer.install(spec)
    changed = installer.plan('b' * 32, home=Path(spec['home']), platform='darwin')
    assert installer.check(changed)['installed'] is False
    with pytest.raises(ValueError, match='different extension'):
        installer.uninstall(changed)
    installer.install(changed, replace=True)
    assert installer.check(changed)['installed'] is True


@pytest.mark.parametrize('kind', ['wrapper', 'manifest', 'directory', 'ancestor', 'marker'])
def test_symbolic_links_are_rejected(spec, tmp_path, kind):
    installer.install(spec)
    path = Path(spec['wrapper_path'] if kind == 'wrapper' else spec['manifest_path'] if kind == 'manifest' else spec['directory'])
    if kind == 'marker':
        path = Path(spec['directory']) / installer.MARKER
    if kind == 'ancestor':
        path = Path(spec['home']) / 'Library'
    target = tmp_path / 'moved'
    path.rename(target)
    path.symlink_to(target, target_is_directory=target.is_dir())
    with pytest.raises(ValueError):
        installer.install(spec, replace=True)


def test_unmarked_directory_and_unrelated_manifest_are_not_adopted(spec):
    directory = Path(spec['directory'])
    directory.mkdir(mode=0o700)
    keep = directory / 'important.txt'
    keep.write_text('keep')
    with pytest.raises(ValueError, match='unmarked'):
        installer.install(spec)
    assert keep.read_text() == 'keep'
    keep.unlink()
    installer.install(spec)
    manifest = Path(spec['manifest_path'])
    unrelated = dict(spec['manifest'], path='/unrelated/executable')
    manifest.write_text(json.dumps(unrelated))
    with pytest.raises(ValueError, match='unrelated'):
        installer.install(spec, replace=True)
    assert json.loads(manifest.read_text()) == unrelated


@pytest.mark.parametrize('kind,mode', [('wrapper', 0o755), ('manifest', 0o644), ('directory', 0o755)])
def test_insecure_permissions_are_rejected(spec, kind, mode):
    installer.install(spec)
    path = Path(spec['wrapper_path'] if kind == 'wrapper' else spec['manifest_path'] if kind == 'manifest' else spec['directory'])
    path.chmod(mode)
    with pytest.raises(ValueError):
        installer.install(spec, replace=True)


def test_hard_linked_wrapper_is_not_overwritten(spec, tmp_path):
    installer.install(spec)
    os.link(spec['wrapper_path'], tmp_path / 'hardlink')
    with pytest.raises(ValueError):
        installer.install(spec, replace=True)


def test_shell_metacharacters_are_single_quoted_literal_arguments(tmp_path, monkeypatch):
    home = tmp_path / "home with ' apostrophe $(touch PWNED)"
    home.mkdir(mode=0o700)
    fake_python = tmp_path / "python with ' apostrophe $(touch PWNED)"
    recorded = tmp_path / 'arguments.json'
    fake_python.write_text('#!' + sys.executable + '\nimport json,sys\nfrom pathlib import Path\nPath(' + repr(str(recorded)) + ').write_text(json.dumps(sys.argv[1:]))\n')
    fake_python.chmod(0o700)
    script = tmp_path / "source with ' quote $(touch PWNED)" / 'native_challenge_host.py'
    script.parent.mkdir()
    script.write_text('')
    monkeypatch.setattr(installer, 'HOST_SCRIPT', script)
    value = installer.plan(EXTENSION, home=home, platform='linux', python=fake_python)
    assert shlex.split(value['wrapper_text'].splitlines()[-1]) == ['exec', str(fake_python), '-I', '-B', str(script)]
    installer.install(value)
    result = subprocess.run([value['wrapper_path']], cwd=tmp_path, capture_output=True, timeout=5)
    assert result.returncode == 0
    assert json.loads(recorded.read_text()) == ['-I', '-B', str(script)]
    assert not (tmp_path / 'PWNED').exists()


def test_control_characters_in_paths_are_rejected_before_creation(tmp_path):
    home = tmp_path / 'bad\npath'
    with pytest.raises(ValueError, match='control'):
        installer.plan(EXTENSION, home=home, platform='darwin')
    assert not home.exists()


def test_cli_defaults_to_dry_run_and_does_not_install(spec, monkeypatch, capsys):
    monkeypatch.setattr(installer, 'plan', lambda *_args, **_kwargs: spec)
    assert installer.main(['--extension-id', EXTENSION]) == 0
    value = json.loads(capsys.readouterr().out)
    assert value['dry_run'] is True
    assert not Path(spec['directory']).exists()
    assert installer.main(['--extension-id', EXTENSION, '--replace']) == 2
    assert json.loads(capsys.readouterr().out)['ok'] is False


def native_capabilities(wrapper, environment):
    message = b'{"action":"capabilities"}'
    response = subprocess.run([wrapper], input=struct.pack('<I', len(message)) + message,
                              capture_output=True, timeout=5, env=environment)
    assert response.returncode == 0 and response.stderr == b''
    size = struct.unpack('<I', response.stdout[:4])[0]
    assert size == len(response.stdout) - 4
    return json.loads(response.stdout[4:])['capabilities']


def test_gui_launch_uses_setup_pinned_tools_under_a_sanitized_path(tmp_path, monkeypatch):
    home = tmp_path / 'synthetic-home'
    home.mkdir(mode=0o700)
    tools = tmp_path / "tools with ' quote $(touch PWNED)"
    tools.mkdir()
    for command in installer.TOOL_VARIABLES.values():
        path = tools / command
        path.write_text('#!/bin/sh\nexit 0\n')
        path.chmod(0o700)
    model = tools / "model with ' quote $(touch PWNED).bin"
    model.write_bytes(b'synthetic model')
    for variable in installer.TOOL_VARIABLES:
        monkeypatch.delenv(variable, raising=False)
    monkeypatch.setenv('PATH', str(tools))
    monkeypatch.setenv('ERASE_WHISPER_MODEL', str(model))
    value = installer.plan(EXTENSION, home=home, platform='darwin')
    installer.install(value)
    sanitized = {'PATH': '/usr/bin:/bin', **{variable: '/unrelated/missing' for variable in installer.TOOL_VARIABLES},
                 'ERASE_WHISPER_MODEL': '/unrelated/missing-model'}
    assert native_capabilities(value['wrapper_path'], sanitized) == {'image': True, 'audio': True}
    assert not (tmp_path / 'PWNED').exists()
    (tools / 'tesseract').unlink()
    model.unlink()
    assert native_capabilities(value['wrapper_path'], sanitized) == {'image': False, 'audio': False}
    assert installer.check(value)['recognizers'] == {'image': False, 'audio': False}


def test_explicit_operator_paths_are_pinned_and_check_reads_installed_configuration(tmp_path, monkeypatch):
    home = tmp_path / 'synthetic-home'
    home.mkdir(mode=0o700)
    tools = tmp_path / 'explicit-tools'
    tools.mkdir()
    executable = tools / 'recognizer'
    executable.write_text('#!/bin/sh\nexit 0\n')
    executable.chmod(0o700)
    for variable in installer.TOOL_VARIABLES:
        monkeypatch.setenv(variable, str(executable))
    model = tools / 'model.bin'
    model.write_bytes(b'synthetic')
    monkeypatch.setenv(installer.MODEL_VARIABLE, str(model))
    value = installer.plan(EXTENSION, home=home, platform='darwin')
    assert set(value['recognizer_environment'].values()) == {str(executable), str(model)}
    installer.install(value)
    for variable in (*installer.TOOL_VARIABLES, installer.MODEL_VARIABLE):
        monkeypatch.delenv(variable, raising=False)
    monkeypatch.setenv('PATH', '/usr/bin:/bin')
    checked = installer.plan(EXTENSION, home=home, platform='darwin')
    assert installer.check(checked)['installed'] is True
    assert installer.check(checked)['recognizers'] == {'image': True, 'audio': True}


def test_unavailable_pinned_tool_is_truthful_and_unrelated_wrapper_commands_are_rejected(tmp_path, monkeypatch):
    home = tmp_path / 'synthetic-home'
    home.mkdir(mode=0o700)
    for variable in installer.TOOL_VARIABLES:
        monkeypatch.setenv(variable, str(tmp_path / 'unavailable'))
    monkeypatch.setenv(installer.MODEL_VARIABLE, str(tmp_path / 'missing-model'))
    value = installer.plan(EXTENSION, home=home, platform='darwin')
    installer.install(value)
    assert installer.check(value)['recognizers'] == {'image': False, 'audio': False}
    wrapper = Path(value['wrapper_path'])
    wrapper.write_text(value['wrapper_text'] + 'touch /unrelated/path\n')
    assert installer.check(value)['installed'] is False


def test_operator_path_control_characters_are_rejected_without_installation(tmp_path, monkeypatch):
    monkeypatch.setenv('ERASE_TESSERACT_BIN', str(tmp_path / 'bad\nrecognizer'))
    with pytest.raises(ValueError, match='control'):
        installer.plan(EXTENSION, home=tmp_path, platform='darwin')
    assert list(tmp_path.iterdir()) == []
