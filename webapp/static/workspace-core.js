/* Browser-local profile. Optional receipt checks send only scoped operation references. */
(function (root, factory) {
  const routes = typeof module === 'object' && module.exports ? require('./broker-routes.js') : root.EraseBrokerRoutes;
  const identityDetails = typeof module === 'object' && module.exports ? require('../../extension/identity-details.js') : root.EraseIdentityDetails;
  const footprintPlanner = typeof module === 'object' && module.exports ? require('./footprint-planner.js') : root.EraseFootprintPlanner;
  const peopleTraceDetails = typeof module === 'object' && module.exports ? require('../../extension/peopletrace-details.js') : root.ErasePeopleTraceDetails;
  const cmaDetails = typeof module === 'object' && module.exports ? require('../../extension/cma-details.js') : root.EraseCMADetails;
  const myLifeDetails = typeof module === 'object' && module.exports ? require('../../extension/mylife-details.js') : root.EraseMyLifeDetails;
  const thatsThemDetails = typeof module === 'object' && module.exports ? require('../../extension/thatsthem-details.js') : root.EraseThatsThemDetails;
  const peopleFindersDetails = typeof module === 'object' && module.exports ? require('../../extension/peoplefinders-details.js') : root.ErasePeopleFindersDetails;
  const sendContract = typeof module === 'object' && module.exports ? require('../../extension/send-contract.js') : root.EraseSendContract;
  const api = factory(root, routes, identityDetails, footprintPlanner, peopleTraceDetails, cmaDetails, myLifeDetails, thatsThemDetails, peopleFindersDetails, sendContract);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.EraseWorkspace = api;
})(typeof globalThis === 'object' ? globalThis : this, function (root, routes, identityDetails, footprintPlanner, peopleTraceDetails, cmaDetails, myLifeDetails, thatsThemDetails, peopleFindersDetails, sendContract) {
  'use strict';
  const KEY = 'erase-me-workspace-v1';
  const VERSION = 1;
  const AUTHORIZATION = 'I request removal of my own information. I authorize only the broker actions I explicitly start using the fields shown. My email is self-reported. Additional identity details and broker submissions require my explicit review and approval. Dedicated removal-mail receipt checks require separate explicit authorization. No personal inbox access, ID uploads, account deletions or recurring checks are authorized.';
  const USER_STATES = new Set(['user_reported_requested', 'user_reported_completed']);
  const RESULT_STATES = new Set(['prepared', 'verification_sent', 'submission_attempted', 'submitted', 'captcha', 'id_required', 'unsupported', 'pending', 'unknown', 'error', 'blocked']);
  const MATCH_STATES = new Set(['matched', 'not_matched', 'ambiguous', 'needs_identity', 'unsupported']);
  const MATCH_EVIDENCE = new Set(['structured_person', 'exact_candidate_url', 'name', 'email', 'phone', 'age', 'city', 'identity']);
  const MATCH_LIFETIME = 30 * 60 * 1000;
  const SUBMIT_STAGES = Object.freeze({ familytreenow: 'verification_initiation', smartbackgroundchecks: 'verification_initiation', usphonebook: 'verification_initiation', fastpeoplesearch: 'verification_initiation', searchpeoplefree: 'verification_initiation', apollo: 'verification_initiation', advancedbackgroundchecks: 'verification_initiation',
    'tr-nosorgulama': 'request_submission', 'tr-numaraara': 'request_submission', 'tr-numarasor': 'request_submission' });
  const MAIL_ROUTES = new Set(['usphonebook', 'searchpeoplefree', 'fastpeoplesearch']);
  const NEW_MAIL_ROUTES = new Set(['usphonebook', 'fastpeoplesearch']);
  const OPERATION = /^[a-f0-9-]{32,40}$/;
  const SEND_PHASES = new Set(['preparing','ready','sending','provider_accepted','unknown','blocked','closed','revoked']);
  function sendProtocol(){const api=sendContract||root.EraseSendContract;if(!api?.ROUTES||typeof api.preview!=='function')throw new WorkspaceError('Refresh before reviewing a removal-only email.',409);return api;}
  function sendClaims(capability){
    try{
      if(!sendProtocol().CAP.test(capability||''))throw new Error();
      const encoded=capability.split('.')[1],alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';let bits=0,count=0,decoded='';
      for(const char of encoded){const value=alphabet.indexOf(char);if(value<0)throw new Error();bits=(bits<<6)|value;count+=6;if(count>=8){count-=8;decoded+=String.fromCharCode((bits>>>count)&255);}}
      const claims=JSON.parse(decoded),keys=['v','route_id','operation_id','workspace_id','personal_email_sha256','account','request_id','message_digest','issued_at','expires_at'];
      if(!sendProtocol().exact(claims,keys)||claims.v!==1||!Object.hasOwn(sendProtocol().ROUTES,claims.route_id)||!OPERATION.test(claims.operation_id||'')||!OPERATION.test(claims.workspace_id||'')||
        !['personal_email_sha256','account','message_digest'].every(key=>/^[a-f0-9]{64}$/.test(claims[key]||''))||!/^[a-f0-9]{32}$/.test(claims.request_id||'')||!Number.isSafeInteger(claims.issued_at)||!Number.isSafeInteger(claims.expires_at)||claims.expires_at-claims.issued_at!==900)throw new Error();
      return claims;
    }catch(_){throw new WorkspaceError('The removal-only email capability is invalid. No send was authorized.',409);}
  }
  function sendRecord(value,id,operationId,profileId){
    const required=['id','workspace_id','source','phase','created_at','closed','revocation_confirmed','attempt_started','context_digest'];
    const optional=['request_id','capability','message_digest','expires_at','closure_id','observed_at','result','message_id','thread_id'];
    if(!value||!Object.hasOwn(sendProtocol().ROUTES,id)||!required.every(key=>Object.hasOwn(value,key))||Object.keys(value).some(key=>![...required,...optional].includes(key))||
      !OPERATION.test(value.id||'')||value.id!==operationId||!OPERATION.test(value.workspace_id||'')||!['local_native','imported_user_history'].includes(value.source)||
      value.source==='local_native'&&value.workspace_id!==profileId||!SEND_PHASES.has(value.phase)||!['closed','revocation_confirmed','attempt_started'].every(key=>typeof value[key]==='boolean')||
      !/^[a-f0-9]{64}$/.test(value.context_digest||'')||typeof value.created_at!=='string'||value.created_at.length>40||!Number.isFinite(Date.parse(value.created_at))||
      value.request_id!==undefined&&!/^[a-f0-9]{32}$/.test(value.request_id)||value.closure_id!==undefined&&!OPERATION.test(value.closure_id)||
      value.observed_at!==undefined&&(typeof value.observed_at!=='string'||value.observed_at.length>40||!Number.isFinite(Date.parse(value.observed_at)))||
      value.result!==undefined&&!['provider_accepted','unknown','ready','revoked','already_started','preparing','blocked'].includes(value.result)||
      ['message_id','thread_id'].some(key=>value[key]!==undefined&&!(typeof value[key]==='string'&&/^[A-Za-z0-9_-]{1,128}$/.test(value[key])))||
      value.revocation_confirmed&&(!value.closed||value.phase!=='revoked')||value.source==='imported_user_history'&&(!value.closed||value.revocation_confirmed)||
      ['ready','sending','provider_accepted'].includes(value.phase)&&!value.capability||['sending','provider_accepted'].includes(value.phase)&&!value.attempt_started||
      value.phase==='provider_accepted'&&(value.result!=='provider_accepted'||!value.message_id||!value.thread_id))throw new WorkspaceError('Invalid private outbound email history.');
    if(value.capability!==undefined){const claims=sendClaims(value.capability);if(claims.route_id!==id||claims.operation_id!==value.id||claims.workspace_id!==value.workspace_id||claims.request_id!==value.request_id||claims.message_digest!==value.message_digest||claims.expires_at!==value.expires_at)throw new WorkspaceError('The private outbound capability does not match its history.');}
    else if(['message_digest','expires_at'].some(key=>value[key]!==undefined))throw new WorkspaceError('The private outbound capability is missing.');
    return clone(value);
  }
  const TEXT = {
    ready: 'Ready to open the official broker form. No request has been sent.',
    opened: 'The official form was opened. Opening it does not send a removal request.',
    prepared: 'Fields were prepared in the broker form. Complete the broker steps yourself.',
    needs_broker_step: 'Fields were prepared in the broker form. Complete the broker steps yourself. No request has been sent by the companion.',
    running: 'A broker action was started. Its result has not yet been established.',
    verification_sent: 'The broker accepted a verification-email step. Complete its email and portal steps yourself.',
    requested: 'The broker accepted a removal request. Deletion has not been verified.',
    user_reported_requested: 'You reported submitting a removal request. Broker acceptance has not been independently verified.',
    user_reported_completed: 'You reported finishing the broker steps. Deletion has not been independently verified.',
    blocked: 'The broker needs your attention. No completed removal has been established.',
    uncertain: 'The action outcome is unknown. Do not repeat it until you check the broker result.',
    held: 'You put this route on hold. No new broker or mailbox action will start until you explicitly resume it.'
  };
  class WorkspaceError extends Error {
    constructor(message, status = 400) { super(message); this.status = status; }
  }
  const clone = value => JSON.parse(JSON.stringify(value));
  function text(value, max, required = true) {
    if (typeof value !== 'string' || value.length > max || /[\u0000-\u001f\u007f]/.test(value)) throw new WorkspaceError('Invalid profile or request field.');
    const result = value.trim().replace(/\s+/g, ' ');
    if (required && !result) throw new WorkspaceError('A required profile field is missing.');
    return result;
  }
  function email(value) {
    const result = text(value, 254);
    if (!/^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/.test(result)) throw new WorkspaceError('Enter a valid email address.');
    const [local, suppliedDomain] = result.split('@');
    let domain;
    try {
      if (/[\\/:?#%]/.test(suppliedDomain)) throw new Error();
      domain = new URL('https://' + suppliedDomain).hostname;
      if (domain.length > 253 || !domain.split('.').every(label => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label))) throw new Error();
    } catch (_) { throw new WorkspaceError('Enter a valid email address.'); }
    const normalized = local + '@' + domain;
    if (normalized.length > 254) throw new WorkspaceError('Enter a valid email address.');
    return normalized;
  }
  function routeFor(id) {
    const route = routes.find(item => item.id === id);
    if (!route) throw new WorkspaceError('Choose a supported broker route.', 404);
    return route;
  }
  function listingURL(value, route) {
    const raw = text(value, 2048);
    let url;
    try { url = new URL(raw); } catch (_) { throw new WorkspaceError('Enter an official listing URL.'); }
    if (url.protocol !== 'https:' || url.username || url.password || url.port || url.hash || url.search ||
        !route.allowedHosts.includes(url.hostname) || !/^\/[A-Za-z0-9][A-Za-z0-9/_-]*$/.test(url.pathname) ||
        /^\/(?:optout|opt-out|privacy|account|login|remove|removal|policies)(?:\/|$)/i.test(url.pathname)) {
      throw new WorkspaceError('Use a direct HTTPS listing URL on this broker’s approved domain, without query parameters.');
    }
    if (route.id === 'spokeo') {
      const segments = url.pathname.slice(1).split('/'), slug = /^[A-Za-z0-9]+(?:-[A-Za-z0-9]+)*$/;
      const states = new Set('Alabama Alaska Arizona Arkansas California Colorado Connecticut Delaware Florida Georgia Hawaii Idaho Illinois Indiana Iowa Kansas Kentucky Louisiana Maine Maryland Massachusetts Michigan Minnesota Mississippi Missouri Montana Nebraska Nevada Ohio Oklahoma Oregon Pennsylvania Tennessee Texas Utah Vermont Virginia Washington Wisconsin Wyoming New-Hampshire New-Jersey New-Mexico New-York North-Carolina North-Dakota Rhode-Island South-Carolina South-Dakota West-Virginia District-of-Columbia'.toLowerCase().split(' '));
      const abbreviation = /^(AL|AK|AZ|AR|CA|CO|CT|DE|DC|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY)$/;
      if (url.hostname !== 'www.spokeo.com' || segments.length !== 4 || !/^[A-Za-z0-9]+(?:-[A-Za-z0-9]+)+$/.test(segments[0]) ||
          !/^p\d{1,64}$/.test(segments[3]) || !(slug.test(segments[1]) && abbreviation.test(segments[2]) || states.has(segments[1].toLowerCase()) && slug.test(segments[2])))
        throw new WorkspaceError('Use the exact Spokeo person record URL, including its state, city and p-number. Confirm it is your own record.');
    }
    if (route.id === 'whitepages' && (url.hostname !== 'www.whitepages.com' ||
        !/^\/name\/[A-Za-z0-9-]{1,256}\/[A-Za-z0-9-]{1,256}\/[A-Za-z0-9_-]{1,512}$/.test(url.pathname)))
      throw new WorkspaceError('Use your direct Whitepages person-record URL, including its name, location and record ID. Review that this exact listing is your own.');
    return url.href;
  }
  function appliesToCountry(route, country) {
    return route.countries.includes('*') || Boolean(country && route.countries.includes(country));
  }
  function operationStarted(item) {
    return item.held === true || Boolean(item.operation_id) || USER_STATES.has(item.status) || ['running', 'verification_sent', 'requested', 'uncertain', 'needs_broker_step'].includes(item.status);
  }
  function requestText(value) {
    if (typeof value !== 'string' || value.length > 5000 || value.trim().length < 10 || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value))
      throw new WorkspaceError('Enter request text from 10 to 5000 characters without unsupported control characters.');
    return value.replace(/\r\n?/g, '\n');
  }
  function phone(value) {
    if (typeof value !== 'string' || value.length > 40 || !/^\+?[0-9 ().-]+$/.test(value) || !/^\d{7,15}$/.test(value.replace(/\D/g, '')))
      throw new WorkspaceError('Enter your own phone number using 7 to 15 digits and ordinary phone separators.');
    return value;
  }
  function brokerField(route, key, value) {
    if (key === 'listing_url') return listingURL(value, route);
    if (['email', 'business_email'].includes(key)) return email(value);
    if (key === 'request_text') return requestText(value);
    if (key === 'phone') return phone(value);
    const result = text(value, 120);
    if (['full_name', 'first_name', 'last_name'].includes(key) && /[<>]/.test(result)) throw new WorkspaceError('Enter a plain name without angle brackets.');
    return result;
  }
  function approvedFields(route, fields) {
    if (!fields || typeof fields !== 'object' || Array.isArray(fields)) throw new WorkspaceError('Supply approved broker fields.');
    const approved = {};
    for (const [key, value] of Object.entries(fields)) {
      if (!route.fields.includes(key) || key === 'email') throw new WorkspaceError('This broker field is not editable here.');
      approved[key] = brokerField(route, key, value);
    }
    return approved;
  }
  function approvedAffirmations(route, value) {
    if (!value || typeof value !== 'object' || Array.isArray(value) ||
        Object.entries(value).some(([key, confirmed]) => !route.requiredAffirmations.includes(key) || typeof confirmed !== 'boolean'))
      throw new WorkspaceError('Review only the confirmations required by this broker.');
    return { ...value };
  }
  function locationFields(body) {
    const next = {};
    for (const key of Object.keys(body)) {
      if (!['country', 'region', 'city'].includes(key)) throw new WorkspaceError('Only location fields can be changed here.');
      if (body[key] == null) { next[key] = null; continue; }
      const value = text(body[key], key === 'country' ? 2 : key === 'region' ? 12 : 120, false);
      if (key === 'country' && value && !/^[A-Za-z]{2}$/.test(value)) throw new WorkspaceError('Use a two-letter country code.');
      next[key] = value ? (key === 'country' ? value.toUpperCase() : value) : null;
    }
    return next;
  }
  function mailContact(value, routeId, operationId, now, allowExpired = false) {
    if (!MAIL_ROUTES.has(routeId) || !OPERATION.test(operationId) || !value || typeof value !== 'object' || Array.isArray(value))
      throw new WorkspaceError('Choose a supported removal contact operation.');
    const { capability, request_id, route_id, operation_id, contact_email, expires_at } = value;
    if (route_id !== routeId || operation_id !== operationId || typeof request_id !== 'string' || !/^[a-f0-9]{32}$/.test(request_id) ||
        typeof capability !== 'string' || capability.length > 2048 || !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]{43}$/.test(capability) ||
        !Number.isSafeInteger(expires_at) || typeof contact_email !== 'string') throw new WorkspaceError('The removal contact does not match this operation.');
    let claims;
    try {
      const encoded = capability.split('.')[0], alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
      if (encoded.length > 1800 || encoded.length % 4 === 1) throw new Error();
      let bits = 0, count = 0, decoded = '';
      for (const char of encoded) {
        bits = (bits << 6) | alphabet.indexOf(char); count += 6;
        if (count >= 8) { count -= 8; decoded += String.fromCharCode((bits >>> count) & 255); }
      }
      claims = JSON.parse(decoded);
    } catch (_) { throw new WorkspaceError('The removal contact capability is malformed.'); }
    const keys = ['v', 'request_id', 'route_id', 'operation_id', 'recipient', 'issued_at', 'expires_at'];
    if (!claims || typeof claims !== 'object' || Array.isArray(claims) || Object.keys(claims).length !== keys.length || !keys.every(key => Object.hasOwn(claims, key)) ||
        claims.v !== 1 || claims.request_id !== request_id || claims.route_id !== routeId || claims.operation_id !== operationId ||
        claims.recipient !== contact_email || claims.expires_at !== expires_at || !Number.isSafeInteger(claims.issued_at) ||
        expires_at - claims.issued_at !== 7 * 86400 || claims.issued_at > now + 60 ||
        email(contact_email) !== contact_email || !new RegExp('^[a-z0-9._-]{1,25}\\+erase-' + request_id + '@').test(contact_email))
      throw new WorkspaceError('The removal contact does not match this operation.');
    if (!allowExpired && expires_at <= now) throw new WorkspaceError('This removal contact has expired. No request was repeated.', 410);
    // The server verifies the signature; this local check prevents accidental
    // route/recipient mixups and never establishes broker acceptance.
    if(value.transport!==undefined&&value.transport!=='local_native'||value.transport===undefined&&(value.workspace_id!==undefined||value.revoked!==undefined))throw new WorkspaceError('The removal contact transport is unsupported.');
    if(value.transport==='local_native'&&(!OPERATION.test(value.workspace_id||'')||value.revoked!==undefined&&typeof value.revoked!=='boolean'))throw new WorkspaceError('The local removal contact workspace is invalid.');
    return { capability, request_id, route_id, operation_id, contact_email, expires_at,
      ...(value.transport==='local_native'?{transport:'local_native',workspace_id:value.workspace_id,...(value.revoked===true?{revoked:true}:{})}:{}) };
  }
  function confirmationURL(value, routeId = 'usphonebook', fields = null) {
    try {
      if (typeof value !== 'string' || value.length > 2048 || /\s/.test(value)) return false;
      if(routeId==='fastpeoplesearch'){
        if(!value.startsWith('https://www.fastpeoplesearch.com/optout/removal?')||/[\\\x00-\x1f\x7f]/.test(value)||/%(?![0-9a-f]{2})/i.test(value)||!fields)return false;
        const u=new URL(value),keys=['firstname','middlename','lastname','email','ticketid'];
        return !u.username&&!u.password&&!u.port&&!u.hash&&u.pathname==='/optout/removal'&&[...u.searchParams].length===5&&keys.every(key=>u.searchParams.getAll(key).length===1)&&
          u.searchParams.get('firstname')===fields.first_name&&u.searchParams.get('lastname')===fields.last_name&&u.searchParams.get('email')===fields.email&&
          u.searchParams.get('middlename')===''&&/^[0-9]{1,32}$/.test(u.searchParams.get('ticketid'));
      }
      if(routeId!=='usphonebook')return false;
      const u = new URL(value), key = u.searchParams.get('key');
      return u.protocol === 'https:' && u.hostname === 'www.usphonebook.com' && !u.port && !u.username && !u.password && !u.hash &&
        u.pathname === '/removal/validate-record-info' && [...u.searchParams].length === 2 &&
        u.searchParams.getAll('key').length === 1 && typeof key === 'string' && key.length <= 512 && /^[A-Za-z0-9_-]+={0,2}$/.test(key) &&
        u.searchParams.getAll('ticketid').length === 1 && /^[0-9]{1,32}$/.test(u.searchParams.get('ticketid'));
    } catch (_) { return false; }
  }
  function create(options = {}) {
    const storage = options.storage || {
      getItem: key => root.localStorage.getItem(key),
      setItem: (key, value) => root.localStorage.setItem(key, value),
      removeItem: key => root.localStorage.removeItem(key)
    };
    const clock = options.now || (() => new Date().toISOString());
    const uuid = options.uuid || (() => root.crypto.randomUUID());
    let state;
    let cachedRaw;
    let deferredRecovery = false;
    const emptyFootprint = () => ({ version: 1, items: [], updated_at: null });
    const planner = () => {
      const value = footprintPlanner || root.EraseFootprintPlanner;
      if (!value) throw new WorkspaceError('Reload the workspace before changing a cleanup plan.', 503);
      return value;
    };
    function validatedFootprint(value, imported = false) {
      if (value === undefined) return emptyFootprint();
      const library = footprintPlanner || root.EraseFootprintPlanner;
      // Earlier embedded clients can still read workspaces without planner data.
      if (!library && value?.version === 1 && Array.isArray(value.items) && value.items.length === 0 && value.updated_at === null && Object.keys(value).length === 3) return emptyFootprint();
      try { return planner().normalize(value, { imported }); }
      catch (error) { if (error instanceof WorkspaceError) throw error; throw new WorkspaceError('The saved cleanup plan is invalid. No external action was started.', 409); }
    }
    function empty() { return { version: VERSION, profile: null, campaign: { status: 'active' }, items: {}, activity: [], footprint: emptyFootprint() }; }
    const exactKeys = (value, keys) => value !== null && typeof value === 'object' && !Array.isArray(value) &&
      Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));
    function finalSubmission(value, routeId, operationId) {
      const required = ['id', 'started_at', 'result', 'attempt_verified', 'acceptance_verified', 'deletion_verified'];
      const allowed = new Set([...required, 'observed_at', 'source']);
      if (routeId !== 'fastpeoplesearch' || !OPERATION.test(operationId || '') || !value || typeof value !== 'object' || Array.isArray(value) ||
          !required.every(key => Object.hasOwn(value, key)) || Object.keys(value).some(key => !allowed.has(key)) ||
          !OPERATION.test(value.id || '') || !Number.isFinite(matchingTime(value.started_at)) ||
          !['unknown', 'blocked', 'submission_attempted'].includes(value.result) || typeof value.attempt_verified !== 'boolean' ||
          value.acceptance_verified !== false || value.deletion_verified !== false ||
          value.attempt_verified !== (value.result === 'submission_attempted') ||
          value.source !== undefined && value.source !== 'imported_user_history' ||
          value.source === 'imported_user_history' && (value.result !== 'unknown' || value.attempt_verified !== false) ||
          value.observed_at !== undefined && (!Number.isFinite(matchingTime(value.observed_at)) || matchingTime(value.observed_at) < matchingTime(value.started_at)))
        throw new WorkspaceError('The saved final submission reference is invalid. No repeat is authorized.', 409);
      return clone(value);
    }
    const identity = profile => ({ name: profile.name, email: profile.email, age: profile.age, city: profile.city || null });
    function matchingTime(value) {
      if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value)) return NaN;
      const stamp = Date.parse(value);
      return Number.isFinite(stamp) && new Date(stamp).toISOString().slice(0, 19) === value.slice(0, 19) ? stamp : NaN;
    }
    function validMatchingRequest(item, profile) {
      const request = item?.matching_request;
      if (item?.site_id !== 'spokeo' || !profile || !exactKeys(request, ['id', 'profile_id', 'country', 'listing_url', 'identity', 'created_at']) ||
          typeof request.id !== 'string' || !OPERATION.test(request.id) || typeof request.profile_id !== 'string' || request.profile_id !== profile.id || request.country !== (profile.country || null) ||
          !exactKeys(request.identity, ['name', 'email', 'age', 'city']) ||
          Object.entries(identity(profile)).some(([key, value]) => request.identity[key] !== value)) return false;
      const started = matchingTime(request.created_at), stamp = Date.parse(clock());
      if (!Number.isFinite(started) || !Number.isFinite(stamp) ||
          started > stamp || stamp - started > MATCH_LIFETIME || item.fields?.listing_url !== request.listing_url ||
          !appliesToCountry(routeFor('spokeo'), profile.country)) return false;
      try { return listingURL(request.listing_url, routeFor('spokeo')) === request.listing_url; } catch (_) { return false; }
    }
    function validMatchingResult(item, profile) {
      if (!validMatchingRequest(item, profile)) return false;
      const result = item.match_result, request = item.matching_request;
      if (!exactKeys(result, ['request_id', 'status', 'candidate_url', 'evidence', 'source', 'verified', 'observed_at']) ||
          result.request_id !== request.id || !MATCH_STATES.has(result.status) || result.candidate_url !== request.listing_url ||
          !Array.isArray(result.evidence) || result.evidence.length > MATCH_EVIDENCE.size || new Set(result.evidence).size !== result.evidence.length ||
          result.evidence.some(key => !MATCH_EVIDENCE.has(key)) || ![null, 'structured_person_v1'].includes(result.source) || typeof result.verified !== 'boolean') return false;
      const observed = matchingTime(result.observed_at), stamp = Date.parse(clock());
      if (!Number.isFinite(observed) ||
          observed < Date.parse(request.created_at) || observed > stamp) return false;
      const strong = result.status === 'matched' && result.source === 'structured_person_v1' &&
        ['structured_person', 'exact_candidate_url', 'name', 'email'].every(key => result.evidence.includes(key));
      return result.verified === strong;
    }
    const automaticMatch = (item, profile = state.profile) => validMatchingResult(item, profile) && item.match_result.status === 'matched' && item.match_result.verified;
    const effectiveAffirmations = (route, item) => ({ ...(item.affirmations || {}),
      ...(route.id === 'spokeo' && automaticMatch(item) ? { own_listing: true } : {}) });
    function clearMatch(item, forgetSource = false) { delete item.matching_request; delete item.match_result; if (forgetSource) delete item.automatic_match_seen; }
    function recoverRunning() {
      deferredRecovery = false;
      let changed = false;
      for (const item of Object.values(state.items)) if (item.status === 'running') {
        item.status = 'uncertain'; item.detail = TEXT.uncertain; changed = true;
      }
      if (changed) save();
    }
    function read(recover = true) {
      let raw;
      try { raw = storage.getItem(KEY); } catch (_) { throw new WorkspaceError('Browser storage is unavailable. Enable local storage to save your workspace.', 503); }
      if (state && raw === cachedRaw) {
        if (recover && deferredRecovery) recoverRunning();
        return state;
      }
      cachedRaw = raw;
      if (!raw) { state = empty(); deferredRecovery = false; return state; }
      try {
        const parsed = JSON.parse(raw);
        if (!parsed || parsed.version !== VERSION || !parsed.items || !Array.isArray(parsed.activity) ||
            !parsed.campaign || !['active', 'paused'].includes(parsed.campaign.status)) throw new Error();
        if (parsed.profile && (!parsed.profile.id || typeof parsed.profile.name !== 'string' || !Number.isInteger(parsed.profile.age) || typeof parsed.profile.email !== 'string')) throw new Error();
        if (parsed.profile) {
          text(parsed.profile.name, 120); email(parsed.profile.email);
          if (parsed.profile.age < 18 || parsed.profile.age > 120) throw new Error();
          parsed.profile.verification_method = 'self_attested_browser'; parsed.profile.email_verified = false;
        }
        for (const [id, item] of Object.entries(parsed.items)) {
          const knownRoute = routeFor(id);
          if (!item || item.site_id !== id || !Object.hasOwn(TEXT, item.status)) throw new Error();
          if (item.held !== undefined && typeof item.held !== 'boolean') throw new Error();
          if (item.affirmations) item.affirmations = approvedAffirmations(knownRoute, item.affirmations);
          item.url = knownRoute.url; item.name = knownRoute.name; item.domain = knownRoute.domain;
          if (item.mail_contact) {
            item.mail_contact = mailContact(item.mail_contact, id, item.operation_id || item.id, Math.floor(Date.parse(clock()) / 1000), true);
            if(item.mail_contact.transport==='local_native'&&item.mail_contact.workspace_id!==parsed.profile.id&&item.mail_contact.revoked!==true)throw new Error('Local mail workspace mismatch.');
          }
          if (item.operation_source !== undefined && !['browser_workspace', 'imported_user_history'].includes(item.operation_source)) throw new Error();
          if (item.operation_email !== undefined || item.operation_email_role !== undefined) {
            if (!item.operation_id || email(item.operation_email) !== item.operation_email ||
                !['profile', 'business', 'removal'].includes(item.operation_email_role)) throw new Error();
          }
          if (Object.hasOwn(item, 'final_submission')) item.final_submission = finalSubmission(item.final_submission, id, item.operation_id);
          if (Object.hasOwn(item, 'mail_send')) item.mail_send = sendRecord(item.mail_send,id,item.operation_id,parsed.profile.id);
          if (!validMatchingRequest(item, parsed.profile)) clearMatch(item);
          else if (item.match_result && !validMatchingResult(item, parsed.profile)) delete item.match_result;
        }
        parsed.footprint = validatedFootprint(parsed.footprint);
        state = parsed;
        // A browser closed during a write cannot safely establish its outcome.
        // A read-only preview defers that write until the next normal read.
        deferredRecovery = options.recoverInterrupted !== false && Object.values(state.items).some(item => item.status === 'running');
        if (recover && deferredRecovery) recoverRunning();
        return state;
      } catch (error) {
        if (error instanceof WorkspaceError && error.status === 503) throw error;
        state = undefined; deferredRecovery = false;
        throw new WorkspaceError('Saved workspace data could not be read. Export or clear this workspace before starting again.', 409);
      }
    }
    function save() {
      try {
        const encoded = JSON.stringify(state);
        storage.setItem(KEY, encoded); cachedRaw = encoded;
      }
      catch (_) { state = undefined; throw new WorkspaceError('Your browser could not save this change. No broker action should start until storage works.', 503); }
    }
    function active(recover = true) {
      const current = read(recover);
      if (!current.profile) throw new WorkspaceError('Create a workspace on this browser first.', 401);
      return current;
    }
    function event(message) { state.activity.unshift({ at: clock(), message }); state.activity = state.activity.slice(0, 150); }
    function seed() {
      for (const route of routes) if (!state.items[route.id]) state.items[route.id] = {
        id: uuid(), site_id: route.id, name: route.name, domain: route.domain, status: 'ready', detail: TEXT.ready,
        url: route.url, updated_at: clock(), fields: {}, operation_id: null, operation_started_at: null, evidence: null
      };
    }
    function itemFor(id, recover = true) { active(recover); routeFor(id); const item = state.items[id]; if (!item) throw new WorkspaceError('Run your route plan first.', 409); return item; }
    function requireNotHeld(item) {
      if (item.held === true) throw new WorkspaceError('This route is on hold. Explicitly resume it before starting or changing an action.', 409);
    }
    function requireCountryRoute(route, item) {
      if (!appliesToCountry(route, state.profile.country) && !operationStarted(item))
        throw new WorkspaceError('This route is outside your selected country. Update your location to choose the applicable routes.', 409);
    }
    function changed(item, status, detail) { item.status = status; item.detail = detail || TEXT[status]; item.updated_at = clock(); }
    function signup(data) {
      read();
      if (state.profile) throw new WorkspaceError('A workspace already exists in this browser. Open it or delete it before creating another.', 409);
      if (data.authorized !== true) throw new WorkspaceError('Authorize requests for your own information first.');
      const name = text(data.name, 120), address = email(data.email), age = data.age;
      if (!Number.isInteger(age) || age < 18 || age > 120) throw new WorkspaceError('Enter an age from 18 to 120.');
      state.profile = { id: uuid(), name, age, email: address, country: null, region: null, city: null,
        verification_method: 'self_attested_browser', email_verified: false, authorized_at: clock(), authorization_statement: AUTHORIZATION };
      state.campaign.status = 'active';
      seed(); event('Workspace saved on this browser. No broker was contacted and email ownership is unverified.'); save();
      return { ok: true };
    }
    function dashboard() {
      active();
      const country = state.profile.country;
      const eligible = routes.filter(route => appliesToCountry(route, country));
      const historical = Object.values(state.items).filter(item => !appliesToCountry(routeFor(item.site_id), country) && operationStarted(item));
      const items = Object.values(state.items).filter(item => appliesToCountry(routeFor(item.site_id), country) || operationStarted(item)).map(({ fields, operation_id, operation_started_at, evidence, mail_contact, mail_send, matching_request, match_result, ...item }) => ({
        ...item, status: item.held ? 'held' : item.status, detail: item.held ? TEXT.held : item.detail,
        affirmations: clone(effectiveAffirmations(routeFor(item.site_id), { ...item, fields, matching_request, match_result })),
        automatic_match: automaticMatch({ ...item, fields, matching_request, match_result }),
        match_reference: automaticMatch({ ...item, fields, matching_request, match_result }) ? matching_request.id : null,
        match_status: validMatchingRequest({ ...item, fields, matching_request, match_result }, state.profile)
          ? validMatchingResult({ ...item, fields, matching_request, match_result }, state.profile) ? match_result.status : 'pending' : null,
        input_fields: clone(fields || {}), automationLevel: routeFor(item.site_id).automationLevel, fields_needed: routeFor(item.site_id).fields,
        operation_id, evidence: evidence ? clone(evidence) : null,
        mail_contact: mail_contact ? { ...mail_contact, capability: undefined } : null,
        mail_send: mail_send ? { ...mail_send, capability: undefined } : null
      }));
      return { mode: 'browser', profile: clone(state.profile), campaign: { status: state.campaign.status,
        authorized_at: state.profile.authorized_at, next_check_at: null, run_in_progress: false },
        counts: { found: 0, requested: items.filter(item => item.evidence && item.evidence.acceptance_verified === true).length, removed: 0,
          blocked: items.filter(item => ['held', 'blocked', 'uncertain', 'verification_sent', 'needs_broker_step'].includes(item.status)).length },
        coverage: { country, supportedCountries: [...new Set(routes.flatMap(route => route.countries).filter(value => value !== '*'))].sort(),
          globalRouteCount: eligible.filter(route => route.countries.includes('*')).length,
          countryRouteCount: eligible.filter(route => !route.countries.includes('*')).length,
          companionRouteCount: eligible.filter(route => route.automationLevel === 'companion').length,
          manualRouteCount: eligible.filter(route => route.automationLevel === 'manual').length,
          routeCount: eligible.length, historicalRouteCount: historical.length,
          unplannedRouteCount: eligible.filter(route => !state.items[route.id]).length,
          hasCountryPack: Boolean(country && eligible.some(route => !route.countries.includes('*'))),
          independentDeletionVerification: false },
        items, questions: country ? [] : [{ id: 'country', field: 'country', prompt: 'Which country do you live in? This selects the regional privacy routes. Global portals are available meanwhile.' }],
        activity: clone(state.activity), footprint: (footprintPlanner || root.EraseFootprintPlanner) ? planner().view(state.footprint) : clone(state.footprint) };
    }
    function setEvidence(id, fields, affirmations = {}, review = {}) {
      const route = routeFor(id), item = itemFor(id);
      requireNotHeld(item);
      if (item.operation_id) throw new WorkspaceError('This action has already started. Check its result before changing submitted fields.', 409);
      const approved = approvedFields(route, fields);
      const confirmations = approvedAffirmations(route, affirmations);
      const derived = id === 'spokeo' && automaticMatch(item);
      const reviewKeys=Object.keys(review || {});
      if (!exactKeys(review, reviewKeys) || reviewKeys.length > 1 || reviewKeys.some(key=>!['automaticReference','manualListingReview'].includes(key)) ||
          reviewKeys.length && !['spokeo','whitepages'].includes(id) || review.manualListingReview !== undefined && review.manualListingReview !== true ||
          review.automaticReference !== undefined && (typeof review.automaticReference !== 'string' || !OPERATION.test(review.automaticReference)))
        throw new WorkspaceError('Review the source of this listing confirmation again.');
      const manualReview=Object.hasOwn(review,'manualListingReview')&&review.manualListingReview===true;
      if (id === 'whitepages' && (review.automaticReference !== undefined || confirmations.own_listing === true && !manualReview &&
          !(item.affirmations?.own_listing === true && item.fields?.listing_url &&
            (!Object.hasOwn(approved,'listing_url') || approved.listing_url === item.fields.listing_url))))
        throw new WorkspaceError('Explicitly review and confirm this exact Whitepages listing yourself before filling. Automatic matching is not supported for this route.', 409);
      if (id === 'spokeo' && confirmations.own_listing === true &&
          (review.automaticReference !== undefined && (!derived || item.matching_request.id !== review.automaticReference ||
            approved.listing_url !== undefined && approved.listing_url !== item.fields?.listing_url) ||
           item.automatic_match_seen === true && !derived && !manualReview))
        throw new WorkspaceError('The automatic match expired or changed. Match it again, or explicitly review and confirm the listing yourself.', 409);
      if (id === 'spokeo' && (Object.hasOwn(approved, 'listing_url') && approved.listing_url !== item.fields?.listing_url || confirmations.own_listing === false)) clearMatch(item, confirmations.own_listing === false);
      // A displayed derived approval is not a new manual claim by the person.
      if (derived && automaticMatch(item) && confirmations.own_listing === true && !manualReview) delete confirmations.own_listing;
      item.fields = { ...item.fields, ...approved }; item.affirmations = confirmations;
      item.updated_at = clock(); save(); return clone(item.fields);
    }
    function matchRequest(id, listingUrl) {
      const route = routeFor(id), item = itemFor(id);
      if (id !== 'spokeo') throw new WorkspaceError('This route has no reviewed structured-record matching contract.');
      requireNotHeld(item); requireCountryRoute(route, item);
      if (state.campaign.status !== 'active') throw new WorkspaceError('Allow checks before matching a broker record.', 409);
      if (operationStarted(item)) throw new WorkspaceError('This removal action already started. Check its existing result instead of matching another record.', 409);
      const url = listingURL(listingUrl, route);
      if (validMatchingRequest(item, state.profile) && !item.match_result && item.matching_request.listing_url === url)
        throw new WorkspaceError('This matching check already started. Check its existing result before starting another.', 409);
      const requestId = uuid();
      if (!OPERATION.test(requestId)) throw new WorkspaceError('A private matching reference could not be created.', 503);
      item.fields = { ...(item.fields || {}), listing_url: url };
      item.affirmations = { ...(item.affirmations || {}), own_listing: false };
      item.matching_request = { id: requestId, profile_id: state.profile.id, country: state.profile.country || null,
        listing_url: url, identity: identity(state.profile), created_at: clock() };
      delete item.match_result; item.updated_at = clock();
      event('You started a structured-record identity check for ' + route.name + '. No removal form was started.'); save();
      return { routeId: id, operationId: requestId, listingUrl: url, identity: clone(item.matching_request.identity), authorized: true };
    }
    function recordMatch(id, matchOperationId, result) {
      const route = routeFor(id), item = itemFor(id);
      requireNotHeld(item); requireCountryRoute(route, item);
      if (id !== 'spokeo' || state.campaign.status !== 'active' || operationStarted(item) ||
          !validMatchingRequest(item, state.profile) || item.matching_request.id !== matchOperationId)
        throw new WorkspaceError('The matching result does not match a current authorized identity check.', 409);
      if (!result || typeof result !== 'object' || Array.isArray(result) ||
          Object.keys(result).some(key => !['status', 'candidateUrl', 'evidence', 'source', 'match_verified', 'detail'].includes(key)) ||
          ![...MATCH_STATES, 'unknown'].includes(result.status) ||
          result.candidateUrl !== undefined && result.candidateUrl !== item.matching_request.listing_url ||
          result.evidence !== undefined && (!Array.isArray(result.evidence) || result.evidence.length > MATCH_EVIDENCE.size ||
            new Set(result.evidence).size !== result.evidence.length || result.evidence.some(key => !MATCH_EVIDENCE.has(key))) ||
          result.match_verified !== undefined && typeof result.match_verified !== 'boolean')
        throw new WorkspaceError('The matching result is invalid. No identity approval was recorded.');
      const evidence = result.evidence || [];
      const verified = result.status === 'matched' && result.match_verified === true && result.source === 'structured_person_v1' &&
        result.candidateUrl === item.matching_request.listing_url && ['structured_person', 'exact_candidate_url', 'name', 'email'].every(key => evidence.includes(key));
      const status = result.status === 'unknown' ? 'unsupported' : result.status === 'matched' && !verified ? 'needs_identity' : result.status;
      const stored = { request_id: matchOperationId, status, candidate_url: item.matching_request.listing_url,
        evidence: [...evidence], source: result.source === 'structured_person_v1' ? result.source : null, verified, observed_at: clock() };
      if (item.match_result) {
        if (Object.keys(stored).filter(key => key !== 'observed_at').every(key => JSON.stringify(stored[key]) === JSON.stringify(item.match_result[key]))) return dashboard();
        throw new WorkspaceError('This matching outcome is already recorded. Start a new explicit check for another outcome.', 409);
      }
      item.match_result = stored; item.updated_at = clock();
      if (verified) item.automatic_match_seen = true;
      event(route.name + (verified ? '. A structured record matched the approved name and identity email. This is not a removal request or deletion.' : '. The identity check did not establish an automatic listing approval. No removal request was started.'));
      save(); return dashboard();
    }
    function preparation(id, reviewed, recover = true) {
      const route = routeFor(id), item = itemFor(id, recover);
      if (route.transientPrefill === true) throw new WorkspaceError('Review this private form in its separate transient dialog before starting.', 409);
      requireNotHeld(item);
      requireCountryRoute(route, item);
      if (state.campaign.status !== 'active') throw new WorkspaceError('Allow checks before starting a broker action.', 409);
      if (item.operation_id || USER_STATES.has(item.status)) throw new WorkspaceError('This broker action has already started. Refresh its result or finish its broker steps instead of resending.', 409);
      const confirmations = effectiveAffirmations(route, item);
      if (reviewed !== undefined) {
        if (!reviewed || typeof reviewed !== 'object' || Array.isArray(reviewed) || Object.keys(reviewed).length !== 2 || !Object.hasOwn(reviewed, 'fields') || !Object.hasOwn(reviewed, 'affirmations'))
          throw new WorkspaceError('Review the broker fields again before starting.');
        const reviewedFields = approvedFields(route, reviewed.fields), reviewedAffirmations = approvedAffirmations(route, reviewed.affirmations);
        if (Object.keys(reviewedFields).length !== Object.keys(item.fields).length || Object.entries(reviewedFields).some(([key, value]) => item.fields[key] !== value) ||
            route.requiredAffirmations.some(key => reviewedAffirmations[key] !== true || confirmations[key] !== true))
          throw new WorkspaceError('The broker fields changed in another tab. Review them again before starting.', 409);
      }
      const contact = item.mail_contact ? mailContact(item.mail_contact, id, item.id, Math.floor(Date.parse(clock()) / 1000)) : null;
      if(contact?.revoked===true)throw new WorkspaceError('This local removal-mail grant was revoked. Review the contact before starting a broker form.',409);
      if (id === 'searchpeoplefree' && contact && (contact.transport!=='local_native'||contact.workspace_id!==state.profile.id))
        throw new WorkspaceError('SearchPeopleFree requires an email you own. Explicitly remove this old shared contact before choosing your typed email. No fallback was sent.', 409);
      if (route.requiredAffirmations.some(key => confirmations[key] !== true))
        throw new WorkspaceError(route.requiredAffirmations.includes('own_request') ? 'Confirm this is your own request and review the fields before continuing.' : id === 'apollo' ? 'Confirm this is the business email associated with your own Apollo record.' : 'Confirm that this exact listing belongs to you.');
      const fields = {};
      for (const key of route.fields) {
        const value = key === 'email' ? (contact?.contact_email || state.profile.email) : item.fields[key];
        if (!value) throw new WorkspaceError('Provide the broker’s required ' + key.replace(/_/g, ' ') + ' first.');
        fields[key] = brokerField(route, key, value);
      }
      return { route, item, fields };
    }
    function prepare(id, reviewed) {
      const { route, item, fields } = preparation(id, reviewed);
      // The route's pre-existing UUID also deduplicates simultaneous tab dispatches.
      item.operation_id = item.id; item.operation_started_at = clock(); changed(item, 'running');
      item.operation_source = 'browser_workspace';
      const recipient = fields.email || fields.business_email;
      if (recipient) {
        item.operation_email = recipient;
        item.operation_email_role = fields.business_email ? 'business' : item.mail_contact ? 'removal' : 'profile';
      }
      event('You started the ' + route.name + ' broker action. Its result is not yet established.'); save();
      return { routeId: id, operationId: item.operation_id, fields, authorized: true,
        ...(id === 'apollo' ? { businessEmailConfirmed: true } : {}), ...(['spokeo','whitepages'].includes(id) ? { listingConfirmed: true } : {}),
        ...(route.requiredAffirmations.includes('own_request') ? { ownRequestConfirmed: true } : {}) };
    }
    function fillPreview(id) {
      if (routeFor(id).automationLevel !== 'companion')
        throw new WorkspaceError('This route has no reviewed companion form action. Use its official manual steps.');
      // Reviewing a batch never reserves operations or persists recovery updates.
      const { route, item, fields } = preparation(id, undefined, false);
      return clone({ routeId: id, operationId: item.id, profileId: state.profile.id, country: state.profile.country || null,
        fields, reviewed: { fields: approvedFields(route, item.fields || {}),
          affirmations: Object.fromEntries(route.requiredAffirmations.map(key => [key, effectiveAffirmations(route, item)[key]])) } });
    }
    function prepareReviewed(snapshot) {
      const exactKeys = (value, keys) => value !== null && typeof value === 'object' && !Array.isArray(value) &&
        Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));
      if (!exactKeys(snapshot, ['routeId', 'operationId', 'profileId', 'country', 'fields', 'reviewed']) ||
          typeof snapshot.routeId !== 'string' || typeof snapshot.operationId !== 'string' || typeof snapshot.profileId !== 'string' ||
          !(snapshot.country === null || typeof snapshot.country === 'string' && /^[A-Z]{2}$/.test(snapshot.country)) ||
          !exactKeys(snapshot.reviewed, ['fields', 'affirmations']))
        throw new WorkspaceError('Review the broker fields again before starting.');
      const current = fillPreview(snapshot.routeId);
      const sameFields = (left, right) => exactKeys(left, Object.keys(right)) && Object.keys(right).every(key => left[key] === right[key]);
      if (snapshot.operationId !== current.operationId || snapshot.profileId !== current.profileId || snapshot.country !== current.country ||
          !sameFields(snapshot.fields, current.fields) || !sameFields(snapshot.reviewed.fields, current.reviewed.fields) ||
          !sameFields(snapshot.reviewed.affirmations, current.reviewed.affirmations))
        throw new WorkspaceError('The reviewed broker fields or workspace changed. Review this batch entry again before starting.', 409);
      return prepare(snapshot.routeId, current.reviewed);
    }
    function mailSessionRequest(id, transport = 'private_pilot') {
      const route = routeFor(id), item = itemFor(id);
      requireNotHeld(item);
      requireCountryRoute(route, item);
      if(!['private_pilot','local_native'].includes(transport))throw new WorkspaceError('Choose a supported removal-mail transport.');
      if (!NEW_MAIL_ROUTES.has(id)&&!(id==='searchpeoplefree'&&transport==='local_native')) throw new WorkspaceError(id === 'searchpeoplefree' ? 'SearchPeopleFree requires an email you own. Use your explicitly typed email; new shared removal contacts are unavailable.' : 'This broker needs its record-associated email. A removal contact cannot replace it.');
      if (state.campaign.status !== 'active') throw new WorkspaceError('Allow checks before choosing a removal contact.', 409);
      if(item.local_mail_setup_closed===true)throw new WorkspaceError('This interrupted local mail setup is closed. Reconcile its grant locally before using another contact.',409);
      if (operationStarted(item)) throw new WorkspaceError('This action has already started. Its contact email cannot be changed.', 409);
      if (!OPERATION.test(item.id)) throw new WorkspaceError('This workspace operation has no valid private reference.', 409);
      if (item.mail_contact && item.mail_contact.expires_at > Math.floor(Date.parse(clock()) / 1000)) throw new WorkspaceError('This operation already has a removal contact.', 409);
      item.mail_contact_authorized_at = clock();
      item.mail_contact_transport_authorized = transport;
      event('You authorized a dedicated contact address for ' + route.name + '. No broker was contacted.'); save();
      return { route_id: id, operation_id: item.id, authorized: true };
    }
    function bindMailContact(id, response) {
      const item = itemFor(id);
      requireNotHeld(item);
      requireCountryRoute(routeFor(id), item);
      const transport=response?.transport||'private_pilot';
      if(item.local_mail_setup_closed===true)throw new WorkspaceError('This interrupted mail setup is closed. No contact can be bound until it is reconciled.',409);
      if (!NEW_MAIL_ROUTES.has(id)&&!(id==='searchpeoplefree'&&transport==='local_native')) throw new WorkspaceError('New shared removal contacts are not available for this route.');
      if (state.campaign.status !== 'active' || operationStarted(item)) throw new WorkspaceError('This action is paused or already started. Its contact email cannot be changed.', 409);
      if (!item.mail_contact_authorized_at) throw new WorkspaceError('Explicitly authorize the dedicated contact address first.');
      if(transport!==(item.mail_contact_transport_authorized||'private_pilot'))throw new WorkspaceError('Review this contact transport before binding its address.');
      const contact = mailContact(response, id, item.id, Math.floor(Date.parse(clock()) / 1000));
      if(contact.transport==='local_native'&&contact.workspace_id!==state.profile.id)throw new WorkspaceError('The local contact belongs to a different workspace.');
      if (item.mail_contact && item.mail_contact.expires_at > Math.floor(Date.parse(clock()) / 1000)) throw new WorkspaceError('This operation already has a removal contact.', 409);
      item.mail_contact = contact; item.updated_at = clock();
      event('The dedicated contact address is saved for ' + routeFor(id).name + '. Review it before starting the broker form.'); save();
      return dashboard();
    }
    function clearMailContact(id) {
      const item = itemFor(id);
      requireNotHeld(item);
      if (operationStarted(item)) throw new WorkspaceError('This action has already started. Its contact email cannot be changed.', 409);
      delete item.mail_contact; delete item.mail_contact_authorized_at; delete item.mail_contact_transport_authorized;
      event('You chose your typed profile email for ' + routeFor(id).name + '. No broker was contacted.'); save();
      return dashboard();
    }
    function reserveLocalMailSetupClosure(id,operationId,expectedProfileId,response){
      const contact=mailContact(response,id,operationId,Math.floor(Date.parse(clock())/1000),true);
      if(contact.transport!=='local_native'||contact.workspace_id!==expectedProfileId)throw new WorkspaceError('The cleanup does not match its original local grant.',409);
      const current=read();
      if(current.profile?.id!==expectedProfileId)return{status:'workspace_replaced'};
      const item=itemFor(id);
      if(item.id!==operationId)return{status:'operation_replaced'};
      const bound=item.mail_contact;
      // A pause stops reads; it does not invalidate another controller's exact
      // already-bound grant. This decision shares the binding write lock.
      if(bound?.transport==='local_native'&&bound.workspace_id===expectedProfileId&&bound.capability===contact.capability&&!bound.revoked&&!item.held)return{status:'already_bound'};
      if(item.local_mail_setup_closed===true)return{status:item.local_mail_cleanup_request_id===contact.request_id&&item.local_mail_setup_revocation_confirmed===true?'already_revoked':'already_reserved'};
      item.local_mail_setup_closed=true;item.local_mail_setup_cleanup_pending=true;item.local_mail_cleanup_request_id=contact.request_id;
      item.local_mail_setup_revocation_confirmed=false;item.held=true;item.held_at=clock();
      if(bound?.transport==='local_native'&&bound.capability===contact.capability)bound.revoked=true;
      event('A local mail cleanup was reserved. The route is held and this setup cannot bind another contact or resume mailbox reads.');save();return{status:'reserved'};
    }
    function recordLocalMailSetupClosure(id,operationId,expectedProfileId,revocationConfirmed,requestId){
      const current=read();
      if(current.profile?.id!==expectedProfileId)throw new WorkspaceError('The original local mail setup is no longer current.',409);
      const item=itemFor(id);
      if(item.id!==operationId||typeof revocationConfirmed!=='boolean')throw new WorkspaceError('The original local mail setup is no longer current.',409);
      if(requestId!==undefined){
        if(!item.local_mail_setup_closed||item.local_mail_cleanup_request_id!==requestId)throw new WorkspaceError('No matching local cleanup was reserved.',409);
        item.local_mail_setup_cleanup_pending=false;item.local_mail_setup_revocation_confirmed=revocationConfirmed;
      }else{
        if(item.operation_id||item.mail_contact)throw new WorkspaceError('The original local mail setup is no longer current.',409);
        item.local_mail_setup_closed=true;item.local_mail_setup_revocation_confirmed=revocationConfirmed;item.held=true;item.held_at=clock();
      }
      event('Local mail cleanup outcome recorded; '+(revocationConfirmed?'the unused grant was revoked.':'grant revocation requires local reconciliation.'));save();return dashboard();
    }
    function requireMailTransport(item, transport = 'private_pilot') {
      if(item.local_mail_setup_closed===true||!['private_pilot','local_native'].includes(transport)||(item.mail_contact?.transport||'private_pilot')!==transport||
        transport==='local_native'&&(item.mail_contact.workspace_id!==state.profile.id||item.mail_contact.revoked===true))throw new WorkspaceError('Use this contact’s original active removal-mail transport. No other mailbox was contacted.',409);
    }
    function mailCheckRequest(id, transport = 'private_pilot') {
      const item = itemFor(id);
      requireNotHeld(item);
      if (state.campaign.status !== 'active') throw new WorkspaceError('Allow checks before reading a removal receipt.', 409);
      if (!item.operation_id || !item.mail_contact) throw new WorkspaceError('Start the matching broker action before checking its removal contact.', 409);
      requireMailTransport(item,transport);
      const contact = mailContact(item.mail_contact, id, item.operation_id, Math.floor(Date.parse(clock()) / 1000));
      item.mail_check_authorized_at = clock(); save();
      return { capability: contact.capability, explicit: true };
    }
    function recordMailReceipt(id, result, transport = 'private_pilot') {
      const item = itemFor(id), now = Math.floor(Date.parse(clock()) / 1000);
      if (!item.mail_contact || !item.operation_id) throw new WorkspaceError('No matching removal contact operation is saved.', 409);
      requireMailTransport(item,transport);
      const contact = mailContact(item.mail_contact, id, item.operation_id, now, true);
      if (!result || result.route_id !== id || result.operation_id !== item.operation_id || result.request_id !== contact.request_id ||
          !['pending', 'held'].includes(result.status) || result.automatic_execution !== false) throw new WorkspaceError('The mailbox result does not match this operation.');
      const receipt = { status: result.status, checked_at: clock(), acceptance_verified: false, deletion_verified: false };
      if (result.status === 'held') {
        if (result.authenticated !== true || !['route_validation_required', 'confirmation_link_unvalidated'].includes(result.reason) ||
            !Number.isSafeInteger(result.received_at) || result.received_at < contact.expires_at - 7 * 86400 || result.received_at > now + 300 ||
            typeof result.receipt_ref !== 'string' || !/^[a-f0-9]{64}$/.test(result.receipt_ref) || typeof result.continuation_available !== 'boolean' ||
            (result.continuation_available && !['usphonebook','fastpeoplesearch'].includes(id))) throw new WorkspaceError('The removal receipt could not be validated.');
        Object.assign(receipt, { authenticated: true, reason: result.reason, received_at: result.received_at, receipt_ref: result.receipt_ref,
          continuation_available: result.continuation_available });
        changed(item, 'blocked', result.continuation_available ? 'An authenticated removal email is ready for the reviewed broker confirmation form. Review its required fields before continuing. Deletion is unverified.' : 'An authenticated removal-related email was received. Confirmation is held pending broker-route validation; no link was followed and deletion is unverified.');
      }
      // A later empty check must not erase a previously observed held receipt.
      if (item.mail_receipt?.status !== 'held' || result.status === 'held') item.mail_receipt = receipt;
      event(routeFor(id).name + (result.status === 'held' ? '. A removal email is held for route validation.' : '. No qualifying removal receipt was found in this explicit check.'));
      save(); return dashboard();
    }
    function continuationContext(id) {
      const item = itemFor(id);
      requireNotHeld(item);
      if (!['usphonebook','fastpeoplesearch'].includes(id) || state.campaign.status !== 'active' || !item.operation_id || !item.mail_contact ||
          !item.mail_receipt?.authenticated || item.mail_receipt.continuation_available !== true || item.status === 'user_reported_completed')
        throw new WorkspaceError('Choose a current authenticated confirmation for this active operation.', 409);
      const contact = mailContact(item.mail_contact, id, item.operation_id, Math.floor(Date.parse(clock()) / 1000));
      return { item, contact };
    }
    function continuationFields(item, contact, supplied, id) {
      if(id==='fastpeoplesearch'){
        if(!supplied||typeof supplied!=='object'||Array.isArray(supplied)||Object.keys(supplied).length!==0)throw new WorkspaceError('FastPeopleSearch opens only the verified matching form. No additional identity fields are accepted here.');
        return {first_name:brokerField(routeFor(id),'first_name',item.fields.first_name),last_name:brokerField(routeFor(id),'last_name',item.fields.last_name),email:contact.contact_email};
      }
      if (!supplied || typeof supplied !== 'object' || Array.isArray(supplied) || Object.keys(supplied).length !== 3 ||
          !['city', 'state', 'zip_code'].every(key => Object.hasOwn(supplied, key))) throw new WorkspaceError('Review the city, state and ZIP required by this broker.');
      const city = text(supplied.city, 120), stateCode = text(supplied.state, 2).toUpperCase(), zip = text(supplied.zip_code, 5);
      if (!/^(AL|AK|AZ|AR|CA|CO|CT|DE|DC|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY|AA|AE|AP|AS|FM|GU|MH|MP|PR|PW|VI)$/.test(stateCode) || !/^\d{5}$/.test(zip))
        throw new WorkspaceError('Use a US state abbreviation and your accurate five-digit ZIP code.');
      return { first_name: text(item.fields.first_name, 120), last_name: text(item.fields.last_name, 120), email: contact.contact_email,
        city, state: stateCode, zip_code: zip };
    }
    function mailContinuationRequest(id, supplied, transport = 'private_pilot') {
      const { item, contact } = continuationContext(id);
      requireMailTransport(item,transport);
      if (item.continuation) throw new WorkspaceError('This confirmation action already started. Check its existing broker tab; no replay is allowed.', 409);
      continuationFields(item, contact, supplied,id);
      item.continuation_fields = id==='fastpeoplesearch'?{}:{ city: text(supplied.city, 120), state: text(supplied.state, 2).toUpperCase(), zip_code: text(supplied.zip_code, 5) };
      item.mail_continuation_authorized_at = clock(); save();
      return { capability: contact.capability, explicit: true, receipt_ref: item.mail_receipt.receipt_ref };
    }
    function prepareMailContinuation(id, response, reviewedFields, transport = 'private_pilot') {
      const { item, contact } = continuationContext(id);
      requireMailTransport(item,transport);
      if (!item.mail_continuation_authorized_at || item.continuation) throw new WorkspaceError('This confirmation action is unapproved or already started. No replay is allowed.', 409);
      const fields = continuationFields(item, contact, reviewedFields,id);
      if (!response || response.status !== 'confirmation_ready' || response.route_id !== id || response.operation_id !== item.operation_id ||
          response.request_id !== contact.request_id || response.receipt_ref !== item.mail_receipt.receipt_ref ||
          response.automatic_execution !== false || !confirmationURL(response.confirmation_url,id,fields)) throw new WorkspaceError('The confirmation does not match this operation.');
      const authorizedFields = continuationFields(item, contact, item.continuation_fields,id);
      if (Object.keys(fields).some(key => fields[key] !== authorizedFields[key]))
        throw new WorkspaceError('The confirmation fields changed in another tab. Review them again before continuing.', 409);
      // Persist the uncertain boundary before the private URL leaves this call.
      // The URL itself is transient and must never enter history or a backup.
      item.continuation = { started_at: clock(), receipt_ref: response.receipt_ref, result: 'unknown', acceptance_verified: false, deletion_verified: false };
      changed(item, 'uncertain', 'The confirmation-form action started. Check the existing broker tab before any further action.');
      event('You started the ' + routeFor(id).name + ' confirmation-form action. No request acceptance or deletion was established.'); save();
      return { routeId: id, operationId: item.operation_id, requestId: contact.request_id, receiptRef: response.receipt_ref,
        confirmationUrl: response.confirmation_url, contactEmail: contact.contact_email, fields, authorized: true };
    }
    function recordMailContinuation(id, operationId, result) {
      const item = itemFor(id);
      if (!['usphonebook','fastpeoplesearch'].includes(id) || item.operation_id !== operationId || !item.continuation || !result || !['prepared', 'blocked', 'unknown'].includes(result.status))
        throw new WorkspaceError('The confirmation result does not match a started action.', 409);
      if (item.continuation.result !== 'unknown' && item.continuation.result !== result.status) throw new WorkspaceError('The confirmation result is already recorded. No replay was sent.', 409);
      item.continuation.result = result.status; item.continuation.observed_at = clock();
      changed(item, result.status === 'prepared' ? 'needs_broker_step' : result.status === 'blocked' ? 'blocked' : 'uncertain',
        result.status === 'prepared' ? id==='fastpeoplesearch'?'The authenticated matching form opened and its prefilled name and contact matched the approved fields. Choose Enter missing information inside Erase Me to check the required fields and review one final fill-and-submit attempt. Record matching, request acceptance and deletion remain unverified.':'The confirmation form was filled. Review its accuracy statement, complete the broker challenge and submit on the broker site. Deletion is unverified.' : undefined);
      event(routeFor(id).name + '. Confirmation form outcome recorded; request acceptance and deletion remain unverified.'); save(); return dashboard();
    }
    function recordCompanion(id, operationId, result) {
      const item = itemFor(id);
      if(item.mail_send)throw new WorkspaceError('Read this email operation through its dedicated outbox result. No broker form result was recorded.',409);
      if (!item.operation_id || operationId !== item.operation_id) throw new WorkspaceError('The broker result does not match a started action.', 409);
      if (!result || !RESULT_STATES.has(result.status)) throw new WorkspaceError('The companion returned an unsupported result.');
      if (item.evidence) {
        if (item.evidence.result === result.status) return dashboard();
        if (!['unknown', 'pending', 'error'].includes(item.evidence.result))
        throw new WorkspaceError('A result is already recorded for this operation. No repeat was sent.', 409);
      }
      let status = 'uncertain';
      const attempted = result.status === 'submission_attempted' && result.attempt_verified === true && Object.hasOwn(SUBMIT_STAGES, id) && SUBMIT_STAGES[id] === result.stage;
      if (result.status === 'prepared') status = 'needs_broker_step';
      else if (attempted) status = 'needs_broker_step';
      else if (['captcha', 'id_required', 'unsupported', 'blocked'].includes(result.status)) status = 'blocked';
      else if (result.status === 'verification_sent' && result.route_verified === true && result.evidence === 'fresh_visible_success') status = 'verification_sent';
      else if (result.status === 'submitted' && result.route_verified === true && result.evidence === 'fresh_visible_success') status = 'requested';
      item.evidence = { source: 'browser_companion', result: result.status, observed_at: clock(), acceptance_verified: status === 'requested',
        ...(result.status === 'submission_attempted' ? { attempt_verified: attempted, ...(attempted ? { stage: result.stage } : {}) } : {}) };
      changed(item, status, attempted ? 'The approved submit control was activated. Broker acceptance and deletion remain unverified.' : undefined);
      event(routeFor(id).name + '. ' + item.detail); save(); return dashboard();
    }
    function observationRequest(id) {
      const item = itemFor(id);
      requireNotHeld(item);
      if (state.campaign.status !== 'active' || !item.operation_id)
        throw new WorkspaceError('Resume this active operation before reading its broker tab.', 409);
      item.observation_authorized_at = clock(); save();
      return { routeId: id, operationId: item.operation_id, authorized: true };
    }
    function focusRequest(id, stage) {
      const route = routeFor(id), item = itemFor(id, false);
      requireNotHeld(item);
      requireCountryRoute(route, item);
      if (state.campaign.status !== 'active' || !OPERATION.test(item.operation_id || '') ||
          item.operation_source === 'imported_user_history' || USER_STATES.has(item.status) || item.status === 'requested')
        throw new WorkspaceError('Choose an active request with an existing companion tab.', 409);
      if (!['operation', 'continuation'].includes(stage)) throw new WorkspaceError('Choose the existing broker step to return to.');
      const request = { routeId: id, operationId: item.operation_id, stage, authorized: true };
      if (stage === 'continuation') {
        if (!['usphonebook', 'fastpeoplesearch'].includes(id) || item.continuation?.result !== 'prepared' ||
            item.continuation.source === 'imported_user_history' || item.mail_receipt?.authenticated !== true ||
            item.mail_receipt.continuation_available !== true || item.continuation.receipt_ref !== item.mail_receipt.receipt_ref ||
            !/^[a-f0-9]{64}$/.test(item.mail_receipt.receipt_ref || '') || !item.mail_contact)
          throw new WorkspaceError('The matching form has no current authenticated companion reference. Review its existing request steps.', 409);
        const contact = mailContact(item.mail_contact, id, item.operation_id, Math.floor(Date.parse(clock()) / 1000), true);
        request.requestId = contact.request_id;
        request.receiptRef = item.mail_receipt.receipt_ref;
      }
      return request;
    }
    function myLifeAPI() {
      const api = myLifeDetails || root.EraseMyLifeDetails;
      if (!api || typeof api.validateDetails !== 'function' || !api.CONTRACT) throw new WorkspaceError('Refresh before reviewing MyLife identity fields.', 409);
      return api;
    }
    function myLifePreview() {
      const id = 'mylife', route = routeFor(id), item = itemFor(id, false);
      requireNotHeld(item); requireCountryRoute(route, item);
      if (state.campaign.status !== 'active' || operationStarted(item) || !OPERATION.test(item.id || ''))
        throw new WorkspaceError('This private form is paused or already started. Review its existing outcome before continuing.', 409);
      return clone({ routeId: id, operationId: item.id, profileId: state.profile.id, country: state.profile.country || null,
        identity: { full_name: state.profile.name, age: state.profile.age }, consentId: myLifeAPI().CONTRACT.id });
    }
    function prepareMyLife(preview, details, approval) {
      const api = myLifeAPI();
      if (!exactKeys(preview, ['routeId','operationId','profileId','country','identity','consentId']) ||
          !exactKeys(preview.identity, ['full_name','age']) || !exactKeys(approval, ['authorized','consentId']) ||
          approval.authorized !== true || approval.consentId !== api.CONTRACT.id || JSON.stringify(preview) !== JSON.stringify(myLifePreview()))
        throw new WorkspaceError('The reviewed MyLife form or workspace changed. Review and authorize it again.', 409);
      let canonical;
      try { canonical = api.validateDetails(details, { fullName: preview.identity.full_name, age: preview.identity.age, now: clock() }); }
      catch (error) { throw new WorkspaceError(error?.message || 'Review your private MyLife fields.'); }
      const item = itemFor(preview.routeId, false);
      // Persist only the operation boundary. No birth year, location or contact is stored.
      item.operation_id = item.id; item.operation_started_at = clock(); item.operation_source = 'browser_workspace';
      changed(item, 'running'); event('You authorized one MyLife prefill. Birth year and location were not saved.'); save();
      return { routeId: preview.routeId, operationId: item.operation_id, authorized: true, ownRequestConfirmed: true,
        consentId: api.CONTRACT.id, identity: clone(preview.identity), details: canonical };
    }
    function recordMyLife(profileId, operationId, result) {
      if (active().profile.id !== profileId || !['prepared','blocked','unknown'].includes(result?.status))
        throw new WorkspaceError('The private MyLife result belongs to another workspace or has an unreviewed outcome.', 409);
      return recordCompanion('mylife', operationId, result);
    }
    function thatsThemAPI() {const api=thatsThemDetails||root.EraseThatsThemDetails;if(!api||typeof api.validateDetails!=='function'||!api.CONTRACT)throw new WorkspaceError('Refresh before reviewing the private That’sThem form.',409);return api;}
    function thatsThemPreview() {const id='thatsthem',route=routeFor(id),item=itemFor(id,false);requireNotHeld(item);requireCountryRoute(route,item);if(state.campaign.status!=='active'||operationStarted(item)||!OPERATION.test(item.id||''))throw new WorkspaceError('This private form is paused or already started. Reconcile its existing outcome first.',409);return clone({routeId:id,operationId:item.id,profileId:state.profile.id,country:state.profile.country||null,identity:{ full_name:state.profile.name, email:state.profile.email },consentId:thatsThemAPI().CONTRACT.id});}
    function prepareThatsThem(preview,details,approval) {const api=thatsThemAPI();if(!exactKeys(preview,['routeId','operationId','profileId','country','identity','consentId'])||!exactKeys(preview.identity,['full_name','email'])||!exactKeys(approval,['authorized','consentId'])||approval.authorized!==true||approval.consentId!==api.CONTRACT.id||JSON.stringify(preview)!==JSON.stringify(thatsThemPreview()))throw new WorkspaceError('The exact private form review or workspace changed. Review it again.',409);let canonical;try{canonical=api.validateDetails(details,{fullName:preview.identity.full_name});}catch(error){throw new WorkspaceError(error?.message||'Review the private matching fields.');}const item=itemFor(preview.routeId,false);item.operation_id=item.id;item.operation_started_at=clock();item.operation_source='browser_workspace';item.operation_email=state.profile.email;item.operation_email_role='profile';changed(item,'running');event('You authorized one private That’sThem prefill. Additional matching details were not saved.');save();return{routeId:preview.routeId,operationId:item.operation_id,authorized:true,ownRequestConfirmed:true,consentId:api.CONTRACT.id,identity:clone(preview.identity),details:canonical};}
    function recordThatsThem(profileId,operationId,result) {if(active().profile.id!==profileId||!['prepared','blocked','unknown'].includes(result?.status))throw new WorkspaceError('The private form result belongs to another workspace or has an unreviewed outcome.',409);return recordCompanion('thatsthem',operationId,result);}
    function peopleFindersAPI() {const api=peopleFindersDetails||root.ErasePeopleFindersDetails;if(!api||typeof api.validateDetails!=='function'||!api.CONTRACT)throw new WorkspaceError('Refresh before reviewing the private PeopleFinders form.',409);return api;}
    function peopleFindersPreview() {const id='peoplefinders',route=routeFor(id),item=itemFor(id,false);requireNotHeld(item);requireCountryRoute(route,item);if(state.campaign.status!=='active'||operationStarted(item)||!OPERATION.test(item.id||''))throw new WorkspaceError('This private form is paused or already started. Reconcile its existing outcome first.',409);return clone({routeId:id,operationId:item.id,profileId:state.profile.id,country:state.profile.country||null,identity:{ full_name:state.profile.name },consentId:peopleFindersAPI().CONTRACT.id});}
    function preparePeopleFinders(preview,details,approval) {const api=peopleFindersAPI();if(!exactKeys(preview,['routeId','operationId','profileId','country','identity','consentId'])||!exactKeys(preview.identity,['full_name'])||!exactKeys(approval,['authorized','consentId'])||approval.authorized!==true||approval.consentId!==api.CONTRACT.id||JSON.stringify(preview)!==JSON.stringify(peopleFindersPreview()))throw new WorkspaceError('The exact private form review or workspace changed. Review it again.',409);let canonical;try{canonical=api.validateDetails(details,{fullName:preview.identity.full_name});}catch(error){throw new WorkspaceError(error?.message||'Review the private matching fields.');}const item=itemFor(preview.routeId,false);item.operation_id=item.id;item.operation_started_at=clock();item.operation_source='browser_workspace';changed(item,'running');event('You authorized one private PeopleFinders prefill. Additional matching details were not saved.');save();return{routeId:preview.routeId,operationId:item.operation_id,authorized:true,ownRequestConfirmed:true,consentId:api.CONTRACT.id,identity:clone(preview.identity),details:canonical};}
    function recordPeopleFinders(profileId,operationId,result) {if(active().profile.id!==profileId||!['prepared','blocked','unknown'].includes(result?.status))throw new WorkspaceError('The private form result belongs to another workspace or has an unreviewed outcome.',409);return recordCompanion('peoplefinders',operationId,result);}
    function peopleTraceAPI() {
      const api = peopleTraceDetails || root.ErasePeopleTraceDetails;
      if (!api || typeof api.validateDetails !== 'function' || !api.CONTRACT) throw new WorkspaceError('Refresh before reviewing this private form.', 409);
      return api;
    }
    function peopleTracePreview() {
      const id = 'gb-peopletraceuk', route = routeFor(id), item = itemFor(id, false);
      requireNotHeld(item); requireCountryRoute(route, item);
      if (state.campaign.status !== 'active' || operationStarted(item) || !OPERATION.test(item.id || ''))
        throw new WorkspaceError('This private form is paused or already started. Check its existing outcome; no repeat is authorized.', 409);
      return clone({ routeId: id, operationId: item.id, profileId: state.profile.id, country: state.profile.country || null,
        identity: { full_name: state.profile.name, email: state.profile.email, age: state.profile.age }, consentId: peopleTraceAPI().CONTRACT.id });
    }
    function preparePeopleTrace(preview, details, approval) {
      const api = peopleTraceAPI();
      if (!exactKeys(preview, ['routeId','operationId','profileId','country','identity','consentId']) ||
          !exactKeys(preview.identity, ['full_name','email','age']) || !exactKeys(approval, ['authorized','consentId']) ||
          approval.authorized !== true || approval.consentId !== api.CONTRACT.id || JSON.stringify(preview) !== JSON.stringify(peopleTracePreview()))
        throw new WorkspaceError('The reviewed workspace or private form changed. Review and authorize it again.', 409);
      let canonical;
      try { canonical = api.validateDetails(details, { age: preview.identity.age, now: clock() }); }
      catch (error) { throw new WorkspaceError(error?.message || 'Review your private form fields.'); }
      const item = itemFor(preview.routeId, false);
      // Only the uncertain boundary and ordinary profile contact are persisted.
      // Birth date, phone and address remain in the returned one-action payload.
      item.operation_id = item.id; item.operation_started_at = clock(); item.operation_source = 'browser_workspace';
      item.operation_email = state.profile.email; item.operation_email_role = 'profile';
      changed(item, 'running'); event('You authorized one People Trace UK prefill. Additional identity details were not saved.'); save();
      return { routeId: preview.routeId, operationId: item.operation_id, authorized: true, ownRequestConfirmed: true,
        consentId: api.CONTRACT.id, identity: clone(preview.identity), details: canonical };
    }
    function recordPeopleTrace(profileId, operationId, result) {
      if (active().profile.id !== profileId || !['prepared','blocked','unknown'].includes(result?.status))
        throw new WorkspaceError('The private form outcome belongs to another workspace or is unverified.', 409);
      return recordCompanion('gb-peopletraceuk', operationId, result);
    }
    function cmaAPI() {
      const api = cmaDetails || root.EraseCMADetails;
      if (!api || typeof api.validateDetails !== 'function' || !api.CONTRACT) throw new WorkspaceError('Refresh before reviewing the CMA registration.', 409);
      return api;
    }
    function cmaPreview() {
      const id='ca-cma-do-not-mail',route=routeFor(id),item=itemFor(id,false);
      requireNotHeld(item);requireCountryRoute(route,item);
      if(state.campaign.status!=='active'||operationStarted(item)||!OPERATION.test(item.id||''))throw new WorkspaceError('This registration is paused or already started. Reconcile its existing outcome before continuing.',409);
      return clone({routeId:id,operationId:item.id,profileId:state.profile.id,country:state.profile.country||null,fullName:state.profile.name,consentId:cmaAPI().CONTRACT.id});
    }
    function prepareCMA(preview,details,approval) {
      const api=cmaAPI();
      if(!exactKeys(preview,['routeId','operationId','profileId','country','fullName','consentId'])||!exactKeys(approval,['authorized','consentId','autoSubmit'])||approval.authorized!==true||approval.consentId!==api.CONTRACT.id||typeof approval.autoSubmit!=='boolean'||JSON.stringify(preview)!==JSON.stringify(cmaPreview()))throw new WorkspaceError('The CMA review or workspace changed. Review and authorize the exact registration again.',409);
      let canonical;try{canonical=api.validateDetails(details,{fullName:preview.fullName});}catch(error){throw new WorkspaceError(error?.message||'Review your private CMA fields.');}
      const item=itemFor(preview.routeId,false);item.operation_id=item.id;item.operation_started_at=clock();item.operation_source='browser_workspace';item.cma_registration_submit_authorized=approval.autoSubmit;
      changed(item,'running','One CMA marketing registration action was reserved. No mailing-address details were saved.');event('You authorized one CMA marketing-suppression action. This does not delete broker records.');save();
      return{routeId:preview.routeId,operationId:item.operation_id,authorized:true,ownRequestConfirmed:true,consentId:api.CONTRACT.id,fullName:preview.fullName,details:canonical,autoSubmit:approval.autoSubmit};
    }
    function recordCMA(profileId,operationId,result) {
      const item=itemFor('ca-cma-do-not-mail');
      if(active().profile.id!==profileId||item.operation_id!==operationId||!['prepared','submission_attempted','blocked','unknown'].includes(result?.status))throw new WorkspaceError('The registration result does not match the authorized workspace action.',409);
      const attempted=result.status==='submission_attempted'&&item.cma_registration_submit_authorized===true&&result.attempt_verified===true&&result.stage==='marketing_registration';
      if(result.status==='submission_attempted'&&!attempted)throw new WorkspaceError('No verified, separately authorized registration submit event was established.',409);
      if(item.evidence){if(item.evidence.result===result.status)return dashboard();if(!['unknown','pending','error'].includes(item.evidence.result))throw new WorkspaceError('This registration result was already recorded. No repeat is authorized.',409);}
      item.evidence={source:'browser_companion',result:result.status,observed_at:clock(),acceptance_verified:false,...(attempted?{attempt_verified:true,stage:'marketing_registration'}:{})};
      changed(item,result.status==='blocked'?'blocked':result.status==='unknown'?'uncertain':'needs_broker_step',attempted?'One CMA marketing registration submission was attempted. Delivery and acceptance are unverified. This does not establish broker deletion.':result.status==='prepared'?'CMA registration fields were filled. Complete its registration on the official site. No broker deletion is established.':'The CMA outcome is blocked or unknown. Reconcile its existing action before continuing.');event('CMA marketing registration outcome recorded separately from deletion evidence.');save();return dashboard();
    }
    function identityAPI() {
      const api = identityDetails || root.EraseIdentityDetails;
      if (typeof api?.validate !== 'function' || typeof api.validateRequirements !== 'function' ||
          typeof api.IdentityDetailError !== 'function' || !api.CONTRACTS?.fastpeoplesearch)
        throw new WorkspaceError('Refresh the workspace before reviewing additional information.', 409);
      return api;
    }
    function identityContext(id) {
      const route = routeFor(id), item = itemFor(id, false);
      requireNotHeld(item); requireCountryRoute(route, item);
      if (id !== 'fastpeoplesearch' || state.campaign.status !== 'active' || !OPERATION.test(item.operation_id || '') ||
          item.operation_source === 'imported_user_history' || USER_STATES.has(item.status) || item.status === 'requested' ||
          item.continuation?.result !== 'prepared' || item.continuation.source === 'imported_user_history' ||
          item.mail_receipt?.status !== 'held' || item.mail_receipt.authenticated !== true || item.mail_receipt.continuation_available !== true ||
          item.mail_receipt.source === 'imported_user_history' || !/^[a-f0-9]{64}$/.test(item.mail_receipt.receipt_ref || '') ||
          item.continuation.receipt_ref !== item.mail_receipt.receipt_ref || !item.mail_contact)
        throw new WorkspaceError('Choose a current authenticated FastPeopleSearch matching form before providing additional information.', 409);
      if (Object.hasOwn(item, 'final_submission'))
        throw new WorkspaceError('This final submission action already started. Check its existing result; no repeat is authorized.', 409);
      const contact = mailContact(item.mail_contact, id, item.operation_id, Math.floor(Date.parse(clock()) / 1000));
      const fields = { first_name: brokerField(route, 'first_name', item.fields?.first_name),
        last_name: brokerField(route, 'last_name', item.fields?.last_name), email: contact.contact_email };
      if (item.operation_email !== undefined && item.operation_email !== contact.contact_email)
        throw new WorkspaceError('The original request contact changed. Review the existing broker action.', 409);
      return { item, contact, fields };
    }
    function identityPreview(id) {
      const { item, contact, fields } = identityContext(id), contract = identityAPI().CONTRACTS.fastpeoplesearch;
      return clone({ routeId: id, operationId: item.operation_id, profileId: state.profile.id, country: state.profile.country || null,
        profileContext: { name: state.profile.name, email: state.profile.email, age: state.profile.age,
          region: state.profile.region || null, city: state.profile.city || null },
        requestId: contact.request_id, receiptRef: item.mail_receipt.receipt_ref, fields, consentId: contract.id });
    }
    function prepareIdentitySubmission(preview, details, approval) {
      const previewKeys = ['routeId', 'operationId', 'profileId', 'country', 'profileContext', 'requestId', 'receiptRef', 'fields', 'consentId'];
      if (!exactKeys(preview, previewKeys) || !exactKeys(preview.profileContext, ['name', 'email', 'age', 'region', 'city']) ||
          !exactKeys(preview.fields, ['first_name', 'last_name', 'email']) || !exactKeys(approval, ['authorized', 'consentId', 'requirements']) ||
          approval.authorized !== true || approval.consentId !== identityAPI().CONTRACTS.fastpeoplesearch.id)
        throw new WorkspaceError('Review and authorize the exact final broker fields and agreement first.');
      const current = identityPreview(preview.routeId);
      const sameValues = (a, b) => Object.keys(b).every(key => a[key] === b[key]);
      if (!['routeId', 'operationId', 'profileId', 'country', 'requestId', 'receiptRef', 'consentId'].every(key => preview[key] === current[key]) ||
          !sameValues(preview.fields, current.fields) || !sameValues(preview.profileContext, current.profileContext))
        throw new WorkspaceError('The reviewed workspace, request or contact changed. Review these details again before starting.', 409);
      let canonical, requirements;
      try {
        requirements = identityAPI().validateRequirements(approval.requirements);
        canonical = identityAPI().validate(details, { now: clock(), requirements });
      }
      catch (error) { throw new WorkspaceError(error instanceof identityAPI().IdentityDetailError ? error.message : 'Review the selected identity fields.'); }
      const item = itemFor(current.routeId, false), submissionId = uuid();
      if (typeof submissionId !== 'string' || !OPERATION.test(submissionId) || submissionId === item.operation_id)
        throw new WorkspaceError('A new private action reference could not be created. No form action started.', 503);
      // Save only the uncertain action boundary. Details stay in the returned
      // one-action payload, outside history, storage and private backups.
      item.final_submission = { id: submissionId, started_at: clock(), result: 'unknown',
        attempt_verified: false, acceptance_verified: false, deletion_verified: false };
      changed(item, 'uncertain', 'The approved final broker action started. Its outcome is not established; no repeat is authorized.');
      event(routeFor(current.routeId).name + '. You authorized the reviewed final form action. Additional identity values were not saved.'); save();
      return { routeId: current.routeId, operationId: current.operationId, requestId: current.requestId, receiptRef: current.receiptRef,
        submissionId, authorized: true, consentId: current.consentId, fields: clone(current.fields), details: canonical, requirements };
    }
    function recordIdentitySubmission(id, submissionId, result) {
      const item = itemFor(id), reference = item.final_submission;
      if (id !== 'fastpeoplesearch' || !reference || reference.id !== submissionId || reference.source === 'imported_user_history' ||
          item.operation_source === 'imported_user_history' || !result ||
          !['unknown', 'blocked', 'submission_attempted'].includes(result.status) ||
          result.status === 'submission_attempted' && !(result.attempt_verified === true && result.stage === 'final_request_submission'))
        throw new WorkspaceError('The final form result does not match the reserved action.', 409);
      if (reference.result !== 'unknown') {
        if (reference.result === result.status) return dashboard();
        throw new WorkspaceError('This final form outcome is already recorded. No repeat is authorized.', 409);
      }
      reference.result = result.status; reference.attempt_verified = result.status === 'submission_attempted'; reference.observed_at = clock();
      const status = result.status === 'submission_attempted' ? 'needs_broker_step' : result.status === 'blocked' ? 'blocked' : 'uncertain';
      if (item.held !== true) changed(item, status, result.status === 'submission_attempted'
        ? 'The approved final submit control was activated. Delivery, broker acceptance and deletion remain unverified.'
        : result.status === 'blocked' ? 'The approved final action stopped before a verified submission. Review the existing broker tab; no repeat is authorized.'
          : 'The final form outcome is unknown. Check the existing broker tab; no repeat is authorized.');
      event(routeFor(id).name + '. Final action outcome recorded. No additional identity values, acceptance or deletion were saved.'); save(); return dashboard();
    }
    function identityResultRequest(id) {
      const route = routeFor(id), item = itemFor(id, false);
      requireNotHeld(item); requireCountryRoute(route, item);
      if (id !== 'fastpeoplesearch' || state.campaign.status !== 'active' || !OPERATION.test(item.operation_id || '') ||
          item.operation_source === 'imported_user_history' || !item.final_submission || item.final_submission.source === 'imported_user_history')
        throw new WorkspaceError('Choose an active reserved final action to read its existing result.', 409);
      const reference = finalSubmission(item.final_submission, id, item.operation_id);
      return { routeId: id, operationId: item.operation_id, submissionId: reference.id, authorized: true };
    }
    function recordObservation(id, operationId, result) {
      const item = itemFor(id);
      if (!item.operation_id || item.operation_id !== operationId || !item.observation_authorized_at || !result || !['unknown', 'verification_sent'].includes(result.status))
        throw new WorkspaceError('The observed result does not match an authorized existing operation.', 409);
      if (result.status === 'verification_sent') {
        if (!['peopledatalabs-form', 'usphonebook'].includes(id) || result.observation_verified !== true || result.route_verified !== true || result.evidence !== 'fresh_visible_success')
          throw new WorkspaceError('The observed broker response is unverified.');
        const proof = { source: 'browser_companion_observation', result: 'verification_sent', observed_at: clock(), acceptance_verified: false, deletion_verified: false };
        item.verification_evidence = proof;
        // An email-initiation acknowledgment is an earlier stage than a user
        // report, authenticated receipt, second form or accepted request. Keep
        // its proof without replacing the later outcome or its evidence.
        if (!USER_STATES.has(item.status) && item.status !== 'requested' && !item.continuation &&
            !item.mail_receipt?.authenticated && item.evidence?.acceptance_verified !== true) {
          item.evidence = { ...proof };
          changed(item, 'verification_sent');
        }
      }
      item.last_observation = { at: clock(), status: result.status };
      event(routeFor(id).name + (result.status === 'verification_sent' ? '. The existing broker tab reports a verification-email step, not deletion.' : '. The broker-tab outcome remains unconfirmed. No action was repeated.'));
      save(); return dashboard();
    }
    function searchRequest(id) {
      const route = routeFor(id), item = itemFor(id);
      requireNotHeld(item); requireCountryRoute(route, item);
      if (state.campaign.status !== 'active' || route.searchable !== true)
        throw new WorkspaceError('Listing search is unavailable for this route or paused workspace.', 409);
      const quoted = value => '"' + text(value, 120).replace(/["\\]/g, '') + '"';
      const terms = ['site:' + route.domain, quoted(state.profile.name)];
      if (state.profile.city) terms.push(quoted(state.profile.city));
      const url = new URL('https://www.google.com/search'); url.searchParams.set('q', terms.join(' '));
      event('You opened a listing search for ' + route.name + '. Google receives the name and optional city; no match or removal is established.');
      save(); return { url: url.href, routeId: id };
    }
    function privacyDraftRequest(id, input) {
      const route = routeFor(id), item = itemFor(id);
      requireNotHeld(item);
      if (!appliesToCountry(route, state.profile.country)) throw new WorkspaceError('This route is outside your selected country. Update your location before preparing a privacy draft.', 409);
      if (state.campaign.status !== 'active') throw new WorkspaceError('Allow checks before preparing a privacy draft.', 409);
      if (['running', 'uncertain'].includes(item.status)) throw new WorkspaceError('Check the uncertain earlier broker outcome before preparing another request.', 409);
      const contact = route.privacyContact;
      if (!contact || !['privacy', 'support'].includes(contact.kind) || typeof contact.source !== 'string' ||
          typeof contact.checkedAt !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(contact.checkedAt)) throw new WorkspaceError('No reviewed privacy contact is available for this route.');
      let recipient, source;
      try {
        recipient = email(contact.email); source = new URL(contact.source);
        if (source.protocol !== 'https:' || source.username || source.password || source.port) throw new Error();
      } catch (_) { throw new WorkspaceError('The reviewed privacy contact is invalid.'); }
      if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).length !== 2 ||
          !Object.hasOwn(input, 'reference') || !Object.hasOwn(input, 'own_request')) throw new WorkspaceError('Supply only your own record reference and its confirmation.');
      if (input.own_request !== true) throw new WorkspaceError('Confirm this request concerns your own information.');
      if (typeof input.reference !== 'string' || input.reference.length > 2048 || /[\u0000-\u001f\u007f\u2028\u2029]/.test(input.reference))
        throw new WorkspaceError('Enter a single-line reference for your own record, no longer than 2048 characters.');
      let reference = input.reference.trim().replace(/\s+/g, ' ');
      if (contact.kind === 'support' && reference) throw new WorkspaceError('This support contact can receive only a generic procedure question without record identifiers.');
      if (contact.kind === 'privacy' && !reference) throw new WorkspaceError('Enter your own public listing or record reference before preparing this draft.');
      if (/^[a-z][a-z0-9+.-]*:\/\//i.test(reference)) {
        try { reference = listingURL(reference, route); } catch (_) { throw new WorkspaceError('Use a direct official listing URL as your record reference, or describe your own listed information.'); }
      }
      const support = contact.kind === 'support';
      const draft = { to: recipient, subject: (support ? 'Privacy request procedure — ' : 'Personal information removal request — ') + text(route.name, 160),
        body: support
          ? 'Hello,\n\nPlease explain your procedure for an individual to request removal or suppression of their own personal information. Please identify the appropriate privacy channel and any verification steps.\n\nThank you.'
          : 'Hello,\n\nMy name is ' + text(state.profile.name, 120) + '. This request concerns my own information. Please remove or suppress my personal information associated with this reference:\n\n' + reference + '\n\nPlease confirm the outcome. If additional verification is needed, please explain what is required before I provide further details.\n\nThank you.',
        source: source.href };
      event('You prepared a local ' + (support ? 'procedure-question' : 'privacy-request') + ' draft for ' + route.name + '. No email was sent and no removal was established.');
      save(); return draft;
    }
    async function mailSendHash(value){
      const crypto=options.crypto||root.crypto;
      if(!crypto?.subtle?.digest||typeof TextEncoder!=='function')throw new WorkspaceError('This browser cannot privately bind an email review. Use a current secure desktop browser.',503);
      return [...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)))].map(byte=>byte.toString(16).padStart(2,'0')).join('');
    }
    function mailSendCanonical(value){const [local,domain]=email(value).toLowerCase().split('@');return (domain==='gmail.com'||domain==='googlemail.com'?local.split('+')[0].replace(/\./g,'')+'@gmail.com':local.split('+')[0]+'@'+domain);}
    function mailSendProfile(){const p=active(false).profile;return {name:p.name,email:p.email,age:p.age,city:p.city||null,region:p.region||null};}
    function mailSendContext(context){
      if(!exactKeys(context,['routeId','operationId','profileId','country','profileContext','reference'])||!exactKeys(context.profileContext,['name','email','age','city','region'])||
        !OPERATION.test(context.operationId||'')||!OPERATION.test(context.profileId||'')||text(context.reference,512)!==context.reference||/[<>]/.test(context.reference))throw new WorkspaceError('Review the exact email context again.',409);
      const p=active(false).profile,item=itemFor(context.routeId,false),record=item.mail_send;
      if(p.id!==context.profileId||JSON.stringify(mailSendProfile())!==JSON.stringify(context.profileContext)||(p.country||null)!==context.country||!record||record.id!==context.operationId||record.source!=='local_native'||record.workspace_id!==p.id||item.operation_id!==record.id)throw new WorkspaceError('The reviewed email workspace or operation changed.',409);
      return {item,record};
    }
    async function mailSendReady(context,response,allowExpired=false){
      const protocol=sendProtocol(),keys=['status','route_id','operation_id','request_id','capability','expires_at','message_digest','preview','source_url','automatic_execution'];
      if(!exactKeys(response,keys)||response.status!=='ready'||response.route_id!==context.routeId||response.operation_id!==context.operationId||response.automatic_execution!==false||response.source_url!==protocol.ROUTES[context.routeId]?.source)throw new WorkspaceError('The native email preview does not match this review.',409);
      try{protocol.preview(response.preview,context.routeId);}catch(_){throw new WorkspaceError('The native email preview is invalid.',409);}
      const claims=sendClaims(response.capability),now=Math.floor(Date.parse(clock())/1000);
      const digest=await mailSendHash(JSON.stringify({body:response.preview.body,from:response.preview.from,subject:response.preview.subject,to:response.preview.to}));
      const primary=await mailSendHash(mailSendCanonical(context.profileContext.email)),account=await mailSendHash(mailSendCanonical(response.preview.from));
      if(claims.route_id!==context.routeId||claims.operation_id!==context.operationId||claims.workspace_id!==context.profileId||claims.personal_email_sha256!==primary||claims.account!==account||
        claims.request_id!==response.request_id||claims.message_digest!==response.message_digest||digest!==response.message_digest||claims.expires_at!==response.expires_at||claims.issued_at>now+60||!allowExpired&&claims.expires_at<=now||
        mailSendCanonical(response.preview.from)===mailSendCanonical(context.profileContext.email)||response.preview.subject!=='Request to remove or suppress my public record ['+response.request_id+']'||
        !response.preview.body.includes('My name: '+context.profileContext.name+'\nRecord reference: '+context.reference+'\n'))throw new WorkspaceError('The exact email fields or private scope changed. Review them again.',409);
      return claims;
    }
    async function beginMailSendPreview(id,reference,approval){
      const route=routeFor(id),item=itemFor(id,false),contact=route.privacyContact,contract=sendProtocol().ROUTES[id];
      if(!exactKeys(approval,['own_request','profileId'])||approval.own_request!==true||approval.profileId!==state.profile.id)throw new WorkspaceError('The workspace changed. Review your own email request again.',409);
      requireNotHeld(item);requireCountryRoute(route,item);
      if(!contract||contact?.kind!=='privacy'||contact.email!==contract.to||contact.source!==contract.source||state.campaign.status!=='active'||operationStarted(item)||item.mail_send)throw new WorkspaceError('This route cannot start another reviewed email request.',409);
      const normalized=text(reference,512);if(normalized!==reference||/[<>]/.test(normalized)||/[<>]/.test(state.profile.name))throw new WorkspaceError('Enter a plain, single-line reference for your own public record.');
      const context={routeId:id,operationId:item.id,profileId:state.profile.id,country:state.profile.country||null,profileContext:mailSendProfile(),reference:normalized};
      const digest=await mailSendHash(JSON.stringify(context));
      const fresh=itemFor(id,false);if(state.profile.id!==context.profileId||fresh.id!==context.operationId||JSON.stringify(mailSendProfile())!==JSON.stringify(context.profileContext)||(state.profile.country||null)!==context.country||state.campaign.status!=='active'||fresh.held||operationStarted(fresh)||fresh.mail_send)throw new WorkspaceError('The workspace changed before the private preview was reserved.',409);
      fresh.operation_id=context.operationId;fresh.operation_source='browser_workspace';fresh.operation_started_at=clock();
      fresh.mail_send={id:context.operationId,workspace_id:context.profileId,source:'local_native',phase:'preparing',created_at:clock(),closed:false,revocation_confirmed:false,attempt_started:false,context_digest:digest};
      changed(fresh,'running','A private email preview was reserved. No message has been sent.');event('You authorized a private email preview for '+route.name+'. No record reference or email body was saved.');save();
      Object.freeze(context.profileContext);return Object.freeze(context);
    }
    async function bindMailSendPreview(context,response){
      await mailSendReady(context,response);const digest=await mailSendHash(JSON.stringify(context)),{item,record}=mailSendContext(context);
      if(record.context_digest!==digest||record.closed||item.held||state.campaign.status!=='active'||record.phase!=='preparing'&&!(record.phase==='ready'&&record.capability===response.capability))throw new WorkspaceError('This email preview is no longer active.',409);
      Object.assign(record,{phase:'ready',request_id:response.request_id,capability:response.capability,message_digest:response.message_digest,expires_at:response.expires_at});
      item.operation_email=response.preview.from;item.operation_email_role='removal';changed(item,'needs_broker_step','The exact removal-only email is ready for review. No message has been sent.');save();return dashboard();
    }
    async function prepareMailSend(context,response,approval){
      if(!exactKeys(approval,['authorized','own_request'])||approval.authorized!==true||approval.own_request!==true)throw new WorkspaceError('Approve the exact email and confirm it concerns your own record.');
      await mailSendReady(context,response);const digest=await mailSendHash(JSON.stringify(context)),{item,record}=mailSendContext(context);
      if(record.context_digest!==digest||record.phase!=='ready'||record.closed||record.attempt_started||item.held||state.campaign.status!=='active'||record.capability!==response.capability||record.message_digest!==response.message_digest)throw new WorkspaceError('This reviewed email cannot be sent again.',409);
      record.phase='sending';record.attempt_started=true;changed(item,'uncertain','One approved email send was reserved. Its result is unknown; no repeat is authorized.');event('You approved one removal-only email attempt for '+routeFor(context.routeId).name+'.');save();
      return {routeId:context.routeId,operationId:context.operationId,profileId:context.profileId,capability:record.capability,preview:clone(response.preview),authorized:true,own_request:true};
    }
    function mailSendOutcome(id,operationId,result,record){
      const keys=['status','route_id','operation_id','request_id','automatic_execution','delivery_verified','acceptance_verified','deletion_verified',...(Object.hasOwn(result||{},'message_id')?['message_id']:[]),...(Object.hasOwn(result||{},'thread_id')?['thread_id']:[])];
      if(!exactKeys(result,keys)||result.route_id!==id||result.operation_id!==operationId||!['provider_accepted','unknown','ready','revoked','already_started','preparing','blocked'].includes(result.status)||result.automatic_execution!==false||result.delivery_verified!==false||result.acceptance_verified!==false||result.deletion_verified!==false||
        result.request_id!==null&&!/^[a-f0-9]{32}$/.test(result.request_id)||record.request_id&&result.request_id!==null&&record.request_id!==result.request_id||
        ['message_id','thread_id'].some(key=>Object.hasOwn(result,key)&&!(typeof result[key]==='string'&&/^[A-Za-z0-9_-]{1,128}$/.test(result[key])))||result.status==='provider_accepted'&&(!record.attempt_started||!result.request_id||!result.message_id||!result.thread_id))throw new WorkspaceError('The local outbox result does not match this request.',409);
      return result;
    }
    function recordMailSend(profileId,operationId,result){
      active(false);if(state.profile.id!==profileId)throw new WorkspaceError('This email result belongs to another workspace.',409);
      const id=result?.route_id,item=itemFor(id,false),record=item.mail_send;
      if(!record||record.id!==operationId||record.source!=='local_native'||record.workspace_id!==profileId)throw new WorkspaceError('No matching local email action exists.',409);
      mailSendOutcome(id,operationId,result,record);
      if(record.revocation_confirmed&&result.status!=='revoked')return dashboard();
      if(record.result==='provider_accepted'&&result.status!=='provider_accepted')throw new WorkspaceError('The provider result is already recorded; no repeat is authorized.',409);
      record.result=result.status;record.observed_at=clock();if(result.request_id)record.request_id=result.request_id;
      if(result.status==='provider_accepted'){record.phase='provider_accepted';record.message_id=result.message_id;record.thread_id=result.thread_id;}
      else if(result.status==='revoked'){record.phase='revoked';record.closed=true;record.revocation_confirmed=true;}
      else if(record.attempt_started)record.phase='unknown';
      item.evidence={source:'local_removal_mail',result:result.status,observed_at:clock(),delivery_verified:false,acceptance_verified:false,deletion_verified:false};
      if(!item.held)changed(item,result.status==='provider_accepted'?'needs_broker_step':result.status==='revoked'?'blocked':'uncertain',result.status==='provider_accepted'?'Google accepted the approved email. Broker delivery, acceptance and deletion remain unverified.':'The email outcome needs reconciliation. No automatic repeat is authorized.');
      event('You recorded the local outbox outcome for '+routeFor(id).name+'. No deletion was established.');save();return dashboard();
    }
    async function reserveMailSendClosure(context,response,approval){
      if(!exactKeys(approval,['discard_issued'])||typeof approval.discard_issued!=='boolean')throw new WorkspaceError('Choose how to close the private email preview.');
      const minimal=exactKeys(context,['routeId','operationId','profileId','contextDigest']);
      if(minimal&&(!OPERATION.test(context.operationId||'')||!OPERATION.test(context.profileId||'')||!/^[a-f0-9]{64}$/.test(context.contextDigest||'')||response||approval.discard_issued))throw new WorkspaceError('Choose the original private email cleanup reference.',409);
      if(response)await mailSendReady(context,response,true);const digest=minimal?context.contextDigest:await mailSendHash(JSON.stringify(context));active(false);
      if(state.profile.id!==context.profileId)return {status:'workspace_replaced'};
      const item=itemFor(context.routeId,false),record=item.mail_send;
      if(!record||record.id!==context.operationId||record.source!=='local_native')return {status:'operation_replaced'};
      if(record.context_digest!==digest)throw new WorkspaceError('The email cleanup context changed.',409);
      if(approval.discard_issued&&response&&!item.held&&!record.closed&&record.capability===response.capability&&['ready','sending','provider_accepted'].includes(record.phase))return {status:'already_bound'};
      if(record.revocation_confirmed)return {status:'already_revoked'};
      record.closed=true;if(!record.closure_id)record.closure_id=uuid();if(record.phase!=='provider_accepted')record.phase='closed';
      save();return {status:'reserved',closureId:record.closure_id};
    }
    function mailSendClosureContext(id,expectedProfileId){
      const item=itemFor(id,false),record=item.mail_send;if(state.profile.id!==expectedProfileId||!record||record.source!=='local_native'||record.workspace_id!==expectedProfileId)throw new WorkspaceError('The private cleanup belongs to another workspace.',409);
      return Object.freeze({routeId:id,operationId:record.id,profileId:expectedProfileId,contextDigest:record.context_digest});
    }
    function recordMailSendClosure(context,closureId,result){
      active(false);if(state.profile.id!==context.profileId)throw new WorkspaceError('This cleanup belongs to another workspace.',409);
      const item=itemFor(context.routeId,false),record=item.mail_send;
      if(!record||record.id!==context.operationId||record.source!=='local_native'||!record.closed||!OPERATION.test(closureId||'')||record.closure_id!==closureId)throw new WorkspaceError('The private email cleanup reference changed.',409);
      mailSendOutcome(context.routeId,context.operationId,result,record);if(!['revoked','already_started','unknown'].includes(result.status))throw new WorkspaceError('This result does not establish an email cleanup outcome.',409);
      if(record.result==='provider_accepted'&&result.status==='revoked')throw new WorkspaceError('A provider-accepted message cannot be withdrawn by revoking a draft.',409);
      record.revocation_confirmed=record.revocation_confirmed||result.status==='revoked';record.result=record.result==='provider_accepted'?record.result:record.revocation_confirmed?'revoked':result.status;record.observed_at=clock();if(result.request_id&&!record.request_id)record.request_id=result.request_id;
      if(record.revocation_confirmed)record.phase='revoked';save();return dashboard();
    }
    function mailSendResultRequest(id){const item=itemFor(id,false),record=item.mail_send;if(!record||record.source!=='local_native'||record.workspace_id!==state.profile.id)throw new WorkspaceError('No active local outbox reference is available.',409);return {route_id:id,operation_id:record.id,explicit:true};}
    function resetMailSend(id,approval){
      const item=itemFor(id,false),record=item.mail_send;
      if(!exactKeys(approval,['authorized','profileId'])||approval.authorized!==true||approval.profileId!==state.profile.id||state.campaign.status!=='active'||item.held||!record||record.source!=='local_native'||!record.closed||!record.revocation_confirmed||record.attempt_started)throw new WorkspaceError('Only a confirmed revoked, unsent draft can be explicitly reset.',409);
      const next=uuid();if(!OPERATION.test(next)||next===record.id)throw new WorkspaceError('A new draft reference is unavailable.',503);
      item.id=next;item.operation_id=null;item.operation_started_at=null;delete item.operation_email;delete item.operation_email_role;delete item.mail_send;delete item.evidence;changed(item,'ready');event('You explicitly reset a confirmed revoked, unsent email draft for '+routeFor(id).name+'. No new preview or message was started.');save();return dashboard();
    }
    function recordUser(id, value) {
      if (!USER_STATES.has(value)) throw new WorkspaceError('A user report cannot establish verified deletion.');
      const item = itemFor(id);
      requireNotHeld(item);
      if (!item.operation_id) { item.operation_id = item.id; item.operation_started_at = clock(); }
      changed(item, value); event(routeFor(id).name + '. ' + TEXT[value]); save(); return dashboard();
    }
    function opened(id) {
      const item = itemFor(id);
      requireNotHeld(item);
      requireCountryRoute(routeFor(id), item);
      if (state.campaign.status !== 'active') throw new WorkspaceError('Allow checks before opening a broker action.', 409);
      if (!item.operation_id && !USER_STATES.has(item.status)) changed(item, 'opened');
      event('You opened the ' + routeFor(id).name + ' official form. No submission was established.'); save(); return dashboard();
    }
    function holdRoute(id, expectedIdentityPreview, expectedProfileId) {
      if(expectedProfileId!==undefined&&expectedProfileId!==active().profile.id)throw new WorkspaceError('The workspace changed. Review this route before putting it on hold.',409);
      if (expectedIdentityPreview !== undefined && JSON.stringify(expectedIdentityPreview) !== JSON.stringify(identityPreview(id)))
        throw new WorkspaceError('The request changed. Review its current next step before putting it on hold.', 409);
      const item = itemFor(id);
      item.held = true; item.held_at = clock();
      if(item.mail_contact?.transport==='local_native')item.mail_contact.revoked=true;
      if(item.mail_send){item.mail_send.closed=true;if(!['provider_accepted','revoked'].includes(item.mail_send.phase))item.mail_send.phase='closed';}
      event('You put ' + routeFor(id).name + ' on hold. No new broker or mailbox action will start.'); save(); return dashboard();
    }
    function resumeRoute(id) {
      const item = itemFor(id);
      if (item.held !== true) throw new WorkspaceError('This route is not on hold.', 409);
      item.held = false; item.resumed_at = clock();
      event('You explicitly resumed ' + routeFor(id).name + '. Existing operation references still prevent repeats.'); save(); return dashboard();
    }
    function footprintChange(action, profileId) {
      active();
      if (profileId !== undefined && profileId !== state.profile.id) throw new WorkspaceError('The workspace changed. Review this cleanup list again before saving it.', 409);
      if (state.campaign.status !== 'active') throw new WorkspaceError('Resume your privacy work before changing the cleanup plan.', 409);
      try { state.footprint = action(planner()); }
      catch (error) { throw new WorkspaceError(error?.message || 'The cleanup plan could not be changed.'); }
      event('You updated your local cleanup plan. No account, social content, website or search result was changed.'); save(); return dashboard();
    }
    function importFootprint(content, format, approval) {
      if (!approval || typeof approval !== 'object' || Array.isArray(approval) || Object.keys(approval).some(key => !['authorized', 'profileId'].includes(key)) || approval.authorized !== true)
        throw new WorkspaceError('Confirm this imported list concerns your own information first.');
      return footprintChange(library => library.add(state.footprint, library.parse(content, format), { uuid, now: clock() }), approval.profileId);
    }
    function chooseFootprintItem(id, choice) {
      if (!choice || typeof choice !== 'object' || Array.isArray(choice)) throw new WorkspaceError('Review this cleanup choice first.');
      const { profileId, ...options } = choice;
      return footprintChange(library => library.choose(state.footprint, id, options, { now: clock() }), profileId);
    }
    function recordFootprintProgress(id, report) {
      if (!report || typeof report !== 'object' || Array.isArray(report)) throw new WorkspaceError('Review this cleanup report first.');
      const { profileId, ...options } = report;
      return footprintChange(library => library.progress(state.footprint, id, options, { now: clock() }), profileId);
    }
    function exportData() { active(); return JSON.stringify({ version: VERSION, exported_at: clock(), profile: clone(state.profile), items: clone(state.items), activity: clone(state.activity), footprint: clone(state.footprint) }, null, 2); }
    function importData(raw) {
      read();
      if (state.profile) throw new WorkspaceError('Delete this browser workspace before importing another one.', 409);
      if (typeof raw !== 'string' || raw.length > 1048576) throw new WorkspaceError('Choose a valid workspace export smaller than 1 MiB.');
      let data;
      try { data = JSON.parse(raw); } catch (_) { throw new WorkspaceError('Invalid workspace export.'); }
      if (!data || data.version !== VERSION || !data.profile || !data.items || typeof data.items !== 'object' || Array.isArray(data.items)) throw new WorkspaceError('Invalid workspace export.');
      const forbidden = new Set(['removed', 'verified_removed', 'not_found']);
      const restoredFields = {}, restoredContacts = {}, restoredEmails = {}, restoredFinals = {}, restoredMailSends = {};
      for (const [id, item] of Object.entries(data.items)) {
        const route = routeFor(id);
        if (!item || forbidden.has(item.status) || !Object.hasOwn(TEXT, item.status)) throw new WorkspaceError('Imports cannot establish verified removal or listing absence.');
        if (item.held !== undefined && typeof item.held !== 'boolean') throw new WorkspaceError('Invalid imported hold state.');
        restoredFields[id] = approvedFields(route, item.fields === undefined ? {} : item.fields);
        if (item.mail_contact) restoredContacts[id] = mailContact(item.mail_contact, id, item.operation_id || item.id, Math.floor(Date.parse(clock()) / 1000), true);
        if (item.operation_email !== undefined || item.operation_email_role !== undefined) {
          if (!item.operation_id || email(item.operation_email) !== item.operation_email || !['profile', 'business', 'removal'].includes(item.operation_email_role))
            throw new WorkspaceError('Invalid imported request email.');
          restoredEmails[id] = { address: item.operation_email, role: item.operation_email_role };
        }
        if (Object.hasOwn(item, 'final_submission')) restoredFinals[id] = finalSubmission(item.final_submission, id, item.operation_id);
        if (Object.hasOwn(item, 'mail_send')) restoredMailSends[id] = sendRecord(item.mail_send,id,item.operation_id,data.profile.id);
      }
      const restoredFootprint = validatedFootprint(data.footprint, true);
      const input = data.profile;
      const candidate = { name: text(input.name, 120), email: email(input.email), age: input.age, authorized: true };
      if (!Number.isInteger(candidate.age) || candidate.age < 18 || candidate.age > 120) throw new WorkspaceError('Invalid imported age.');
      const restoredLocation = locationFields({ country: input.country, region: input.region, city: input.city });
      // Imported evidence is a user report, never an authenticated companion result.
      state = empty();
      state.footprint = restoredFootprint;
      state.profile = { id: uuid(), ...candidate, ...restoredLocation, verification_method: 'self_attested_browser', email_verified: false,
        authorized_at: clock(), authorization_statement: AUTHORIZATION };
      delete state.profile.authorized;
      seed();
      for (const [id, imported] of Object.entries(data.items)) {
        const item = state.items[id];
        item.fields = restoredFields[id];
        item.affirmations = {};
        if (imported.held === true || imported.status === 'held') {
          item.held = true; item.held_at = typeof imported.held_at === 'string' && Number.isFinite(Date.parse(imported.held_at)) ? new Date(imported.held_at).toISOString() : clock();
        }
        if(imported.local_mail_setup_closed===true){item.local_mail_setup_closed=true;item.local_mail_setup_revocation_confirmed=false;item.held=true;item.held_at=clock();}
        if (restoredContacts[id]) {
          item.id = restoredContacts[id].operation_id; item.mail_contact = restoredContacts[id];
          // Import creates a new workspace identity. Retain the old native grant
          // reference for private history, never rebind it to this new identity.
          if(item.mail_contact.transport==='local_native')item.mail_contact.revoked=true;
          if (imported.mail_receipt && ['held', 'pending'].includes(imported.mail_receipt.status)) item.mail_receipt = {
            status: imported.mail_receipt.status, checked_at: clock(), source: 'imported_user_history', authenticated: false,
            acceptance_verified: false, deletion_verified: false
          };
        }
        if (imported.continuation && typeof imported.continuation.started_at === 'string' && Number.isFinite(Date.parse(imported.continuation.started_at))) {
          item.continuation = { started_at: new Date(imported.continuation.started_at).toISOString(), result: 'unknown',
            acceptance_verified: false, deletion_verified: false, source: 'imported_user_history' };
        }
        if (imported.status === 'opened') changed(item, 'opened');
        else if (imported.status === 'held' && !imported.operation_id) changed(item, 'ready');
        else if (imported.status !== 'ready') {
          const report = USER_STATES.has(imported.status) ? imported.status :
            imported.status === 'requested' ? 'user_reported_requested' : 'uncertain';
          changed(item, report, 'Imported history is self-reported. Check the broker outcome before starting another action.');
          // Keep the reference needed to reconcile the same held operation with
          // the companion. Importing its reference does not import its evidence.
          item.operation_id = typeof imported.operation_id === 'string' && /^[a-f0-9-]{32,40}$/.test(imported.operation_id)
            ? imported.operation_id : uuid();
          item.operation_source = 'imported_user_history';
          if (restoredEmails[id]) {
            item.operation_email = restoredEmails[id].address;
            item.operation_email_role = restoredEmails[id].role;
          }
          item.operation_started_at = typeof imported.operation_started_at === 'string' && imported.operation_started_at.length <= 40 && Number.isFinite(Date.parse(imported.operation_started_at))
            ? new Date(imported.operation_started_at).toISOString() : clock();
        }
        if (restoredFinals[id]) {
          const reference = restoredFinals[id];
          item.operation_id = imported.operation_id; item.operation_source = 'imported_user_history';
          item.final_submission = { id: reference.id, started_at: reference.started_at, result: 'unknown', attempt_verified: false,
            acceptance_verified: false, deletion_verified: false, source: 'imported_user_history' };
          if (!USER_STATES.has(item.status)) changed(item, 'uncertain', 'Imported final-action history has an unknown outcome. Review the existing broker action; no repeat is authorized.');
        }
        if(restoredMailSends[id]){
          const reference=restoredMailSends[id];item.operation_id=reference.id;item.operation_source='imported_user_history';
          item.mail_send={...reference,source:'imported_user_history',phase:'closed',closed:true,revocation_confirmed:false,result:'unknown'};
          delete item.mail_send.message_id;delete item.mail_send.thread_id;item.held=true;item.held_at=clock();
          changed(item,'uncertain','Imported email history is inactive. Its capability cannot authorize a new send or establish broker acceptance.');
        }
      }
      event('Workspace imported as self-reported history. No broker was contacted and no deletion was verified.'); save(); return dashboard();
    }
    function remove() {
      try { storage.removeItem(KEY); } catch (_) { throw new WorkspaceError('The browser could not delete this workspace.', 503); }
      state = empty(); cachedRaw = null; return { ok: true };
    }
    function updateProfile(body) {
      active();
      const next = { ...state.profile, ...locationFields(body) };
      state.profile = next; event('Location saved on this browser. No request was started.'); save(); return { ok: true };
    }
    async function api(path, options = {}) {
      try {
        const method = options.method || 'GET';
        let body = {};
        if (options.body) {
          if (typeof options.body !== 'string' || options.body.length > 10000) throw new WorkspaceError('Invalid request.');
          try { body = JSON.parse(options.body); } catch (_) { throw new WorkspaceError('Invalid request.'); }
          if (!body || typeof body !== 'object' || Array.isArray(body)) throw new WorkspaceError('Invalid request.');
        }
        let result;
        if (path === '/api/config' && method === 'GET') result = { mode: 'browser', browser_workspace: true, local_only: true, manual: true, synthetic_only: false,
          email_configured: false, automation_configured: true, authorization_statement: AUTHORIZATION };
        else if (path === '/api/signup' && method === 'POST') result = signup(body);
        else if (path === '/api/dashboard' && method === 'GET') result = dashboard();
        else if (path === '/api/profile' && method === 'POST') result = updateProfile(body);
        else if (path === '/api/account' && method === 'DELETE' && body.confirm === true) result = remove();
        else if (path === '/api/campaign' && method === 'POST') {
          active();
          if (!['run', 'pause', 'resume'].includes(body.action)) throw new WorkspaceError('Unknown workspace action.');
          if (body.action === 'pause') {state.campaign.status = 'paused';for(const item of Object.values(state.items))if(item.mail_send?.phase==='preparing'){item.mail_send.closed=true;item.mail_send.phase='closed';}}
          else if (body.action === 'resume') state.campaign.status = 'active';
          else if (state.campaign.status === 'active') { seed(); event('Your route plan is ready. Start each broker action explicitly. No broker was contacted.'); }
          save(); result = { ok: true };
        } else if (path === '/api/routes' && method === 'GET') result = clone(routes);
        else if (path === '/api/confirmation' && method === 'POST') { recordUser(body.site_id, 'user_reported_completed'); result = { ok: true }; }
        else throw new WorkspaceError('This browser workspace has no email login or server account.', 404);
        return { ok: true, status: 200, json: async () => clone(result) };
      } catch (error) {
        const status = error instanceof WorkspaceError ? error.status : 503;
        const message = error instanceof WorkspaceError ? error.message : 'Browser workspace storage is unavailable.';
        return { ok: false, status, json: async () => ({ error: message }) };
      }
    }
    return Object.freeze({ api, snapshot: () => clone(read()), profile: () => clone(active().profile), routes: () => clone(routes),
      beginMailSendPreview,bindMailSendPreview,prepareMailSend,recordMailSend,reserveMailSendClosure,recordMailSendClosure,mailSendClosureContext,mailSendResultRequest,resetMailSend,
      setEvidence, prepare, fillPreview, prepareReviewed, matchRequest, recordMatch, holdRoute, resumeRoute, mailSessionRequest, bindMailContact, clearMailContact, reserveLocalMailSetupClosure, recordLocalMailSetupClosure, mailCheckRequest, recordMailReceipt,
      mailContinuationRequest, prepareMailContinuation, recordMailContinuation,
      recordCompanion, observationRequest, focusRequest, thatsThemPreview, prepareThatsThem, recordThatsThem, peopleFindersPreview, preparePeopleFinders, recordPeopleFinders, peopleTracePreview, preparePeopleTrace, recordPeopleTrace, cmaPreview, prepareCMA, recordCMA, myLifePreview, prepareMyLife, recordMyLife, identityPreview, prepareIdentitySubmission, recordIdentitySubmission, identityResultRequest, recordObservation, searchRequest, privacyDraftRequest, recordUser, opened, exportData, importData, importFootprint, chooseFootprintItem, recordFootprintProgress, remove, dashboard,
      updateRoute: setEvidence, applyCompanionResult: recordCompanion });
  }
  let instance;
  // Default browser mutations share an origin-wide exclusive lock. Read-only
  // access must not persist recovery updates outside that lock.
  const defaults = () => { if (!instance) instance = create({ recoverInterrupted: false }); return instance; };
  async function exclusive(action) {
    const locks = root.navigator?.locks;
    if (!locks || typeof locks.request !== 'function') throw new WorkspaceError('This browser cannot safely coordinate workspace changes. Use a current browser with Web Locks support.', 503);
    return locks.request(KEY + '-write', { mode: 'exclusive' }, action);
  }
  const mutators = new Set(['beginMailSendPreview','bindMailSendPreview','prepareMailSend','recordMailSend','reserveMailSendClosure','recordMailSendClosure','resetMailSend','prepareThatsThem','recordThatsThem','preparePeopleFinders','recordPeopleFinders','prepareMyLife', 'recordMyLife', 'prepareCMA', 'recordCMA', 'preparePeopleTrace', 'recordPeopleTrace', 'setEvidence', 'prepare', 'prepareReviewed', 'matchRequest', 'recordMatch', 'holdRoute', 'resumeRoute', 'mailSessionRequest', 'bindMailContact', 'clearMailContact', 'reserveLocalMailSetupClosure', 'recordLocalMailSetupClosure', 'mailCheckRequest', 'recordMailReceipt', 'mailContinuationRequest', 'prepareMailContinuation', 'recordMailContinuation', 'prepareIdentitySubmission', 'recordIdentitySubmission', 'recordCompanion', 'observationRequest', 'recordObservation', 'searchRequest', 'privacyDraftRequest', 'recordUser', 'opened', 'importData', 'importFootprint', 'chooseFootprintItem', 'recordFootprintProgress', 'remove', 'updateRoute', 'applyCompanionResult']);
  const exported = { create, KEY, AUTHORIZATION, WorkspaceError, routes: () => clone(routes), listingURL };
  for (const name of ['beginMailSendPreview','bindMailSendPreview','prepareMailSend','recordMailSend','reserveMailSendClosure','recordMailSendClosure','mailSendClosureContext','mailSendResultRequest','resetMailSend','thatsThemPreview','prepareThatsThem','recordThatsThem','peopleFindersPreview','preparePeopleFinders','recordPeopleFinders','snapshot', 'profile', 'setEvidence', 'prepare', 'fillPreview', 'prepareReviewed', 'matchRequest', 'recordMatch', 'holdRoute', 'resumeRoute', 'mailSessionRequest', 'bindMailContact', 'clearMailContact', 'reserveLocalMailSetupClosure', 'recordLocalMailSetupClosure', 'mailCheckRequest', 'recordMailReceipt', 'mailContinuationRequest', 'prepareMailContinuation', 'recordMailContinuation', 'recordCompanion', 'observationRequest', 'focusRequest', 'myLifePreview', 'prepareMyLife', 'recordMyLife', 'peopleTracePreview', 'cmaPreview', 'prepareCMA', 'recordCMA', 'preparePeopleTrace', 'recordPeopleTrace', 'identityPreview', 'prepareIdentitySubmission', 'recordIdentitySubmission', 'identityResultRequest', 'recordObservation', 'searchRequest', 'privacyDraftRequest', 'recordUser', 'opened', 'exportData', 'importData', 'importFootprint', 'chooseFootprintItem', 'recordFootprintProgress', 'remove', 'dashboard', 'updateRoute', 'applyCompanionResult']) {
    exported[name] = (...args) => mutators.has(name) ? exclusive(() => defaults()[name](...args)) : defaults()[name](...args);
  }
  exported.api = async (...args) => {
    try { return await exclusive(() => defaults().api(...args)); }
    catch (error) {
      return { ok: false, status: error instanceof WorkspaceError ? error.status : 503,
        json: async () => ({ error: error instanceof WorkspaceError ? error.message : 'Browser workspace coordination is unavailable.' }) };
    }
  };
  return Object.freeze(exported);
});
