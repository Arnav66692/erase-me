"""Copy only public assets into the Vercel preview. Never copy private repo state."""
from pathlib import Path
import shutil

root = Path(__file__).resolve().parents[1]
destination = root / 'preview' / 'public'
destination.mkdir(exist_ok=True)
files = ['index.html', 'app.js', 'hero.js', 'styles.css']
files += ['fonts/' + p.name for p in (root / 'webapp/static/fonts').iterdir() if p.is_file() and p.suffix in ('.woff2', '.ttf', '.txt')]
for filename in files:
    target = destination / filename
    target.parent.mkdir(exist_ok=True)
    shutil.copyfile(root / 'webapp' / 'static' / filename, target)
print('Preview assets built. Public demo accepts synthetic data only.')
