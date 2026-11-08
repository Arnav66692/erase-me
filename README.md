# Erase Me

Find your personal information on data brokers and public directories, prepare removal requests, and track what happened.

[![CI](https://github.com/Arnav66692/erase-me/actions/workflows/ci.yml/badge.svg)](https://github.com/Arnav66692/erase-me/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

[Open the workspace](https://erase-me-preview.vercel.app/) · [Chrome companion](https://erase-me-preview.vercel.app/companion.html) · [Documentation](docs/README.md) · [Türkçe](README.tr.md)

Erase Me combines a browser workspace, a Chrome extension and an installable agent skill. The workspace needs no account: your profile and action ledger stay in your browser. You review the information and actions before a supported form submission or privacy email.

## What it does

- Builds country-specific route plans and helps you confirm your own listings.
- Fills reviewed broker forms through a narrowly permissioned Chrome companion.
- Supports optional guarded submissions and a separate removal-only email account.
- Keeps holds, verification steps, private backups and evidence of each action separate.
- Provides an agent skill for consent records, request drafts and private reports.

The workspace catalog has 43 reference routes, with regional packs for the United States, Canada, the United Kingdom, Germany and Turkey, plus global portals. Some routes set marketing preferences rather than delete broker records. See the [integration matrix](docs/INTEGRATION_STATUS.md) for the exact scope.

**Release status:** companion 0.13.0. Form submission, email acceptance and broker deletion are different outcomes. No independently verified broker deletion has been established by this release. The [workspace reference](docs/WORKSPACE_GUIDE.md) documents supported actions, evidence levels and remaining manual steps.

## Try it

1. Open the [workspace](https://erase-me-preview.vercel.app/) and create a profile with your own details.
2. Choose your country, review the route plan and confirm your own listings.
3. Install the [Chrome companion](https://erase-me-preview.vercel.app/companion.html) for supported desktop form actions, or follow the official links manually.
4. Review each action, complete any broker verification and record the outcome.

Export a private backup before clearing browser data or changing devices. Mobile browsers support the workspace and official links; companion actions require desktop Chrome.

### Use the agent skill

```sh
npx skills add Arnav66692/erase-me --skill erase-me
```

Choose Claude Code, Codex or another supported agent. The skill engine uses Python 3.9 or newer and the standard library. In Claude Code, start a new session and use `/erase-me`. See [skill instructions](skills/erase-me/SKILL.md) for consent and execution requirements.

### Run the local app

With Python 3.10 or newer, from a repository checkout:

```sh
python3 tools/configure_service.py --local
python3 tools/run_service.py --check
python3 tools/run_service.py
```

Open [localhost:8766](http://127.0.0.1:8766). This mode uses a separate local database and starts no recurring removal schedule. See [deployment](docs/DEPLOYMENT.md) for optional services.

## Develop

Use Python 3.10+ and Node.js 22. CI runs Python 3.10 and 3.12.

```sh
python3 -m venv .venv
source .venv/bin/activate
python -m pip install pytest coverage
python tools/build_preview.py
node --test tests/*.cjs
python -m pytest -m "not network"
python skills/erase-me/scripts/erase_me.py validate
```

The browser suite includes [6,000 seeded simulation cases](docs/SIMULATION_TESTS.md). Synthetic tests establish implementation behavior; live broker outcomes require separate evidence.

| Location | Purpose |
| --- | --- |
| `webapp/static/` | Browser workspace and route catalog |
| `extension/` | Chrome companion and guarded form execution |
| `skills/erase-me/` | Agent skill, Python engine, references and templates |
| `preview/`, `tools/` | Deployment, builds and local setup |
| `tests/` | Synthetic fixtures and regression tests |

## Contribute and report issues

Read [CONTRIBUTING.md](CONTRIBUTING.md) for development and route updates. Use made-up data in issues, screenshots and fixtures. Report privacy bugs through the private process in [SECURITY.md](SECURITY.md).

## License

MIT. See [LICENSE](LICENSE), [NOTICE.md](NOTICE.md) and [third-party licenses](THIRD_PARTY_LICENSES.md) for attribution. Privacy-law references are informational. Check their official sources.

The landing follows the design language of [grail-app.com](https://grail-app.com/), rebuilt in original code. No code, fonts, images, models or copy from that site are used. The WebGL scene runs on [three.js](https://threejs.org/) r170 (MIT). The four 3D models are CC0 scans from [Poly Haven](https://polyhaven.com/).
