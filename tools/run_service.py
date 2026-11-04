#!/usr/bin/env python3
"""Check or run the local persistent service using private JSON configuration."""
from __future__ import annotations

import argparse
from email.message import EmailMessage
import imaplib
import json
import os
from pathlib import Path
import re
import shutil
import smtplib
import ssl
import subprocess
import sys
import uuid
from urllib.parse import urlsplit

from browser_adapter import _selector, allowed, form_controls
from configure_service import ROOT, default_config, load_config

# These are the fields Worker._payload can actually supply. First/last name,
# phone, address and authorization attestations are deliberately not inferred.
WORKER_FIELD_EXAMPLES = {
    'full_name': 'Fixture Person', 'name': 'Fixture Person',
    'email': 'fixture@example.invalid', 'listing_url': 'https://broker.example/listing/fixture',
    'city': 'Fixture City', 'region': 'US-CA', 'country': 'US', 'age': 30,
}


def route_structure_ready(recipe: dict, site: dict) -> bool:
    """Check the adapter's static contract without opening a browser or mailbox."""
    domain = site.get('domain')
    optout, search = site.get('optout'), site.get('search')
    if (not isinstance(optout, dict) or not isinstance(search, dict)
            or optout.get('method') != 'web_form' or domain != recipe.get('domain')
            or recipe.get('optout_url') != optout.get('url')
            or not allowed(optout.get('url'), domain)):
        return False
    template = search.get('url_template')
    if not allowed(template, domain):
        return False
    placeholders = set(re.findall(r'\{([^{}]*)\}', template))
    if placeholders - {'first', 'last', 'full', 'city', 'region', 'region_name', 'country', 'email'}:
        return False

    def selector(key):
        value = recipe.get(key)
        return _selector(value) and bool(value.strip())

    if not all(selector(key) for key in ('listing_links', 'name', 'absent', 'submit', 'success')):
        return False
    # Match the adapter's identity rule: name and either email or age plus city.
    if not (selector('email') or selector('age') and selector('city')):
        return False
    if any(key in recipe and not selector(key) for key in ('age', 'city', 'email')):
        return False
    needed = optout.get('fields_needed')
    mapping = recipe.get('fields')
    if (not isinstance(needed, list) or not needed or not all(isinstance(key, str) for key in needed)
            or len(set(needed)) != len(needed) or set(needed) - WORKER_FIELD_EXAMPLES.keys()
            or not isinstance(mapping, dict) or set(mapping) != set(needed)):
        return False
    examples = dict(WORKER_FIELD_EXAMPLES, listing_url=f'https://{domain}/listing/fixture')
    controls = form_controls(recipe, examples, needed)
    if controls is None or any(not selector_text.strip() for _, selector_text, _ in controls):
        return False
    requires = optout.get('requires', [])
    if not isinstance(requires, list) or 'id_upload' in requires or 'phone_verification' in requires:
        return False
    if 'email_verification' in requires:
        prefix = recipe.get('confirmation_path_prefix')
        if (not isinstance(prefix, str) or not prefix.startswith('/') or prefix.startswith('//')
                or not prefix.rstrip('/') or any(c.isspace() or ord(c) < 32 for c in prefix)
                or '\\' in prefix or not selector('confirmation_success')):
            return False
        parsed = urlsplit(prefix)
        if parsed.query or parsed.fragment or parsed.path != prefix or any(part in ('.', '..') for part in prefix.split('/')):
            return False
    return True


def service_environment(config: dict) -> dict:
    env = {k: v for k, v in os.environ.items() if not k.startswith('ERASE_')}
    env.update(config['environment'])
    paths = [str(Path(sys.executable).parent), str(Path.home() / '.bun/bin'),
             '/opt/homebrew/bin', '/usr/local/bin', '/usr/bin', '/bin']
    env['PATH'] = os.pathsep.join(dict.fromkeys(paths + env.get('PATH', '').split(os.pathsep)))
    env['PYTHONPATH'] = str(ROOT)
    env['PYTHONUNBUFFERED'] = '1'
    return env


def broker_readiness(path: Path) -> dict:
    """An inspected page is not an enabled route with a proven removal outcome."""
    try:
        recipes = json.loads(path.read_text(encoding='utf-8'))
        if not isinstance(recipes, dict):
            raise ValueError('Recipes must be an object.')
    except (OSError, ValueError):
        return {'name': 'live_removals_ready', 'ready': False,
                'detail': 'No readable broker recipe catalog. Run the setup command again.'}
    sites = {}
    refs = ROOT / 'skills/erase-me/references'
    for source in [*refs.glob('countries/*/*.json'), *refs.glob('global/*.json')]:
        try:
            site = json.loads(source.read_text(encoding='utf-8'))
            if isinstance(site, dict) and isinstance(site.get('id'), str):
                sites[site['id']] = site
        except (OSError, ValueError, KeyError, TypeError):
            continue
    inspected = enabled = runnable = 0
    for key, recipe in recipes.items():
        if not isinstance(recipe, dict) or not recipe.get('domain'):
            continue
        proof = recipe.get('verification', {})
        if not isinstance(proof, dict):
            proof = {}
        inspected += proof.get('inspected') is True
        enabled += recipe.get('enabled') is True
        site = sites.get(key, {})
        required = {'scan', 'submit', 'check'}
        optout = site.get('optout', {})
        if not isinstance(optout, dict):
            continue
        requires = optout.get('requires', [])
        if not isinstance(requires, list) or not all(isinstance(value, str) for value in requires):
            continue
        if 'email_verification' in requires:
            required.add('confirm')
        actions = recipe.get('supported_actions', [])
        if (not isinstance(actions, list) or not all(isinstance(action, str) for action in actions)
                or set(actions) - {'scan', 'submit', 'check', 'confirm'}):
            continue
        if (site.get('domain') == recipe['domain'] and recipe.get('enabled') is True
                and required.issubset(actions) and proof.get('live_submitted') is True
                and proof.get('removal_verified') is True and route_structure_ready(recipe, site)):
            runnable += 1
    return {'name': 'live_removals_ready', 'ready': runnable > 0,
            'detail': f'{inspected} inspected, {enabled} enabled, {runnable} complete live-tested routes. '
                      + ('Available routes can be attempted; broker acceptance is still checked per request.' if runnable
                         else 'Live removals are not ready: complete compatible selectors, approved fields and required actions, then record live submission and removal verification.')}


BROWSER_CHECKS = {'erase_me_adapter', 'erase_browse_bin', 'bun'}
ROUTE_CHECKS = {'live_removals_ready', 'email_requests_ready'}


def can_start(checks: list[dict]) -> bool:
    """Launching an email-only app does not require working browser routes."""
    by_name = {check.get('name'): check.get('ready') is True for check in checks}
    required = [check for check in checks if check.get('name') not in BROWSER_CHECKS | ROUTE_CHECKS]
    if not required or not all(check.get('ready') is True for check in required):
        return False
    if by_name.get('local_intake'):
        return True
    return bool(by_name.get('live_removals_ready') and all(by_name.get(name) for name in BROWSER_CHECKS))


def readiness(config: dict) -> list[dict]:
    env = config['environment']
    checks = []
    def add(name, ready, detail):
        checks.append({'name': name, 'ready': bool(ready), 'detail': detail})
    add('python', sys.version_info >= (3, 10), 'Python 3.10 or newer is required.')
    local_only = env.get('ERASE_LOCAL_INTAKE') == 'true'
    if local_only:
        add('local_intake', not env.get('ERASE_WEB_ORIGIN'), 'Local profiles only; no email account or inbox connection.')
    for key in (() if local_only else ('ERASE_SMTP_HOST', 'ERASE_SMTP_FROM', 'ERASE_SMTP_USER', 'ERASE_SMTP_PASSWORD',
                'ERASE_REMOVAL_INBOX', 'ERASE_IMAP_HOST', 'ERASE_IMAP_USER',
                'ERASE_IMAP_PASSWORD', 'ERASE_IMAP_AUTHSERV_ID')):
        add(key.lower(), bool(env.get(key)), 'Configured.' if env.get(key) else 'Missing; run configure_service.py --replace.')
    for key in ('ERASE_ME_ADAPTER', 'ERASE_BROWSE_BIN'):
        path = Path(env.get(key, '/nonexistent'))
        add(key.lower(), path.is_file() and os.access(path, os.X_OK), 'A local executable is required.')
    add('bun', bool(shutil.which('bun', path=service_environment(config)['PATH'])), 'gstack requires the local Bun runtime.')
    checks.append(broker_readiness(Path(env.get('ERASE_BROWSER_RECIPES', '/nonexistent'))))
    add('email_requests_ready', False, 'Email sending is disabled. Supported broker forms use the supplied address; no inbox is connected.')
    return checks


def check_connections(config: dict, *, send_test=False) -> list[dict]:
    """SMTP/IMAP auth only unless send_test explicitly requests a self-addressed message."""
    env, results = config['environment'], []
    context = ssl.create_default_context()
    try:
        use_ssl = env.get('ERASE_SMTP_SSL', 'false') == 'true'
        port = int(env.get('ERASE_SMTP_PORT', '465' if use_ssl else '587'))
        if use_ssl:
            client = smtplib.SMTP_SSL(env['ERASE_SMTP_HOST'], port, timeout=15, context=context)
        else:
            client = smtplib.SMTP(env['ERASE_SMTP_HOST'], port, timeout=15)
        with client:
            client.ehlo()
            if not use_ssl:
                client.starttls(context=context)
                client.ehlo()
            client.login(env['ERASE_SMTP_USER'], env['ERASE_SMTP_PASSWORD'])
            if send_test:
                inbox = env['ERASE_REMOVAL_INBOX']
                local, domain = inbox.split('@')
                recipient = f'{local}+erase-{uuid.uuid4().hex}@{domain}'
                message = EmailMessage()
                message['From'] = env['ERASE_SMTP_FROM']
                message['To'] = recipient
                message['Subject'] = 'Erase Me mailbox connection test'
                message.set_content('This is the connection test you requested from your local terminal.\n'
                                    'No personal information or broker removal requests were sent.\n'
                                    'Receiving this message confirms that your tagged mailbox accepts delivery.\n')
                client.send_message(message)
        results.append({'name': 'smtp_connection', 'ready': True,
                        'detail': 'Test message accepted by SMTP; check delivery in the removal inbox.' if send_test else 'TLS and login succeeded; no email sent.'})
    except (KeyError, OSError, smtplib.SMTPException, ValueError):
        results.append({'name': 'smtp_connection', 'ready': False,
                        'detail': 'SMTP check failed. Verify hostname, port, TLS mode and app credentials locally.'})
    client = None
    try:
        client = imaplib.IMAP4_SSL(env['ERASE_IMAP_HOST'], int(env.get('ERASE_IMAP_PORT', '993')),
                                  ssl_context=context, timeout=15)
        client.login(env['ERASE_IMAP_USER'], env['ERASE_IMAP_PASSWORD'])
        status, _ = client.select(env.get('ERASE_IMAP_FOLDER', 'INBOX'), readonly=True)
        if status != 'OK':
            raise ValueError('Mailbox unavailable.')
        results.append({'name': 'imap_connection', 'ready': True, 'detail': 'TLS, login and read-only mailbox selection succeeded.'})
    except (KeyError, OSError, imaplib.IMAP4.error, ValueError):
        results.append({'name': 'imap_connection', 'ready': False,
                        'detail': 'IMAP check failed. Verify hostname, mailbox and app credentials locally.'})
    finally:
        if client is not None:
            try:
                client.logout()
            except (OSError, imaplib.IMAP4.error):
                pass
    return results


def command(config: dict) -> list[str]:
    args = [sys.executable, '-m', 'webapp.server', '--manual']
    if config['environment'].get('ERASE_LOCAL_INTAKE') == 'true':
        args.append('--local')
    return args + ['--host', '127.0.0.1', '--port', str(config['port'])]


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--config', type=Path, default=default_config())
    parser.add_argument('--check', action='store_true', help='inspect local settings without starting the server')
    parser.add_argument('--check-connections', action='store_true', help='also test TLS/email logins; does not send mail')
    parser.add_argument('--send-test', action='store_true', help='send a single test to the configured removal inbox')
    parser.add_argument('--json', action='store_true', help='print readiness as JSON; never starts the server')
    args = parser.parse_args()
    try:
        config = load_config(args.config)
        checks = readiness(config)
        if (args.check_connections or args.send_test) and config['environment'].get('ERASE_LOCAL_INTAKE') == 'true':
            raise ValueError('Local mode does not connect to an inbox or send test emails.')
        if args.check_connections or args.send_test:
            checks += check_connections(config, send_test=args.send_test)
        checking = args.check or args.check_connections or args.send_test or args.json
        if checking or not can_start(checks):
            if args.json:
                print(json.dumps({'ready': can_start(checks),
                                  'live_removals_ready': next(item['ready'] for item in checks if item['name'] == 'live_removals_ready'),
                                  'email_requests_ready': next(item['ready'] for item in checks if item['name'] == 'email_requests_ready'),
                                  'manual': True, 'checks': checks}, indent=2))
            else:
                for item in checks:
                    print(f"{'OK' if item['ready'] else 'NEEDS SETUP'} {item['name']}: {item['detail']}")
            if checking:
                return 0 if can_start(checks) else 1
            print('Live service not started. Resolve setup checks first.')
            return 1
        print(f"Starting the live local app at http://127.0.0.1:{config['port']}. Recurring checks are off. Use Run check in the dashboard when you want work to run.", flush=True)
        return subprocess.call(command(config), cwd=ROOT, env=service_environment(config))
    except (ValueError, OSError) as exc:
        if args.json:
            print(json.dumps({'ready': False, 'live_removals_ready': False,
                              'checks': [{'name': 'configuration', 'ready': False, 'detail': str(exc)}]}, indent=2))
        else:
            print(f'Service not started: {exc}')
        return 1
    except KeyboardInterrupt:
        return 130


if __name__ == '__main__':
    raise SystemExit(main())
