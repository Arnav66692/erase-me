/* Conservative, page-local identity matching. No navigation, storage or requests. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.EraseRecordMatcher = api;
})(typeof globalThis === 'object' ? globalThis : this, function () {
  'use strict';
  const MAX_BYTES = 100 * 1024, MAX_PERSONS = 20, MAX_NODES = 512, MAX_DEPTH = 6, MAX_SCRIPTS = 20;
  const extracted = new WeakMap();
  const own = (object, key) => object !== null && typeof object === 'object' && Object.hasOwn(object, key);
  const plain = value => value !== null && typeof value === 'object' && !Array.isArray(value);
  const normalized = value => typeof value === 'string' && value.length <= 120 && !/[\u0000-\u001f\u007f]/.test(value)
    ? value.normalize('NFKC').trim().replace(/\s+/gu, ' ').toLowerCase() : '';
  function candidateURL(value) {
    if (typeof value !== 'string' || value.length > 2048 || /[\s\\?#\u0000-\u001f\u007f]/u.test(value) || /%(?:2f|5c|00)/i.test(value)) return null;
    try {
      const url = new URL(value);
      return url.protocol === 'https:' && url.hostname && !url.username && !url.password && !url.port ? url.href : null;
    } catch (_) { return null; }
  }
  function email(value, fromRecord = false) {
    if (typeof value !== 'string' || value.length > 261) return null;
    const input = (fromRecord ? value.replace(/^mailto:/i, '') : value).trim();
    if (input.length > 254 || /[\s<>*\u2022\u0000-\u001f\u007f]/u.test(input) || !/^[^@]+@[^@]+$/.test(input)) return null;
    const [local, domain] = input.split('@');
    try {
      if (/[\\/:?#%]/.test(domain)) return null;
      const host = new URL('https://' + domain).hostname;
      if (!host.includes('.') || !host.split('.').every(part => /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/i.test(part))) return null;
      return local + '@' + host.toLowerCase();
    } catch (_) { return null; }
  }
  function phone(value, fromRecord = false) {
    if (typeof value !== 'string' || value.length > 44) return null;
    const input = (fromRecord ? value.replace(/^tel:/i, '') : value).normalize('NFKC').trim();
    if (input.length > 40 || !/^\+?[0-9 ().-]+$/.test(input)) return null;
    const digits = input.replace(/\D/g, '');
    return /^\d{7,15}$/.test(digits) ? digits : null;
  }
  const ageNumber = value => typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 130;
  function calendarDate(value) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
    const date = new Date(value + 'T00:00:00.000Z');
    return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value ? date : null;
  }
  function today(value) {
    if (value === undefined) value = new Date();
    if (value instanceof Date) return Number.isFinite(value.getTime()) ? calendarDate(value.toISOString().slice(0, 10)) : null;
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z)?$/.test(value)) return null;
    const date = calendarDate(value.slice(0, 10));
    const instant = new Date(value);
    return date && Number.isFinite(instant.getTime()) && instant.toISOString().slice(0, 10) === value.slice(0, 10) ? date : null;
  }
  function birthAge(value, current) {
    const born = calendarDate(value);
    if (!born || !current || born > current) return null;
    const birthdayPending = current.getUTCMonth() < born.getUTCMonth() ||
      current.getUTCMonth() === born.getUTCMonth() && current.getUTCDate() < born.getUTCDate();
    const age = current.getUTCFullYear() - born.getUTCFullYear() - Number(birthdayPending);
    return ageNumber(age) ? age : null;
  }
  function schemaContext(value, depth = 0) {
    if (depth > MAX_DEPTH) return false;
    const schema = value => typeof value === 'string' && /^https?:\/\/schema\.org\/?$/.test(value);
    if (schema(value)) return true;
    if (Array.isArray(value)) return value.length > 0 && value.length <= 10 && value.every(item => schemaContext(item, depth + 1));
    return plain(value) && Object.keys(value).length === 1 && own(value, '@vocab') && schema(value['@vocab']);
  }
  function personType(value, schema) {
    const isPerson = value => schema !== false && /^https?:\/\/schema\.org\/Person$/.test(value) || schema === true && value === 'Person';
    return typeof value === 'string' ? isPerson(value) : Array.isArray(value) && value.length <= 10 && value.some(type => typeof type === 'string' && isPerson(type));
  }
  function values(object, key, transform) {
    if (!own(object, key)) return [];
    const raw = Array.isArray(object[key]) ? object[key] : [object[key]];
    return raw.length <= 10 ? raw.map(value => transform(value, true)).filter(Boolean) : [];
  }
  function output(status, url, evidence = []) {
    return Object.freeze({ status, ...(url ? { candidateUrl: url } : {}), evidence: Object.freeze([...evidence]) });
  }
  function extractionHandle(source) {
    const handle = output(source.valid ? 'needs_identity' : 'unsupported', source.url,
      source.valid ? ['structured_person', 'exact_candidate_url'] : []);
    extracted.set(handle, source);
    return handle;
  }
  function extractJSONLD(doc, expectedUrl) {
    const url = candidateURL(expectedUrl), records = [];
    let byteCount = 0, nodes = 0, persons = 0;
    if (!url || !doc || doc.URL !== url || typeof doc.querySelectorAll !== 'function') return extractionHandle({ valid: false, url: null, records });
    try {
      const scripts = doc.querySelectorAll('script[type="application/ld+json"]');
      if (!Number.isSafeInteger(scripts.length) || scripts.length > MAX_SCRIPTS) throw new Error();
      const walk = (value, schema = null, depth = 0) => {
        if (++nodes > MAX_NODES || depth > MAX_DEPTH) throw new Error();
        if (Array.isArray(value)) { for (const child of value) walk(child, schema, depth + 1); return; }
        if (!plain(value)) throw new Error();
        if (own(value, '@context')) schema = schemaContext(value['@context']);
        if (own(value, '@type') && personType(value['@type'], schema)) {
          if (++persons > MAX_PERSONS) throw new Error();
          // A name elsewhere on the page or a sameAs link does not bind a record.
          const proof = own(value, 'url') ? value.url : own(value, '@id') ? value['@id'] : null;
          if (candidateURL(proof) === url) records.push(value);
        }
        if (own(value, '@graph')) walk(value['@graph'], schema, depth + 1);
      };
      for (const script of scripts) {
        const raw = script.textContent;
        if (typeof raw !== 'string' || raw.length > MAX_BYTES) throw new Error();
        byteCount += new TextEncoder().encode(raw).byteLength;
        if (byteCount > MAX_BYTES) throw new Error();
        walk(JSON.parse(raw));
      }
      return extractionHandle({ valid: records.length > 0, url, records });
    } catch (_) { return extractionHandle({ valid: false, url, records: [] }); }
  }
  function evaluate(profile, handle, options = {}) {
    const source = handle && typeof handle === 'object' ? extracted.get(handle) : null;
    if (!source?.valid) return output('unsupported', source?.url);
    const current = today(options?.now);
    if (!current || !plain(profile) || !own(profile, 'name') || !normalized(profile.name)) return output('needs_identity', source.url);
    const name = normalized(profile.name);
    const suppliedEmail = own(profile, 'email') && profile.email != null && profile.email !== '';
    const suppliedPhone = own(profile, 'phone') && profile.phone != null && profile.phone !== '';
    const identityEmail = suppliedEmail ? email(profile.email) : null, identityPhone = suppliedPhone ? phone(profile.phone) : null;
    const suppliedAge = own(profile, 'age') && profile.age != null, suppliedCity = own(profile, 'city') && profile.city != null && profile.city !== '';
    const city = suppliedCity ? normalized(profile.city) : '';
    if (suppliedEmail && !identityEmail || suppliedPhone && !identityPhone || suppliedAge && !ageNumber(profile.age) || suppliedCity && !city)
      return output('needs_identity', source.url);
    let possible = 0, unresolved = 0;
    const matches = [], conflicts = new Set();
    for (const record of source.records) {
      if (!own(record, 'name') || !normalized(record.name)) { unresolved++; continue; }
      if (normalized(record.name) !== name) { conflicts.add('name'); continue; }
      possible++;
      const ages = [], cities = [];
      let invalid = false;
      if (own(record, 'age')) { if (ageNumber(record.age)) ages.push(record.age); else invalid = true; }
      if (own(record, 'birthDate')) { const age = birthAge(record.birthDate, current); if (age !== null) ages.push(age); else invalid = true; }
      if (new Set(ages).size > 1) invalid = true;
      if (own(record, 'address') && plain(record.address) && own(record.address, 'addressLocality')) {
        const value = normalized(record.address.addressLocality);
        if (value) cities.push(value); else invalid = true;
      }
      if (suppliedAge && ages.some(value => value !== profile.age)) { conflicts.add('age'); continue; }
      if (city && cities.some(value => value !== city)) { conflicts.add('city'); continue; }
      if (invalid) { unresolved++; continue; }
      const emails = values(record, 'email', email), phones = values(record, 'telephone', phone);
      const emailMatch = identityEmail && emails.includes(identityEmail), phoneMatch = identityPhone && phones.includes(identityPhone);
      if (emailMatch || phoneMatch) {
        matches.push(['structured_person', 'exact_candidate_url', 'name', ...(emailMatch ? ['email'] : []), ...(phoneMatch ? ['phone'] : []),
          ...(suppliedAge && ages.length ? ['age'] : []), ...(city && cities.length ? ['city'] : [])]);
      } else if (!identityEmail && !identityPhone || !emails.length && !phones.length) unresolved++;
      else conflicts.add('identity');
    }
    if (matches.length > 1) return output('ambiguous', source.url, ['structured_person', 'exact_candidate_url']);
    if (matches.length === 1 && unresolved > 0) return output('ambiguous', source.url, ['structured_person', 'exact_candidate_url']);
    if (matches.length === 1) return output('matched', source.url, matches[0]);
    if (unresolved) return output(possible > 1 ? 'ambiguous' : 'needs_identity', source.url, ['structured_person', 'exact_candidate_url', 'name']);
    return output('not_matched', source.url, [...conflicts]);
  }
  const matchPage = (profile, doc, expectedUrl, options) => evaluate(profile, extractJSONLD(doc, expectedUrl), options);
  return Object.freeze({ extractJSONLD, evaluate, matchPage });
});
