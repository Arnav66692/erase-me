import json
import shutil
import subprocess

import pytest

from browser_adapter import allowed, execute, inspect, matches, visible_selector


@pytest.mark.parametrize('url', ['https://broker.example.evil.com/a','http://broker.example/a',
    'https://broker.example@evil.com/a','https://broker.example:444/a','file:///etc/passwd'])
def test_broker_url_boundary(url):
    assert not allowed(url,'broker.example')


def test_name_alone_does_not_match():
    assert not matches({'name':'Alex Morgan'}, {'name':'Alex Morgan','age':35,'city':'San Diego'})
    assert matches({'name':'Alex Morgan','age':'35','city':'San Diego'},
                   {'name':'Alex Morgan','age':35,'city':'San Diego'})


def test_unmapped_site_does_not_open_browser():
    class Browser:
        def goto(self,*a): pytest.fail('unconfigured site opened')
    assert execute({'site':{'id':'unknown','domain':'broker.example'},'action':'scan'}, {}, Browser())=={'status':'unsupported'}


def test_id_upload_is_never_attempted():
    class Browser:
        def goto(self,*a): pass
        def js(self,*a): return {'id_required':True,'captcha':None}
        def run(self,*a): pytest.fail('ID flow attempted')
    recipe={'domain':'broker.example','optout_url':'https://broker.example/remove'}
    payload={'site':{'id':'broker','domain':'broker.example','optout_url':'https://broker.example/remove'},'action':'submit'}
    assert execute(payload,{'broker':recipe},Browser())=={'status':'id_required'}


def test_complete_form_uses_only_declared_fields():
    calls=[]
    class Browser:
        def goto(self,*a): pass
        def js(self,expr):
            if '.form?.action' in expr: return 'https://broker.example/remove'
            if 'tag:e.tagName' in expr:
                return {'visible':True,'disabled':False,'tag':'input','type':'text','checked':False}
            return {'id_required':False,'captcha':None,'success':('click','button') in calls}
        def run(self,*a):
            calls.append(a)
            return 'https://broker.example/remove'
    recipe={'domain':'broker.example','optout_url':'https://broker.example/remove',
            'fields':{'email':'#email','listing_url':'#listing'},'submit':'button','success':'#success'}
    payload={'action':'submit','request_id':'abc','fields':{'email':'a@example.com','listing_url':'https://broker.example/p/1','age':35},
             'site':{'id':'broker','domain':'broker.example','optout_url':'https://broker.example/remove',
                     'fields_needed':['email','listing_url'],'requires':['email_verification']}}
    result=execute(payload,{'broker':recipe},Browser())
    assert result=={'status':'awaiting_confirmation','request_id':'abc','route_verified':True}
    assert ('fill','#email','a@example.com') in calls
    assert not any('35' in args for args in calls)


def test_scan_returns_numeric_age_for_worker():
    from webapp.adapters import same_person
    class Browser:
        def goto(self,*args): pass
        def js(self,expr):
            if 'slice(0,5)' in expr: return ['https://broker.example/p/1']
            return {'name':'Alex Morgan','age':'35','city':'San Diego','email':'',
                    'absent':False,'captcha':None}
    user={'name':'Alex Morgan','age':35,'city':'San Diego','email':'alex@example.com'}
    payload={'action':'scan','person':user,'site':{'id':'broker','domain':'broker.example',
                                                    'search_urls':['https://broker.example/search']}}
    result=execute(payload,{'broker':{'domain':'broker.example','listing_links':'a'}},Browser())
    assert result['status']=='found'
    assert same_person(user,result['match'])


@pytest.mark.parametrize('action', ['scan', 'check', 'submit'])
def test_unsolved_challenge_stops_every_action(monkeypatch, action):
    calls=[]
    class Browser:
        def goto(self,*args): calls.append(('goto',*args))
        def js(self,expr): return {'captcha':{'kind':'recaptcha'},'id_required':False}
        def run(self,*args): pytest.fail('Form or listing action ran after failed CAPTCHA')
    monkeypatch.setattr('browser_adapter.ensure_clear',lambda *a:False)
    payload={'action':action,'listing_url':'https://broker.example/p/1','site':{
        'id':'broker','domain':'broker.example','search_urls':['https://broker.example/search'],
        'optout_url':'https://broker.example/remove'}}
    recipe={'domain':'broker.example','optout_url':'https://broker.example/remove'}
    assert execute(payload,{'broker':recipe},Browser())=={'status':'captcha'}


def test_browser_js_awaits_before_serializing():
    from browser_adapter import Browser
    browser=object.__new__(Browser)
    commands=[]
    browser.run=lambda *a: commands.append(a) or '{"ok":true}'
    assert browser.js('Promise.resolve({ok:true})')=={'ok':True}
    assert 'return JSON.stringify(await (Promise.resolve({ok:true})));'==commands[0][1]


def test_challenge_redirect_does_not_receive_profile(monkeypatch):
    class Browser:
        def goto(self,*a): pass
        def js(self,*a): return {'captcha':{'kind':'recaptcha'},'id_required':False}
        def run(self,*args):
            assert args==('url',),'Must not fill profile after off-domain CAPTCHA redirect'
            return 'https://attacker.example/form'
    monkeypatch.setattr('browser_adapter.ensure_clear',lambda *a:True)
    payload={'action':'submit','site':{'id':'broker','domain':'broker.example','optout_url':'https://broker.example/remove'}}
    recipe={'domain':'broker.example','optout_url':'https://broker.example/remove'}
    assert execute(payload,{'broker':recipe},Browser())=={'status':'captcha'}


def test_id_requirement_rechecked_after_challenge(monkeypatch):
    checks=iter([{'captcha':{'kind':'recaptcha'},'id_required':False}, {'captcha':None,'id_required':True}])
    class Browser:
        def goto(self,*a): pass
        def js(self,*a): return next(checks)
        def run(self,*args):
            assert args==('url',),'Must not fill profile on new ID-upload page'
            return 'https://broker.example/remove'
    monkeypatch.setattr('browser_adapter.ensure_clear',lambda *a:True)
    payload={'action':'submit','site':{'id':'broker','domain':'broker.example','optout_url':'https://broker.example/remove'}}
    recipe={'domain':'broker.example','optout_url':'https://broker.example/remove'}
    assert execute(payload,{'broker':recipe},Browser())=={'status':'id_required'}


@pytest.mark.parametrize('extra',[
    {'enabled':False}, {'enabled':'false'}, {'supported_actions':[]},
    {'supported_actions':['check']}, {'supported_actions':'submit'},
    {'supported_actions':None}, {'supported_actions':['submit', 'arbitrary-code']},
])
def test_recipe_gate_prevents_all_browser_work(extra):
    class Browser:
        def goto(self,*a): pytest.fail('Disabled or unsupported recipe navigated')
        def run(self,*a): pytest.fail('Disabled or unsupported recipe ran a command')
        def js(self,*a): pytest.fail('Disabled or unsupported recipe read the browser')
    recipe={'domain':'broker.example','optout_url':'https://broker.example/remove',**extra}
    payload={'action':'submit','site':{'id':'broker','domain':'broker.example'}}
    assert execute(payload,{'broker':recipe},Browser())=={'status':'unsupported'}


class FormBrowser:
    def __init__(self, *, initial_success=False):
        self.calls=[]
        self.success=initial_success
        self.url='https://broker.example/remove'
        self.requires_id=False
        self.control_types={}
        self.checked={}
        self.after_action=None

    def goto(self,*args): self.calls.append(('goto',*args))

    def js(self,expr):
        if '.form?.action' in expr:
            return 'https://broker.example/remove'
        if 'tag:e.tagName' in expr:
            control=next((key for key in self.control_types if json.dumps(key) in expr),None)
            tag,type_=self.control_types.get(control,('input','text'))
            return {'visible':True,'disabled':False,'tag':tag,'type':type_,'checked':self.checked.get(control,False)}
        return {'id_required':self.requires_id,'captcha':None,'success':self.success}

    def run(self,*args):
        self.calls.append(args)
        if args==('url',): return self.url
        if args==('click','#submit'): self.success=True
        if args[0]=='click' and args[1] in self.checked:
            self.checked[args[1]]=not self.checked[args[1]]
        if self.after_action and args[0] in ('click','select','fill'):
            self.after_action(args)
        return ''


def form_case():
    recipe={'domain':'broker.example','enabled':True,'supported_actions':['submit'],
            'optout_url':'https://broker.example/remove','fields':{'email':'#email'},
            'submit':'#submit','success':'#success'}
    payload={'action':'submit','request_id':'abc','fields':{'email':'a@example.com'},
             'site':{'id':'broker','domain':'broker.example','optout_url':recipe['optout_url'],
                     'fields_needed':['email'],'requires':[]}}
    return payload,recipe


def test_preexisting_success_never_counts_or_resubmits():
    payload,recipe=form_case()
    browser=FormBrowser(initial_success=True)
    assert execute(payload,{'broker':recipe},browser)=={'status':'unsupported'}
    assert not any(args[0] in ('fill','click','select') for args in browser.calls)


def test_declared_select_and_checkbox_precede_personal_fields():
    payload,recipe=form_case()
    recipe['controls']=[{'control':'select','selector':'#request-type','value':'subject'},
                        {'control':'checkbox','selector':'#agreement','checked':True}]
    browser=FormBrowser()
    browser.control_types={'#request-type':('select','select-one'),'#agreement':('input','checkbox')}
    browser.checked['#agreement']=False
    assert execute(payload,{'broker':recipe},browser)['status']=='requested'
    actions=[a for a in browser.calls if a[0] in ('fill','select','click')]
    assert actions==[('select','#request-type','subject'),('click','#agreement'),
                     ('fill','#email','a@example.com'),('click','#submit')]


def test_already_checked_checkbox_is_not_toggled_off():
    payload,recipe=form_case()
    recipe['controls']=[{'control':'checkbox','selector':'#agreement','checked':True}]
    browser=FormBrowser()
    browser.control_types={'#agreement':('input','checkbox')}
    browser.checked['#agreement']=True
    assert execute(payload,{'broker':recipe},browser)['status']=='requested'
    assert ('click','#agreement') not in browser.calls


def test_payload_select_maps_only_declared_allowed_value():
    payload,recipe=form_case()
    recipe['fields']['region']={'selector':'#region','control':'select','value_map':{'US-CA':'CA'}}
    payload['fields']['region']='US-CA'
    payload['site']['fields_needed'].append('region')
    browser=FormBrowser()
    browser.control_types={'#region':('select','select-one')}
    assert execute(payload,{'broker':recipe},browser)['status']=='requested'
    assert ('select','#region','CA') in browser.calls


@pytest.mark.parametrize('mutation', ['unknown_field','unknown_control','script_control','bad_checkbox','unmapped_select','duplicate_selector'])
def test_invalid_control_plan_never_enters_personal_data(mutation):
    payload,recipe=form_case()
    if mutation=='unknown_field': recipe['fields']['phone']='#phone'; payload['fields']['phone']='5551234567'
    if mutation=='unknown_control': recipe['controls']=[{'control':'click','selector':'#other'}]
    if mutation=='script_control': recipe['controls']=[{'control':'checkbox','selector':'#agree','checked':True,'js':'send()'}]
    if mutation=='bad_checkbox': recipe['controls']=[{'control':'checkbox','selector':'#agree','checked':'true'}]
    if mutation=='unmapped_select': recipe['fields']['email']={'selector':'#email','control':'select','value_map':{}}
    if mutation=='duplicate_selector': recipe['controls']=[{'control':'checkbox','selector':'#email','checked':True}]
    browser=FormBrowser()
    assert execute(payload,{'broker':recipe},browser)=={'status':'unsupported'}
    assert not any(a[0] in ('fill','click','select') for a in browser.calls)


@pytest.mark.parametrize('change,expected',[('redirect','error'),('id','id_required'),('success','unsupported')])
def test_change_event_guard_runs_before_entering_email(change,expected):
    payload,recipe=form_case()
    recipe['controls']=[{'control':'select','selector':'#request-type','value':'subject'}]
    browser=FormBrowser()
    browser.control_types={'#request-type':('select','select-one')}
    def change_page(args):
        if args[0]!='select': return
        if change=='redirect': browser.url='https://attacker.example/form'
        if change=='id': browser.requires_id=True
        if change=='success': browser.success=True
    browser.after_action=change_page
    assert execute(payload,{'broker':recipe},browser)=={'status':expected}
    assert not any(a[0]=='fill' for a in browser.calls)
    assert ('click','#submit') not in browser.calls


class DOMBrowser:
    """Evaluate the actual extracted visibility JS using minimal browser-like DOM."""
    def __init__(self, state): self.state=state
    def js(self, expression):
        node=shutil.which('node')
        if not node: pytest.skip('Node is needed for DOM expression contract tests')
        source='''
const s=STATE;
const parent={hidden:!!s.parentHidden,parentElement:null,getAttribute:k=>k==='aria-hidden'&&s.parentAria?'true':null};
const e={hidden:!!s.hidden,parentElement:parent,textContent:'Alex Morgan',getAttribute:()=>null,
 getClientRects:()=>s.rectZero?[]:[{width:30,height:10}]};
global.getComputedStyle=n=>({display:'block',visibility:'visible',contentVisibility:'visible',opacity:'1',
 ...(n===parent?s.parentStyle||{}:s.style||{})});
global.document={querySelectorAll:selector=>selector==='#e'?[e]:[],querySelector:()=>null};
process.stdout.write(JSON.stringify(eval(EXPRESSION)));
'''.replace('STATE',json.dumps(self.state)).replace('EXPRESSION',json.dumps(expression))
        result=subprocess.run([node,'-e',source],capture_output=True,text=True,check=True,timeout=10)
        return json.loads(result.stdout)


@pytest.mark.parametrize('hidden_state',[
    {'hidden':True},{'parentHidden':True},{'parentAria':True},{'rectZero':True},
    {'style':{'visibility':'hidden'}},{'style':{'display':'none'}},
    {'parentStyle':{'display':'none'}},{'parentStyle':{'opacity':'0'}},
    {'parentStyle':{'contentVisibility':'hidden'}},
])
def test_hidden_evidence_does_not_count_as_success_absence_or_confirmation(hidden_state):
    browser=DOMBrowser(hidden_state)
    data=inspect(browser,{'name':'#e','success':'#e','absent':'#e'})
    assert data['success'] is False and data['absent'] is False and data['name']==''
    assert visible_selector(browser,'#e') is False


def test_visible_evidence_is_accepted():
    browser=DOMBrowser({})
    data=inspect(browser,{'name':'#e','success':'#e','absent':'#e'})
    assert data['success'] is True and data['absent'] is True and data['name']=='Alex Morgan'
    assert visible_selector(browser,'#e') is True
