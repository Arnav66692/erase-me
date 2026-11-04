"""Vercel interaction preview. Synthetic data only; never sends mail or requests.

The public demo cookie is deliberately NOT authentication. It stores only a
synthetic flow stage and is disposable; this module cannot load real users.
"""
from http.server import BaseHTTPRequestHandler
from http.cookies import SimpleCookie
import json
import time
from datetime import datetime, timezone

PROFILE = {'name': 'Alex Morgan', 'age': 35, 'email': 'alex@example.com',
           'country': 'US', 'region': 'US-CA', 'city': 'San Diego'}
COOKIE = 'erase_preview'
CODE = '246810'


def iso(value=None):
    return datetime.fromtimestamp(value or time.time(), timezone.utc).isoformat()


def dashboard(state):
    stage = min(3, int(max(0, time.time() - state['start']) / 5))
    if state.get('paused'):
        stage = state.get('stage', stage)
    definitions = [
        ('demo-directory', 'Sample Directory', 'directory.example', ['scanning','found','requested','removed']),
        ('demo-people', 'Sample People Search', 'people.example', ['scanning','found','awaiting_confirmation','requested']),
        ('demo-broker', 'Sample Data Broker', 'broker.example', ['scanning','found','requested','removed']),
        ('demo-id', 'Sample Identity Check', 'identity.example', ['scanning','found','blocked','blocked']),
    ]
    details = {'scanning': 'Checking this synthetic listing.', 'found': 'Synthetic profile matched.',
               'requested': 'Demo removal request accepted. Waiting for verification.',
               'awaiting_confirmation': 'Demo confirmation email is being processed.',
               'removed': 'Synthetic listing confirmed absent during a recheck.',
               'blocked': 'This demo route asks for ID. No document will be requested or uploaded.'}
    items = [{'id': id_, 'name': name, 'domain': domain, 'status': states[stage],
              'detail': details[states[stage]], 'url': '', 'updated_at': iso()}
             for id_, name, domain, states in definitions]
    return {'mode':'demo', 'profile':PROFILE,
            'campaign':{'status':'paused' if state.get('paused') else 'active',
                        'authorized_at':iso(state['start']), 'next_check_at':iso(state['start']+30*86400)},
            'counts':{'found':4 if stage else 0, 'requested':3 if stage>=2 else 0,
                      'removed':2 if stage==3 else 0, 'blocked':1 if stage>=2 else 0},
            'items':items, 'questions':[],
            'activity':[{'at':iso(), 'message':'Synthetic preview: no websites were contacted and no emails were sent.'},
                        {'at':iso(state['start']), 'message':'Demo authorization recorded. Sample scan started.'}]}


class handler(BaseHTTPRequestHandler):
    def log_message(self, *args):
        pass

    def reply(self, status, data, state=None, clear=False):
        encoded = json.dumps(data).encode()
        self.send_response(status)
        self.send_header('Content-Type','application/json')
        self.send_header('Cache-Control','no-store')
        self.send_header('X-Content-Type-Options','nosniff')
        self.send_header('Content-Length',str(len(encoded)))
        if state is not None or clear:
            # Only start, paused, stage. Never names, emails or real profile data.
            value = '' if clear else json.dumps(state,separators=(',',':')).encode().hex()
            self.send_header('Set-Cookie',f'{COOKIE}={value}; Path=/; HttpOnly; SameSite=Strict; Secure; Max-Age={0 if clear else 3600}')
        self.end_headers()
        self.wfile.write(encoded)

    def state(self):
        try:
            cookies=SimpleCookie(self.headers.get('Cookie',''))
            raw=cookies[COOKIE].value
            if len(raw)>512:
                return None
            data=json.loads(bytes.fromhex(raw))
            if not isinstance(data,dict) or type(data.get('start')) not in (int,float):
                return None
            if not time.time()-3600 < data['start'] <= time.time():
                return None
            if type(data.get('paused',False)) is not bool or type(data.get('stage',0)) is not int:
                return None
            return {'start':data['start'],'paused':data.get('paused',False),'stage':max(0,min(3,data.get('stage',0)))}
        except (KeyError,ValueError,TypeError):
            return None

    def do_GET(self):
        path=self.path.split('?')[0]
        if path=='/api/config':
            self.reply(200,{'mode':'demo','synthetic_only':True,'email_configured':False,
                           'automation_configured':False,'authorization_statement':
                           'I authorize this sample demonstration. No actual requests will be sent.'})
        elif path=='/api/dashboard':
            state=self.state()
            self.reply(200,dashboard(state)) if state else self.reply(401,{'error':'Sign in to the sample demo.'})
        else:
            self.reply(404,{'error':'Not found.'})

    def mutate(self):
        if self.headers.get('X-Erase-Me')!='1':
            return self.reply(403,{'error':'Invalid request.'})
        origin=self.headers.get('Origin')
        if origin and origin!='https://'+self.headers.get('Host',''):
            return self.reply(403,{'error':'Invalid origin.'})
        try:
            length=int(self.headers.get('Content-Length','0'))
            if not 0<=length<=4096:
                return self.reply(413,{'error':'Request too large.'})
            data=json.loads(self.rfile.read(length) or b'{}')
            if not isinstance(data,dict):
                raise ValueError()
        except (ValueError,UnicodeDecodeError):
            return self.reply(400,{'error':'Invalid request.'})
        path=self.path.split('?')[0]
        if path in ('/api/signup','/api/login'):
            valid=data.get('email')==PROFILE['email']
            if path=='/api/signup':
                valid=valid and data.get('name')==PROFILE['name'] and data.get('age')==35 and data.get('authorized') is True
            if not valid:
                return self.reply(400,{'error':'This public demo accepts the supplied sample data only.'})
            return self.reply(200,{'verification_required':True,'demo_code':CODE})
        if path=='/api/verify':
            if data.get('email')!=PROFILE['email'] or data.get('code')!=CODE:
                return self.reply(400,{'error':'Use the sample verification code shown on screen.'})
            return self.reply(200,{'ok':True},state={'start':time.time(),'paused':False,'stage':0})
        if path in ('/api/logout','/api/account'):
            return self.reply(200,{'ok':True},clear=True)
        state=self.state()
        if not state:
            return self.reply(401,{'error':'Sign in to the sample demo.'})
        if path=='/api/campaign':
            action=data.get('action')
            if action not in ('run','pause','resume'):
                return self.reply(400,{'error':'Unknown action.'})
            if action=='pause':
                state['stage']=min(3,int(max(0,time.time()-state['start'])/5))
                state['paused']=True
            elif action=='resume':
                if state['paused']:
                    state['start']=time.time()-state['stage']*5
                state['paused']=False
            elif not state['paused']:
                state['start']=time.time()-15
            return self.reply(200,{'ok':True},state=state)
        if path=='/api/profile':
            return self.reply(400,{'error':'Profile editing is disabled in the public sample demo.'})
        self.reply(404,{'error':'Not found.'})

    do_POST=mutate
    do_DELETE=mutate
