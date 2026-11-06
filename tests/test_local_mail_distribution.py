"""The public native-mail source download must work without a git checkout."""
import json
from pathlib import Path
import subprocess
import sys
import zipfile


ROOT = Path(__file__).resolve().parents[1]
MEMBERS = {
    'tools/setup_removal_mail.py', 'tools/mail_setup_web.py',
    'tools/mail_setup_ui.html', 'tools/mail_setup_ui.js', 'tools/mail_setup_ui.css',
    'tools/setup-removal-mail.command', 'tools/setup-removal-mail.sh',
    'tools/native_mail_host.py', 'tools/removal_sender.py', 'tools/install_mail_host.py',
    'tools/install_challenge_host.py', 'tools/connect_removal_gmail.py',
    'tools/configure_removal_mailbox.py', 'preview/lib/removal_mail.py',
    'docs/LOCAL_REMOVAL_MAIL.md', 'docs/GMAIL_OAUTH.md', 'LICENSE',
}


def test_local_mail_download_has_only_sources_and_can_plan_without_credentials(tmp_path):
    subprocess.run([sys.executable, '-B', str(ROOT / 'tools/build_preview.py')],
                   cwd=ROOT, check=True, capture_output=True)
    with zipfile.ZipFile(ROOT / 'preview/public/downloads/erase-me-local-mail.zip') as bundle:
        assert set(bundle.namelist()) == MEMBERS
        for name in MEMBERS:
            assert bundle.read(name) == (ROOT / name).read_bytes()
        bundle.extractall(tmp_path / 'download')
    private_home = tmp_path / 'isolated-user'
    private_home.mkdir()
    # Dependency injection isolates state without replacing the user's HOME.
    code = """
import json, sys
from pathlib import Path
sys.path.insert(0, sys.argv[1])
import install_mail_host
spec = install_mail_host.plan('a' * 32, home=Path(sys.argv[2]))
print(json.dumps({'host': spec['host'], 'scheduled_work': spec['scheduled_work']}))
"""
    result = subprocess.run(
        [sys.executable, '-B', '-c', code, str(tmp_path / 'download/tools'), str(private_home)],
        check=True, capture_output=True, text=True,
    )
    assert json.loads(result.stdout) == {'host': 'org.eraseme.mail', 'scheduled_work': False}
    assert list(private_home.iterdir()) == []
    send_code = """
import json, sys
from pathlib import Path
sys.path.insert(0, sys.argv[1])
import native_mail_host as native
import removal_sender
home = Path(sys.argv[2])
origin = 'chrome-extension://' + 'a' * 32 + '/'
directory = native.state_directory(home, create=True)
native._write_new(directory / 'allowed-origin.json', json.dumps({'version': 1, 'origin': origin}))
def missing_config(_path):
    raise OSError('isolated no-credentials fixture')
host = native.NativeMailHost(origin, home=home, loader=missing_config)
result = host.handle({'action': 'send-status', 'workspace_id': 'b' * 32,
                      'personal_email_sha256': 'c' * 64, 'authorized': True})
print(json.dumps(result))
"""
    native_home = tmp_path / 'isolated-native-user'
    native_home.mkdir(mode=0o700)
    result = subprocess.run(
        [sys.executable, '-I', '-B', '-c', send_code, str(tmp_path / 'download/tools'), str(native_home)],
        check=True, capture_output=True, text=True,
    )
    status = json.loads(result.stdout)
    assert status['configured'] is False
    assert status['send_enabled'] is False
    assert status['automatic_execution'] is False
    assert len(status['routes']) == 7
    assert not (native_home / '.erase-me-removal-mail').exists()
    result = subprocess.run(
        [sys.executable, '-B', str(tmp_path / 'download/tools/connect_removal_gmail.py'), '--help'],
        check=True, capture_output=True, text=True,
    )
    assert '--client-json' in result.stdout
    result = subprocess.run(
        [sys.executable, '-B', str(tmp_path / 'download/tools/setup_removal_mail.py'), '--help'],
        check=True, capture_output=True, text=True,
    )
    assert '--extension-id' in result.stdout
    result = subprocess.run(
        [sys.executable, '-I', '-B', str(tmp_path / 'download/tools/mail_setup_web.py'), '--help'],
        check=True, capture_output=True, text=True,
    )
    assert '--extension-id' in result.stdout
    assert (tmp_path / 'download/tools/setup-removal-mail.command').read_text().startswith('#!/bin/sh')
    assert list(private_home.iterdir()) == []


def test_local_transport_loads_after_validator_and_before_workspace_controls():
    page = (ROOT / 'preview/public/index.html').read_text()
    assert page.index('src="/removal-mail-client.js"') < page.index('src="/local-removal-mail.js"')
    assert page.index('src="/local-removal-mail.js"') < page.index('src="/workspace-ui.js"')


def test_public_send_scripts_and_companion_bundle_match_source():
    page = (ROOT / 'preview/public/index.html').read_text()
    ordered = ['send-contract.js', 'workspace-core.js', 'local-removal-mail.js',
               'removal-send.js', 'removal-send-dialog.js', 'workspace-ui.js']
    positions = [page.index('src="/' + name + '"') for name in ordered]
    assert positions == sorted(positions)
    for name in ('send-contract.js', 'removal-send.js', 'removal-send-dialog.js'):
        source = ROOT / ('extension' if name == 'send-contract.js' else 'webapp/static') / name
        assert (ROOT / 'preview/public' / name).read_bytes() == source.read_bytes()
    with zipfile.ZipFile(ROOT / 'preview/public/downloads/erase-me-companion.zip') as bundle:
        assert len(bundle.namelist()) == 18
        assert bundle.read('send-contract.js') == (ROOT / 'extension/send-contract.js').read_bytes()
