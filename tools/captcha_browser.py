"""Bounded, in-session CAPTCHA handling with local OCR/speech recognition.

Selectors are trusted operator recipes. Challenge content is never code. Successful
recognition is not proof of passage: the page must expose its actual success state.
"""
from __future__ import annotations

import base64
import json
from pathlib import Path
import subprocess
import tempfile
import time
from urllib.parse import urlsplit

from captcha_provider import CaptchaUnavailable, solve_audio, solve_image

MAX_BYTES = 2 * 1024 * 1024
RECAPTCHA = {
    'kind': 'recaptcha',
    'frame': 'iframe[src*="/recaptcha/api2/anchor"],iframe[src*="/recaptcha/enterprise/anchor"]',
    'checkbox': '#recaptcha-anchor',
    'audio_frame': 'iframe[src*="/recaptcha/api2/bframe"],iframe[src*="/recaptcha/enterprise/bframe"]',
    'audio_button': '#recaptcha-audio-button', 'audio': '#audio-source',
    'answer': '#audio-response', 'verify': '#recaptcha-verify-button',
    'response': '[name="g-recaptcha-response"]',
    'audio_hosts': ['www.google.com', 'www.recaptcha.net', 'www.gstatic.com'],
}
TURNSTILE = {
    'kind': 'checkbox', 'frame': 'iframe[src*="challenges.cloudflare.com"]',
    'checkbox': 'input[type="checkbox"]', 'response': '[name="cf-turnstile-response"]',
    'response_main': True,
}


def remaining(deadline, maximum):
    value = min(maximum, deadline - time.monotonic())
    if value <= 0:
        raise CaptchaUnavailable('CAPTCHA time limit reached.')
    return value


def _present(browser, selector):
    if not selector:
        return False
    return browser.js('(() => {const e=document.querySelector(' + json.dumps(selector) +
                      ');return !!e && e.getClientRects().length>0;})()') is True


def _passed(browser, recipe):
    selector, response = recipe.get('solved'), recipe.get('response')
    if not selector and not response:
        return False
    return browser.js('(() => {const r=' + json.dumps({'solved': selector, 'response': response}) + ''';
      const e=r.solved ? document.querySelector(r.solved) : null;
      const token=r.response ? document.querySelector(r.response) : null;
      return !!(e && e.getClientRects().length>0) || !!(token && typeof token.value==='string' && token.value.trim());
    })()''') is True


def _wait_passed(browser, recipe, deadline):
    for _ in range(4):
        remaining(deadline, 1)
        if _passed(browser, recipe):
            return True
        time.sleep(min(.4, remaining(deadline, .4)))
    return False


def allowed_audio(url, domain, extra_hosts):
    if not isinstance(url, str) or len(url) > 4096:
        return False
    try:
        parsed = urlsplit(url)
        host = (parsed.hostname or '').lower()
        extras = {str(h).lower() for h in extra_hosts}
        return (parsed.scheme == 'https' and parsed.username is None and parsed.password is None
                and parsed.port in (None, 443) and not any(ch.isspace() for ch in url)
                and (host == domain or host.endswith('.' + domain) or host in extras))
    except ValueError:
        return False


def _audio_bytes(browser, selector, domain, hosts, deadline):
    url = browser.js('(() => {const e=document.querySelector(' + json.dumps(selector) +
                     ');return e ? (e.currentSrc || e.src || e.href || "") : "";})()')
    if not allowed_audio(url, domain, hosts):
        raise CaptchaUnavailable('Unapproved CAPTCHA audio source.')
    # Fetch in the current frame, with redirects denied and a streamed byte ceiling.
    # No cookies, authorization headers, or user profile are forwarded to another host.
    budget = int(remaining(deadline, 8) * 1000)
    result = browser.js('(async () => {const url=' + json.dumps(url) + ',limit=' + str(MAX_BYTES) +
                       ',budget=' + str(budget) + ''';
      const abort=new AbortController();const timer=setTimeout(()=>abort.abort(),budget);
      try {const r=await fetch(url,{redirect:'error',credentials:'omit',signal:abort.signal});
        if(!r.ok || !r.body || Number(r.headers.get('content-length')||0)>limit) return null;
        const reader=r.body.getReader();let chunks=[],size=0;
        for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;
          if(size>limit){await reader.cancel();return null;}chunks.push(value);}
        const bytes=new Uint8Array(size);let offset=0;for(const c of chunks){bytes.set(c,offset);offset+=c.length;}
        let binary='';for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));
        return btoa(binary);
      } finally {clearTimeout(timer);}
    })()''')
    if not isinstance(result, str) or len(result) > 4 * ((MAX_BYTES + 2) // 3):
        raise CaptchaUnavailable('CAPTCHA audio was unavailable or too large.')
    try:
        data = base64.b64decode(result, validate=True)
    except ValueError as exc:
        raise CaptchaUnavailable('Invalid CAPTCHA audio.') from exc
    if not data or len(data) > MAX_BYTES:
        raise CaptchaUnavailable('Invalid CAPTCHA audio size.')
    return data


def _recognize(browser, recipe, domain, deadline):
    if recipe['kind'] == 'image':
        if recipe.get('frame'):
            # gstack's selector screenshots target the main document. Never OCR a
            # different main-page element that accidentally has the same selector.
            raise CaptchaUnavailable('Framed image challenges need a dedicated recipe adapter.')
        # gstack permits /tmp (resolved /private/tmp on macOS), whereas Python's
        # macOS default temp directory is /var/folders and is outside its allowlist.
        scratch = '/tmp' if Path('/tmp').is_dir() else tempfile.gettempdir()
        with tempfile.TemporaryDirectory(prefix='erase-captcha-', dir=scratch) as folder:
            path = Path(folder) / 'challenge.png'
            browser.run('screenshot', '--selector', recipe['image'], str(path))
            path.chmod(0o600)
            if path.stat().st_size > MAX_BYTES:
                raise CaptchaUnavailable('CAPTCHA image was too large.')
            answer = solve_image(path.read_bytes(), alphabet=recipe.get('alphabet', ''),
                                 timeout=remaining(deadline, 15))
    else:
        if recipe.get('audio_button'):
            browser.run('click', recipe['audio_button'])
        data = _audio_bytes(browser, recipe['audio'], domain, recipe.get('audio_hosts', []), deadline)
        answer = solve_audio(data, timeout=remaining(deadline, 30))
    # This is only the challenge answer, not a fabricated CAPTCHA response token.
    browser.run('fill', recipe['answer'], answer)
    if recipe.get('verify'):
        browser.run('click', recipe['verify'])


def _attempt_clear(browser, site_recipe, domain, detected=None):
    """One attempt, then observable success or False."""
    config = site_recipe.get('captcha')
    if config is None:
        if not detected:
            return True
        config = {'recaptcha': RECAPTCHA, 'turnstile': TURNSTILE}.get(detected.get('kind'))
    if not isinstance(config, dict) or config.get('kind') not in ('image', 'audio', 'checkbox', 'recaptcha'):
        return False
    config = dict(config)
    if config['kind'] == 'recaptcha':
        config = {**RECAPTCHA, **config}
    deadline = min(getattr(browser, 'deadline', time.monotonic() + 50), time.monotonic() + 50)
    try:
        if not allowed_audio(browser.run('url'), domain, []):
            return False
        # Real response tokens are only observed, never synthesized or overwritten.
        main_response = config['kind'] == 'recaptcha' or config.get('response_main')
        if (not config.get('frame') or main_response) and _passed(browser, config):
            return True
        if config.get('frame'):
            browser.run('frame', config['frame'])
            if not main_response and _passed(browser, config):
                return True
        if config.get('challenge') and not _present(browser, config['challenge']):
            return not bool(detected)
        if not detected and not config.get('challenge'):
            selector = config.get('image') or config.get('audio') or config.get('checkbox')
            if not _present(browser, selector):
                return True
        remaining(deadline, 1)
        if config['kind'] in ('checkbox', 'recaptcha'):
            browser.run('click', config['checkbox'])
            if config['kind'] == 'recaptcha' or config.get('response_main'):
                browser.run('frame', 'main')
            if _wait_passed(browser, config, deadline):
                return True
            if config['kind'] != 'recaptcha':
                return False
            browser.run('frame', config['audio_frame'])
            _recognize(browser, {**config, 'kind': 'audio'}, domain, deadline)
            browser.run('frame', 'main')
        else:
            if not config.get('answer') or not (config.get('solved') or config.get('response')):
                return False
            _recognize(browser, config, domain, deadline)
        return _wait_passed(browser, config, deadline)
    except (CaptchaUnavailable, OSError, ValueError, KeyError, TypeError, subprocess.SubprocessError):
        return False


def ensure_clear(browser, site_recipe, domain, detected=None):
    """Restore the main frame on every attempted challenge, including failures."""
    config = site_recipe.get('captcha')
    if config is None and not detected:
        return True
    if config is None and detected.get('kind') not in ('recaptcha', 'turnstile'):
        return False
    if config is not None and (not isinstance(config, dict) or config.get('kind') not in ('image', 'audio', 'checkbox', 'recaptcha')):
        return False
    if config and config.get('verify') and config.get('verify') == site_recipe.get('submit'):
        return False
    passed = False
    try:
        passed = _attempt_clear(browser, site_recipe, domain, detected)
    finally:
        # A missed selector/frame is a blocked challenge, never permission to submit.
        try:
            browser.run('frame', 'main')
        except (OSError, subprocess.SubprocessError):
            passed = False
    return passed
