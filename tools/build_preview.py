"""Build the public browser-local app and its narrowly permissioned companion."""
from pathlib import Path
import shutil
import zipfile

root = Path(__file__).resolve().parents[1]
destination = root / 'preview' / 'public'
destination.mkdir(exist_ok=True)
files = ['index.html', 'app.js', 'hero.js', 'styles.css', 'broker-routes.js',
         'workspace-core.js', 'workspace-ui.js', 'companion.html', 'companion.css']
files += ['fonts/' + p.name for p in (root / 'webapp/static/fonts').iterdir()
          if p.is_file() and p.suffix in ('.woff2', '.ttf', '.txt')]
for filename in files:
    target = destination / filename
    target.parent.mkdir(exist_ok=True)
    shutil.copyfile(root / 'webapp' / 'static' / filename, target)
page = destination / 'index.html'
scripts = ''.join(f'<script src="/{name}" defer></script>\n  '
                  for name in ('broker-routes.js', 'workspace-core.js', 'workspace-ui.js'))
page.write_text(page.read_text().replace('<html lang="en">', '<html lang="en" data-browser-workspace="true">').replace('<script src="/app.js" defer></script>',
                                       scripts + '<script src="/app.js" defer></script>'))
downloads = destination / 'downloads'
downloads.mkdir(exist_ok=True)
# Explicit allowlist. No workspace state, credentials, profiles or developer configuration.
with zipfile.ZipFile(downloads / 'erase-me-companion.zip', 'w', zipfile.ZIP_DEFLATED) as bundle:
    for name in ('manifest.json', 'background.js', 'broker-executor.js', 'bridge.js',
                 'popup.html', 'popup.css', 'popup.js'):
        bundle.write(root / 'extension' / name, name)
    bundle.write(root / 'LICENSE', 'LICENSE')
print('Public workspace built. Personal profiles stay in the browser; no server account or recurring work.')
