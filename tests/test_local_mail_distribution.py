"""The public native-mail source download must work without a git checkout."""
import json
from pathlib import Path
import subprocess
import sys
import zipfile


ROOT = Path(__file__).resolve().parents[1]
MEMBERS = {
    'tools/native_mail_host.py', 'tools/install_mail_host.py',
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
    result = subprocess.run(
        [sys.executable, '-B', str(tmp_path / 'download/tools/connect_removal_gmail.py'), '--help'],
        check=True, capture_output=True, text=True,
    )
    assert '--client-json' in result.stdout


def test_local_transport_loads_after_validator_and_before_workspace_controls():
    page = (ROOT / 'preview/public/index.html').read_text()
    assert page.index('src="/removal-mail-client.js"') < page.index('src="/local-removal-mail.js"')
    assert page.index('src="/local-removal-mail.js"') < page.index('src="/workspace-ui.js"')
