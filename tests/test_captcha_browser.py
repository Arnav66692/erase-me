from pathlib import Path
import stat
import subprocess

import pytest

import captcha_browser as cb


class Browser:
    def __init__(self): self.calls=[]
    def run(self,*args):
        self.calls.append(args)
        if args[0]=='url': return 'https://broker.example/remove'
        if args[0]=='screenshot': Path(args[-1]).write_bytes(b'fake screenshot')
        return ''


@pytest.fixture
def browser(monkeypatch):
    monkeypatch.setattr(cb.time,'sleep',lambda _:None)
    monkeypatch.setattr(cb,'_present',lambda *a:True)
    return Browser()


def test_no_challenge_needs_no_tools():
    assert cb.ensure_clear(None,{},'broker.example') is True


def test_unknown_challenge_type_blocked():
    assert cb.ensure_clear(None,{},'broker.example',{'kind':'grid'}) is False


def test_image_answer_then_observable_success(browser,monkeypatch):
    answers=iter([False,True])
    monkeypatch.setattr(cb,'_passed',lambda *a:next(answers))
    def solve(data,**kw):
        screenshot=Path(next(args[-1] for args in browser.calls if args[0]=='screenshot'))
        if Path('/tmp').is_dir():
            assert screenshot.parent.parent==Path('/tmp')
        assert stat.S_IMODE(screenshot.parent.stat().st_mode)==0o700
        assert stat.S_IMODE(screenshot.stat().st_mode)==0o600
        return 'AB12'
    monkeypatch.setattr(cb,'solve_image',solve)
    recipe={'captcha':{'kind':'image','image':'#image','challenge':'#image','answer':'#answer',
                       'verify':'#verify','solved':'#passed'}}
    assert cb.ensure_clear(browser,recipe,'broker.example') is True
    assert ('fill','#answer','AB12') in browser.calls
    assert ('click','#verify') in browser.calls
    assert browser.calls[-1]==('frame','main')
    screenshot=next(args[-1] for args in browser.calls if args[0]=='screenshot')
    assert not Path(screenshot).exists()


def test_recognition_without_page_success_stays_blocked(browser,monkeypatch):
    monkeypatch.setattr(cb,'_passed',lambda *a:False)
    monkeypatch.setattr(cb,'solve_image',lambda data,**kw:'WRONG')
    recipe={'captcha':{'kind':'image','image':'#image','answer':'#answer','verify':'#verify','solved':'#passed'}}
    assert cb.ensure_clear(browser,recipe,'broker.example') is False
    assert browser.calls.count(('fill','#answer','WRONG'))==1
    assert browser.calls.count(('click','#verify'))==1


def test_already_passed_does_not_click(browser,monkeypatch):
    monkeypatch.setattr(cb,'_passed',lambda *a:True)
    assert cb.ensure_clear(browser,{},'broker.example',{'kind':'recaptcha'}) is True
    assert not any(a[0]=='click' for a in browser.calls)


def test_absent_recipe_challenge_does_not_run_ocr(browser,monkeypatch):
    monkeypatch.setattr(cb,'_passed',lambda *a:False)
    monkeypatch.setattr(cb,'_present',lambda *a:False)
    recipe={'captcha':{'kind':'image','challenge':'#captcha','image':'#image','solved':'#passed'}}
    assert cb.ensure_clear(browser,recipe,'broker.example') is True
    assert not any(a[0]=='screenshot' for a in browser.calls)


def test_detected_widget_not_ignored_by_absent_recipe_selector(browser,monkeypatch):
    monkeypatch.setattr(cb,'_passed',lambda *a:False)
    monkeypatch.setattr(cb,'_present',lambda *a:False)
    recipe={'captcha':{'kind':'image','challenge':'#captcha','image':'#image','solved':'#passed'}}
    assert cb.ensure_clear(browser,recipe,'broker.example',{'kind':'recaptcha'}) is False


def test_checkbox_audio_flow_restores_main_frame(browser,monkeypatch):
    # Initial token absent, checkbox unresolved, audio challenge succeeds.
    passed=iter([False,False,False,False,False,True])
    monkeypatch.setattr(cb,'_passed',lambda *a:next(passed))
    monkeypatch.setattr(cb,'_audio_bytes',lambda *a:b'audio')
    monkeypatch.setattr(cb,'solve_audio',lambda *a,**k:'seven boats')
    assert cb.ensure_clear(browser,{},'broker.example',{'kind':'recaptcha'}) is True
    assert ('fill','#audio-response','seven boats') in browser.calls
    assert ('click','#recaptcha-verify-button') in browser.calls
    assert browser.calls[-1]==('frame','main')


def test_browser_failures_remain_blocked(browser,monkeypatch):
    monkeypatch.setattr(cb,'_passed',lambda *a:False)
    original=browser.run
    def run(*args):
        if args[0]=='click': raise subprocess.CalledProcessError(1,'browse')
        return original(*args)
    browser.run=run
    assert cb.ensure_clear(browser,{},'broker.example',{'kind':'turnstile'}) is False
    assert browser.calls[-1]==('frame','main')


@pytest.mark.parametrize('url',[
    'http://broker.example/a.mp3','https://evil.example/audio','https://broker.example.evil.com/audio',
    'https://broker.example@evil.example/a','https://www.google.com.evil.com/audio',
    'https://www.google.com:444/audio','data:audio/wav;base64,AAA',
])
def test_audio_source_boundary(url):
    assert not cb.allowed_audio(url,'broker.example',['www.google.com'])


def test_audio_allowed_sources():
    assert cb.allowed_audio('https://media.broker.example/a','broker.example',[])
    assert cb.allowed_audio('https://www.google.com/audio','broker.example',['www.google.com'])


def test_audio_fetch_denies_redirects_and_caps_bytes(monkeypatch):
    calls=[]
    class AudioBrowser:
        def js(self,expr):
            calls.append(expr)
            return 'https://broker.example/audio' if len(calls)==1 else 'UklGRg=='
    result=cb._audio_bytes(AudioBrowser(),'#audio','broker.example',[],cb.time.monotonic()+10)
    assert result==b'RIFF'
    assert "redirect:'error'" in calls[1]
    assert "credentials:'omit'" in calls[1]
    assert str(cb.MAX_BYTES) in calls[1]
    assert 'reader.cancel()' in calls[1]


def test_failed_frame_reset_overrides_success(browser,monkeypatch):
    monkeypatch.setattr(cb,'_passed',lambda *a:True)
    original=browser.run
    def run(*args):
        if args==('frame','main'): raise subprocess.TimeoutExpired('browse',1)
        return original(*args)
    browser.run=run
    assert cb.ensure_clear(browser,{},'broker.example',{'kind':'recaptcha'}) is False


def test_verifier_cannot_be_final_removal_submit(browser):
    recipe={'submit':'#send','captcha':{'kind':'image','image':'#image','answer':'#answer',
                                      'verify':'#send','solved':'#passed'}}
    assert cb.ensure_clear(browser,recipe,'broker.example') is False
    assert not browser.calls
