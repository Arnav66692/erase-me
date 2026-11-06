"""Build the public browser-local app and its narrowly permissioned companion."""
from pathlib import Path
import shutil
import zipfile

root = Path(__file__).resolve().parents[1]
destination = root / 'preview' / 'public'
destination.mkdir(exist_ok=True)
files = ['index.html', 'app.js', 'hero.js', 'styles.css', 'broker-audit.js', 'broker-routes.js',
         'footprint-planner.js', 'workspace-core.js', 'removal-mail-client.js', 'local-removal-mail.js', 'removal-send.js', 'removal-send-dialog.js', 'removal-session.js', 'contact-setup.js', 'next-steps.js', 'form-batch.js', 'identity-dialog.js', 'peopletrace-dialog.js', 'cma-dialog.js', 'mylife-dialog.js', 'thatsthem-dialog.js', 'peoplefinders-dialog.js', 'footprint-ui.js', 'workspace-ui.js', 'companion.html', 'companion.css']
files += ['fonts/' + p.name for p in (root / 'webapp/static/fonts').iterdir()
          if p.is_file() and p.suffix in ('.woff2', '.ttf', '.txt')]
for filename in files:
    target = destination / filename
    target.parent.mkdir(exist_ok=True)
    shutil.copyfile(root / 'webapp' / 'static' / filename, target)
shutil.copyfile(root / 'extension' / 'send-contract.js', destination / 'send-contract.js')
shutil.copyfile(root / 'extension' / 'automatic-executor.js', destination / 'automatic-executor.js')
shutil.copyfile(root / 'extension' / 'identity-details.js', destination / 'identity-details.js')
shutil.copyfile(root / 'extension' / 'peopletrace-details.js', destination / 'peopletrace-details.js')
shutil.copyfile(root / 'extension' / 'cma-details.js', destination / 'cma-details.js')
shutil.copyfile(root / 'extension' / 'mylife-details.js', destination / 'mylife-details.js')
shutil.copyfile(root / 'extension' / 'thatsthem-details.js', destination / 'thatsthem-details.js')
shutil.copyfile(root / 'extension' / 'peoplefinders-details.js', destination / 'peoplefinders-details.js')
page = destination / 'index.html'
scripts = ''.join(f'<script src="/{name}" defer></script>\n  '
                  for name in ('broker-audit.js', 'broker-routes.js', 'identity-details.js', 'peopletrace-details.js', 'cma-details.js', 'mylife-details.js', 'thatsthem-details.js', 'peoplefinders-details.js', 'footprint-planner.js', 'send-contract.js', 'workspace-core.js', 'removal-mail-client.js', 'local-removal-mail.js', 'removal-send.js', 'removal-send-dialog.js', 'automatic-executor.js', 'removal-session.js', 'contact-setup.js', 'next-steps.js', 'form-batch.js', 'identity-dialog.js', 'peopletrace-dialog.js', 'cma-dialog.js', 'mylife-dialog.js', 'thatsthem-dialog.js', 'peoplefinders-dialog.js', 'footprint-ui.js', 'workspace-ui.js'))
page.write_text(page.read_text().replace('id="signup-email" name="email" type="email"', 'id="signup-email" name="email" type="text" inputmode="email"').replace('<html lang="en">', '<html lang="en" data-browser-workspace="true">').replace('<script src="/app.js" defer></script>',
                                       scripts + '<script src="/app.js" defer></script>'))
downloads = destination / 'downloads'
downloads.mkdir(exist_ok=True)
# Explicit allowlist. No workspace state, credentials, profiles or developer configuration.
with zipfile.ZipFile(downloads / 'erase-me-companion.zip', 'w', zipfile.ZIP_DEFLATED) as bundle:
    for name in ('manifest.json', 'send-contract.js', 'background.js', 'broker-executor.js', 'automatic-executor.js', 'record-matcher.js', 'identity-details.js', 'final-executor.js', 'peopletrace-details.js', 'cma-details.js', 'mylife-details.js', 'thatsthem-details.js', 'peoplefinders-details.js', 'bridge.js',
                 'popup.html', 'popup.css', 'popup.js'):
        bundle.write(root / 'extension' / name, name)
    bundle.write(root / 'LICENSE', 'LICENSE')
# Standalone source distribution for the optional per-user native mail connector.
# Keep the engine's relative layout; credentials and local grants are never packaged.
with zipfile.ZipFile(downloads / 'erase-me-local-mail.zip', 'w', zipfile.ZIP_DEFLATED) as bundle:
    for name in ('tools/setup_removal_mail.py', 'tools/mail_setup_web.py',
                 'tools/mail_setup_ui.html', 'tools/mail_setup_ui.js', 'tools/mail_setup_ui.css',
                 'tools/setup-removal-mail.command', 'tools/setup-removal-mail.sh',
                 'tools/native_mail_host.py', 'tools/removal_sender.py', 'tools/install_mail_host.py',
                 'tools/install_challenge_host.py', 'tools/connect_removal_gmail.py',
                 'tools/configure_removal_mailbox.py', 'preview/lib/removal_mail.py',
                 'docs/LOCAL_REMOVAL_MAIL.md', 'docs/GMAIL_OAUTH.md', 'LICENSE'):
        bundle.write(root / name, name)
print('Public workspace built. Personal profiles stay in the browser; no server account or recurring work.')
