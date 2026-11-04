#!/usr/bin/env python3
"""Recipe-based gstack browser adapter. Recipes are trusted operator configuration.

No broad auto-clicking: unknown page layouts return unsupported. CAPTCHA answers
use local OCR/speech tools; unsupported challenges remain blocked.
"""
from __future__ import annotations

import json
import os
from pathlib import Path
import subprocess
import sys
import time
from urllib.parse import urlparse

from captcha_browser import ensure_clear
from mailbox_adapter import find_confirmation
import pdl_adapter

VISIBILITY_JS = '''
  const visible=e => {
    if(!e || !e.getClientRects().length) return false;
    for(let n=e;n;n=n.parentElement){
      if(n.hidden || n.getAttribute('aria-hidden')==='true') return false;
      const s=getComputedStyle(n);
      if(s.display==='none' || s.visibility==='hidden' || s.visibility==='collapse' ||
         s.contentVisibility==='hidden' || Number(s.opacity)===0) return false;
    }
    return Array.from(e.getClientRects()).some(r=>r.width>0 && r.height>0);
  };
  const shown=s => !!s && Array.from(document.querySelectorAll(s)).some(visible);
'''


def allowed(url, domain):
    if not isinstance(url, str) or not isinstance(domain, str) or not domain:
        return False
    try:
        p = urlparse(url)
        host = p.hostname or ''
        return (p.scheme == 'https' and not p.username and not p.password
                and not any(c.isspace() for c in url) and p.port in (None, 443)
                and (host == domain or host.endswith('.' + domain)))
    except ValueError:
        return False


class Browser:
    def __init__(self):
        self.deadline = time.monotonic() + 75
        self.binary = os.environ.get('ERASE_BROWSE_BIN', '')
        if not Path(self.binary).is_file():
            raise ValueError('Configure ERASE_BROWSE_BIN.')
        self.env = dict(os.environ)
        root = Path(os.environ.get('ERASE_WEB_HOME', '~/.erase-me-web')).expanduser()
        root.mkdir(mode=0o700, parents=True, exist_ok=True)
        # Never share the user's active browsing daemon or logged-in profile.
        self.env['BROWSE_STATE_FILE'] = str(root / 'browser-state.json')
        self.env['PATH'] = str(Path.home() / '.bun/bin') + os.pathsep + self.env.get('PATH', '')

    def run(self, *args):
        remaining = self.deadline - time.monotonic()
        if remaining <= 0:
            raise subprocess.TimeoutExpired('browser adapter', 75)
        result = subprocess.run([self.binary, *args], env=self.env, capture_output=True,
                                text=True, timeout=min(40, remaining), check=True)
        return result.stdout.strip()

    def js(self, expression):
        # gstack wraps top-level await in an async function. Return explicitly so
        # Promise results are serialized only after the browser operation finishes.
        return json.loads(self.run('js', 'return JSON.stringify(await (' + expression + '));'))

    def goto(self, url, domain):
        if not allowed(url, domain):
            raise ValueError('URL outside approved broker domain.')
        self.run('goto', url)
        if not allowed(self.run('url'), domain):
            raise ValueError('Broker redirected outside approved domain.')


def inspect(browser, recipe):
    """Extract only approved fields. No page prose is interpreted as instructions."""
    return browser.js('(() => {' + VISIBILITY_JS + 'const r=' + json.dumps(recipe) + ''';
      const text=s => s ? Array.from(document.querySelectorAll(s)).find(visible)?.textContent?.trim() || '' : '';
      const captcha=document.querySelector('.g-recaptcha[data-sitekey],.cf-turnstile[data-sitekey]');
      return {name:text(r.name),age:text(r.age),city:text(r.city),email:text(r.email),
        absent:shown(r.absent), success:shown(r.success),
        id_required:!!document.querySelector('input[type="file"]'),
        captcha:captcha ? {kind:captcha.classList.contains('cf-turnstile')?'turnstile':'recaptcha',
          sitekey:captcha.dataset.sitekey,callback:captcha.dataset.callback || ''} : null};
    })()''')


def visible_selector(browser, selector):
    return browser.js('(() => {' + VISIBILITY_JS + 'return shown(' + json.dumps(selector) + ');})()') is True


def _selector(value):
    return isinstance(value, str) and 0 < len(value) <= 500 and not any(ord(c) < 32 for c in value)


def form_controls(recipe, fields, allowed_fields):
    """Validate the entire declarative form plan before touching any control."""
    mapping = recipe.get('fields')
    fixed = recipe.get('controls', [])
    if (not isinstance(mapping, dict) or not mapping or not isinstance(fixed, list)
            or not isinstance(fields, dict) or not isinstance(allowed_fields, list)):
        return None
    result = []
    for key, spec in mapping.items():
        if key not in allowed_fields or key not in fields:
            return None
        spec = {'selector': spec, 'control': 'fill'} if isinstance(spec, str) else spec
        if not isinstance(spec, dict) or set(spec) - {'selector', 'control', 'value_map'}:
            return None
        control, selector, value = spec.get('control', 'fill'), spec.get('selector'), fields[key]
        if control not in ('fill', 'select', 'checkbox') or not _selector(selector):
            return None
        if 'value_map' in spec:
            values = spec['value_map']
            if control != 'select' or not isinstance(values, dict) or str(value) not in values:
                return None
            value = values[str(value)]
        if control == 'checkbox':
            if type(value) is not bool:
                return None
        elif type(value) not in (str, int) or not 0 < len(str(value)) <= 2048:
            return None
        result.append((control, selector, value))
    for spec in fixed:
        if not isinstance(spec, dict) or not _selector(spec.get('selector')):
            return None
        control = spec.get('control')
        if control == 'select' and set(spec) == {'control', 'selector', 'value'}:
            value = spec['value']
            if not isinstance(value, str) or not 0 < len(value) <= 200:
                return None
        elif control == 'checkbox' and set(spec) == {'control', 'selector', 'checked'}:
            value = spec['checked']
            if type(value) is not bool:
                return None
        else:
            return None
        result.append((control, spec['selector'], value))
    if len({s for _, s, _ in result}) != len(result):
        return None
    # Static form choices happen first; any redirect they cause is checked before
    # a user's data is entered. Payload fields remain restricted to fields_needed.
    return result[len(mapping):] + result[:len(mapping)]


def apply_control(browser, control, selector, value):
    state = browser.js('(() => {' + VISIBILITY_JS + 'const e=document.querySelector(' + json.dumps(selector) + ''');
      return e ? {visible:visible(e),disabled:!!e.disabled,tag:e.tagName.toLowerCase(),
        type:(e.type||'').toLowerCase(),checked:!!e.checked} : null;})()''')
    if not isinstance(state, dict) or not state.get('visible') or state.get('disabled'):
        return False
    if control == 'select':
        if state.get('tag') != 'select':
            return False
        browser.run('select', selector, str(value))
    elif control == 'checkbox':
        if state.get('tag') != 'input' or state.get('type') != 'checkbox':
            return False
        if state.get('checked') != value:
            browser.run('click', selector)
    else:
        if state.get('tag') not in ('input', 'textarea') or state.get('type') in ('file', 'hidden', 'checkbox', 'radio', 'submit', 'button'):
            return False
        browser.run('fill', selector, str(value))
    return True


def page_guard(browser, recipe, domain):
    if not allowed(browser.run('url'), domain):
        return 'error'
    info = inspect(browser, recipe)
    if info.get('id_required'):
        return 'id_required'
    if info.get('success'):
        return 'unsupported'
    return None


def matches(found, person):
    norm = lambda v: ' '.join(str(v or '').casefold().split())
    if norm(found.get('name')) != norm(person.get('name')):
        return False
    email = found.get('email') and person.get('email') and norm(found['email']) == norm(person['email'])
    place_age = (person.get('city') and norm(found.get('city')) == norm(person['city'])
                 and str(found.get('age')) == str(person.get('age')))
    return bool(email or place_age)


def clear_challenge(browser, recipe, domain, info):
    if not ensure_clear(browser, recipe, domain, info.get('captcha')):
        return None
    if info.get('captcha') or recipe.get('captcha'):
        # Challenge verification can navigate. Check origin before trusting new
        # evidence or filling personal fields on the resulting page.
        if not allowed(browser.run('url'), domain):
            return None
        return inspect(browser, recipe)
    return info


def execute(payload, recipes, browser):
    site, action = payload['site'], payload['action']
    if site.get('id') == pdl_adapter.ID:
        return pdl_adapter.execute(payload, browser, VISIBILITY_JS)
    recipe = recipes.get(site['id'])
    if not recipe or recipe.get('domain') != site['domain'] or recipe.get('enabled', True) is not True:
        return {'status': 'unsupported'}
    actions = recipe.get('supported_actions')
    if 'supported_actions' in recipe and (not isinstance(actions, list) or action not in actions
            or any(a not in ('scan', 'submit', 'confirm', 'check') for a in actions)):
        return {'status': 'unsupported'}
    domain = site['domain']
    if action == 'confirm':
        prefix = recipe.get('confirmation_path_prefix')
        success = recipe.get('confirmation_success')
        if not prefix or not prefix.startswith('/') or not success:
            return {'status': 'unsupported'}
        candidate = find_confirmation(payload)
        if candidate is None:
            return {'status': 'pending'}
        url = candidate['confirmation_url']
        path = urlparse(url).path
        if not (path == prefix.rstrip('/') or path.startswith(prefix.rstrip('/') + '/')):
            return {'status': 'unsupported'}
        browser.goto(url, domain)
        info = clear_challenge(browser, recipe, domain, inspect(browser, recipe))
        if info is None:
            return {'status': 'captcha'}
        confirmed = visible_selector(browser, success)
        if not confirmed:
            return {'status': 'error'}
        return dict(candidate, status='confirmed')
    if action == 'scan':
        urls = site.get('search_urls') or []
        if not urls:
            return {'status': 'unsupported'}
        for url in urls[:10]:
            browser.goto(url, domain)
            search = clear_challenge(browser, recipe, domain, inspect(browser, recipe))
            if search is None:
                return {'status': 'captcha'}
            candidates = browser.js('Array.from(document.querySelectorAll(' +
                json.dumps(recipe['listing_links']) + ')).slice(0,5).map(a=>a.href)')
            hits = []
            for link in candidates:
                if not allowed(link, domain):
                    continue
                browser.goto(link, domain)
                info = clear_challenge(browser, recipe, domain, inspect(browser, recipe))
                if info is None:
                    return {'status': 'captcha'}
                if matches(info, payload.get('person', {})):
                    info['age'] = int(info['age']) if str(info.get('age', '')).isdigit() else None
                    hits.append({'status': 'found', 'listing_url': link,
                                 'match': {k: info[k] for k in ('name','age','city','email')}})
            if len(hits) == 1:
                return hits[0]
            if len(hits) > 1:
                return {'status': 'ambiguous'}
        # An empty result list does not prove absence on an unfamiliar page.
        return {'status': 'not_found'} if search['absent'] else {'status': 'ambiguous'}
    if action == 'check':
        browser.goto(payload['listing_url'], domain)
        info = clear_challenge(browser, recipe, domain, inspect(browser, recipe))
        if info is None:
            return {'status': 'captcha'}
        if info['absent'] and not info['name']:
            return {'status': 'removed', 'verified_absent': True}
        if matches(info, payload.get('person', {})):
            info['age'] = int(info['age']) if str(info.get('age', '')).isdigit() else None
            return {'status': 'found', 'listing_url': payload['listing_url'], 'match': info}
        return {'status': 'pending'}
    if action != 'submit':
        return {'status': 'unsupported'}
    if recipe.get('optout_url') != site.get('optout_url'):
        return {'status': 'unsupported'}
    browser.goto(site['optout_url'], domain)
    info = inspect(browser, recipe)
    if info['id_required']:
        return {'status': 'id_required'}
    info = clear_challenge(browser, recipe, domain, info)
    if info is None:
        return {'status': 'captcha'}
    if info['id_required']:
        return {'status': 'id_required'}
    controls = form_controls(recipe, payload.get('fields', {}), site.get('fields_needed', []))
    if controls is None or not _selector(recipe.get('submit')) or not _selector(recipe.get('success')):
        return {'status': 'unsupported'}
    if info.get('success'):
        # A page left on an old success screen cannot establish a new submission.
        return {'status': 'unsupported'}
    for control, selector, value in controls:
        problem = page_guard(browser, recipe, domain)
        if problem:
            return {'status': problem}
        if not apply_control(browser, control, selector, value):
            return {'status': 'unsupported'}
    problem = page_guard(browser, recipe, domain)
    if problem:
        return {'status': problem}
    # Refuse form-action changes before any personal data leaves the browser.
    target = browser.js('document.querySelector('+json.dumps(recipe['submit'])+').form?.action || ""')
    if not allowed(target, domain):
        return {'status': 'unsupported'}
    browser.run('click', recipe['submit'])
    if not allowed(browser.run('url'), domain):
        return {'status': 'pending'}
    result = inspect(browser, recipe)
    if not result['success']:
        return {'status': 'pending'}
    return {'status': 'awaiting_confirmation' if 'email_verification' in site.get('requires', []) else 'requested',
            'request_id': payload['request_id'], 'route_verified': True}


def main():
    try:
        payload = json.loads(sys.stdin.read(65536))
        recipes_path = os.environ.get('ERASE_BROWSER_RECIPES', '')
        if payload.get('site', {}).get('id') == pdl_adapter.ID:
            result = execute(payload, {}, Browser())
        elif not recipes_path:
            result = {'status': 'unsupported'}
        else:
            recipes = json.loads(Path(recipes_path).read_text())
            result = execute(payload, recipes, Browser())
    except Exception:
        # The worker holds unknown submission outcomes for reconciliation.
        result = {'status': 'error'}
    print(json.dumps(result))


if __name__ == '__main__':
    main()
