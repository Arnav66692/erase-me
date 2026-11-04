"""Local recognizer contracts. No model download, network, or paid provider calls."""
import os
from pathlib import Path
import signal
import stat
import subprocess
import sys
import time

import pytest

import captcha_provider as provider
from captcha_provider import CaptchaUnavailable, solve_audio, solve_image


def png(width=240, height=80):
    return (b'\x89PNG\r\n\x1a\n' + (13).to_bytes(4, 'big') + b'IHDR'
            + width.to_bytes(4, 'big') + height.to_bytes(4, 'big') + b'\x08\x02\x00\x00\x00' + b'\x00' * 4)


def jpeg(width=240, height=80):
    return b'\xff\xd8\xff\xc0\x00\x08\x08' + height.to_bytes(2, 'big') + width.to_bytes(2, 'big') + b'\x01\xff\xd9'


@pytest.fixture
def binaries(monkeypatch, tmp_path):
    monkeypatch.setattr(provider, '_binary', lambda _variable, command: command)
    model = tmp_path / 'model.bin'
    model.write_bytes(b'fake test model')
    monkeypatch.setattr(provider, '_model', lambda: model)


@pytest.mark.parametrize('data', [png(), jpeg()])
def test_image_uses_private_file_and_returns_text(monkeypatch, binaries, data):
    seen = []
    def run(command, deadline):
        path = Path(command[1])
        assert path.read_bytes() == data
        assert stat.S_IMODE(path.stat().st_mode) == 0o600
        assert stat.S_IMODE(path.parent.stat().st_mode) == 0o700
        assert '--psm' in command and command[command.index('--psm') + 1] == '7'
        assert deadline > time.monotonic()
        seen.append(path)
        return ' A7B9C\n'
    monkeypatch.setattr(provider, '_run', run)
    assert solve_image(data) == 'A7B9C'
    assert not seen[0].exists()
    assert not seen[0].parent.exists()


def test_whitelist_is_one_argument_and_enforced(monkeypatch, binaries):
    calls = []
    monkeypatch.setattr(provider, '_run', lambda command, deadline: calls.append(command) or '1234')
    assert solve_image(png(), alphabet='0123456789') == '1234'
    assert calls[0][-1] == 'tessedit_char_whitelist=0123456789'
    with pytest.raises(CaptchaUnavailable):
        solve_image(png(), alphabet='ABC')


@pytest.mark.parametrize('alphabet', ['x;whoami', '\n', 'é', 'A' * 81, ['a']])
def test_invalid_alphabet_refused(alphabet):
    with pytest.raises(CaptchaUnavailable):
        solve_image(png(), alphabet=alphabet)


@pytest.mark.parametrize('data', [b'', b'GIF89a', b'<?xml anything>', 'not bytes', b'a' * (provider.MAX_MEDIA_BYTES + 1), png(0, 1), png(5000, 20), png(2500, 2500), b'\xff\xd8\xff\xc0\xff\xff'])
def test_invalid_or_oversized_image_refused(data):
    with pytest.raises(CaptchaUnavailable):
        solve_image(data)


@pytest.mark.parametrize('timeout', [0, -1, True, float('nan'), float('inf'), 61, '15'])
def test_invalid_timeout_refused(timeout):
    with pytest.raises(CaptchaUnavailable):
        solve_image(png(), timeout=timeout)


@pytest.mark.parametrize('result', ['', 'A' * 65, '[no text]', 'abc\x00def'])
def test_unusable_ocr_result_refused(monkeypatch, binaries, result):
    monkeypatch.setattr(provider, '_run', lambda *args: result)
    with pytest.raises(CaptchaUnavailable):
        solve_image(png())


@pytest.mark.parametrize('data', [b'RIFF\x00\x00\x00\x00WAVEpayload', b'ID3payload', b'\xff\xfbpayload', b'OggSpayload'])
def test_audio_conversion_and_transcript(monkeypatch, binaries, data):
    calls, paths = [], []
    def run(command, deadline):
        calls.append((command, deadline))
        if command[0] == 'ffmpeg':
            source = Path(command[command.index('-i') + 1])
            assert source.read_bytes() == data
            paths.append(source)
            Path(command[-1]).write_bytes(b'RIFF output')
            assert command[command.index('-protocol_whitelist') + 1] == 'file,pipe'
            assert command[command.index('-t') + 1] == '30'
            assert command[command.index('-ar') + 1] == '16000'
        else:
            path = Path(command[command.index('-of') + 1]).with_suffix('.txt')
            path.write_text(' seven birds\n fly north. \n')
            assert command[command.index('-l') + 1] == 'en'
            assert '-nt' in command and '-ng' not in command
        return ''
    monkeypatch.setattr(provider, '_run', run)
    assert solve_audio(data) == 'seven birds fly north.'
    assert calls[0][1] == calls[1][1]  # One deadline for both processes.
    assert not paths[0].exists()


@pytest.mark.parametrize('data', [b'', b'RIFFnot-wav', b'<html>hi', b'file:///etc/passwd', b'a' * (provider.MAX_MEDIA_BYTES + 1)])
def test_non_audio_refused(data):
    with pytest.raises(CaptchaUnavailable):
        solve_audio(data)


def test_blank_audio_is_not_success(monkeypatch, binaries):
    def run(command, deadline):
        if command[0] == 'ffmpeg':
            Path(command[-1]).write_bytes(b'RIFF output')
        else:
            Path(command[command.index('-of') + 1]).with_suffix('.txt').write_text('[BLANK_AUDIO]')
        return ''
    monkeypatch.setattr(provider, '_run', run)
    with pytest.raises(CaptchaUnavailable, match='No usable speech'):
        solve_audio(b'RIFF\x00\x00\x00\x00WAVEpayload')


def test_missing_tools_do_not_fallback_to_cloud(monkeypatch):
    monkeypatch.setattr(provider.shutil, 'which', lambda _: None)
    for key in ('ERASE_TESSERACT_BIN', 'ERASE_WHISPER_BIN', 'ERASE_FFMPEG_BIN'):
        monkeypatch.delenv(key, raising=False)
    assert provider.capabilities() == {'image': False, 'audio': False}
    with pytest.raises(CaptchaUnavailable, match='Install tesseract'):
        solve_image(png())


def test_configured_model_path_must_exist(monkeypatch, tmp_path):
    monkeypatch.setenv('ERASE_WHISPER_MODEL', str(tmp_path / 'missing.bin'))
    with pytest.raises(CaptchaUnavailable):
        provider._model()


def test_command_output_is_bounded_and_failure_is_generic():
    deadline = time.monotonic() + 5
    assert provider._run([sys.executable, '-c', 'print("abc")'], deadline) == 'abc\n'
    with pytest.raises(CaptchaUnavailable, match='too much text'):
        provider._run([sys.executable, '-c', 'print("a"*5000)'], deadline)
    with pytest.raises(CaptchaUnavailable, match='could not process'):
        provider._run([sys.executable, '-c', 'raise SystemExit(1)'], deadline)


def test_timeout_kills_whole_process_group(monkeypatch):
    killed = []
    class Child:
        pid = 12345
        returncode = None
        def wait(self, timeout=None):
            if timeout is not None:
                raise subprocess.TimeoutExpired('test', timeout)
            self.returncode = -9
    monkeypatch.setattr(provider.subprocess, 'Popen', lambda *args, **kwargs: Child())
    monkeypatch.setattr(provider.os, 'killpg', lambda pid, sig: killed.append((pid, sig)))
    with pytest.raises(CaptchaUnavailable, match='timed out'):
        provider._run(['unused'], time.monotonic() + 1)
    assert killed == [(12345, signal.SIGKILL)]


def test_timeout_cleans_private_files(monkeypatch, binaries):
    paths = []
    def run(command, deadline):
        paths.append(Path(command[1]))
        raise CaptchaUnavailable('Local recognition timed out.')
    monkeypatch.setattr(provider, '_run', run)
    with pytest.raises(CaptchaUnavailable):
        solve_image(png())
    assert not paths[0].parent.exists()
