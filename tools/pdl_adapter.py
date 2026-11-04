"""People Data Labs email-verification initiation; never claims deletion."""
import re
import time
from urllib.parse import parse_qsl, urlsplit

ID = 'peopledatalabs-form'
DOMAIN = 'privacy.peopledatalabs.com'
URL = 'https://privacy.peopledatalabs.com/policies?action=ERASURE&modal=log-in'
EMAIL = '#pc-email-login-input'
SUBMIT = '#email-login-submit'


def on_portal(url):
    try:
        parsed = urlsplit(url)
        query = parse_qsl(parsed.query, keep_blank_values=True, strict_parsing=True)
        return (parsed.scheme == 'https' and parsed.hostname == DOMAIN and parsed.port in (None, 443)
                and not parsed.username and not parsed.password and parsed.path == '/policies'
                and not parsed.fragment and len(query) == 2
                and set(query) == {('action', 'ERASURE'), ('modal', 'log-in')}
                and not any(c.isspace() for c in url))
    except (TypeError, ValueError):
        return False


def inspect(browser, visibility):
    return browser.js('(() => {' + visibility + '''
      const e=document.querySelector('#pc-email-login-input');
      const b=document.querySelector('#email-login-submit');
      return {url:location.href,id_required:!!document.querySelector('input[type="file"]'),
        ready:!!(e && e.type==='email' && visible(e) && !e.disabled && !e.readOnly &&
          b && b.type==='submit' && visible(b) && !b.disabled),
        email:e?.value || '',form:b?.form?.action || '',
        success:Array.from(document.querySelectorAll('[role="alert"]')).some(
          x=>visible(x) && x.textContent.trim()==='Email sent!')};
    })()''')


def safe(state):
    return isinstance(state, dict) and on_portal(state.get('url', '')) and not state.get('id_required')


def execute(payload, browser, visibility):
    site, fields = payload.get('site', {}), payload.get('fields', {})
    address = fields.get('email', '')
    if (payload.get('action') != 'submit' or site.get('id') != ID or site.get('domain') != DOMAIN
            or site.get('optout_url') != URL or site.get('fields_needed') != ['email']
            or set(fields) != {'email'} or not isinstance(address, str)
            or len(address) > 254 or not re.fullmatch(r'[^@\s<>]+@[^@\s<>]+\.[^@\s<>]+', address)
            or payload.get('person', {}).get('email') != address
            or not re.fullmatch(r'[a-f0-9]{32}', payload.get('request_id', ''))):
        return {'status': 'unsupported'}
    browser.goto(URL, DOMAIN)
    for _ in range(32):
        state = inspect(browser, visibility)
        if not safe(state) or state.get('success'):
            return {'status': 'unsupported'}
        if state.get('ready'):
            if not on_portal(state.get('form', '')):
                return {'status': 'unsupported'}
            break
        time.sleep(.25)
    else:
        return {'status': 'unsupported'}
    browser.run('fill', EMAIL, address)
    state = inspect(browser, visibility)
    if not safe(state) or not state.get('ready') or not on_portal(state.get('form', '')) or state.get('success') or state.get('email') != address:
        return {'status': 'unsupported'}
    browser.run('click', SUBMIT)
    for _ in range(32):
        state = inspect(browser, visibility)
        if not safe(state):
            return {'status': 'pending'}
        if state.get('success'):
            return {'status': 'verification_sent', 'request_id': payload['request_id'], 'route_verified': True}
        time.sleep(.25)
    return {'status': 'pending'}
