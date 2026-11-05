'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const Matcher = require('../extension/record-matcher.js');
const url = 'https://www.spokeo.com/Example-Person/California/Example-City/p123456';
const profile = { name: 'Example Person', email: 'person@example.test', phone: '+1 (555) 123-4567', age: 20, city: 'Example City' };
const now = '2026-11-05';
const person = changes => ({ '@context': 'https://schema.org', '@type': 'Person', url, name: 'Example Person', ...changes });
const doc = (...blocks) => ({ URL:url, querySelectorAll: selector => {
  assert.equal(selector, 'script[type="application/ld+json"]');
  return blocks.map(block => ({ textContent: typeof block === 'string' ? block : JSON.stringify(block) }));
} });
const match = (blocks, identity = profile, options = { now }) => Matcher.matchPage(identity, doc(...(Array.isArray(blocks) ? blocks : [blocks])), url, options);

test('exact name and full typed email or phone can match the approved candidate only', () => {
  assert.equal(match(person({ email: 'mailto:person@EXAMPLE.TEST' })).status, 'matched');
  assert.equal(match(person({ telephone: 'tel:+1-555-123-4567' })).status, 'matched');
  const result = match(person({ email: profile.email, telephone: profile.phone, age: 20, address: { addressLocality: 'Example City' } }));
  assert.deepEqual(result, { status: 'matched', candidateUrl: url, evidence: ['structured_person', 'exact_candidate_url', 'name', 'email', 'phone', 'age', 'city'] });
});

test('name normalization preserves full identity distinctions and supports Unicode compatibility forms', () => {
  assert.equal(match(person({ name: '  Ｅｘａｍｐｌｅ　Ｐｅｒｓｏｎ ', email: profile.email })).status, 'matched');
  for (const name of ['Example Other Person', 'Example Persón', 'Example', 'Person Example'])
    assert.equal(match(person({ name, email: profile.email })).status, 'not_matched');
  assert.equal(match(person({ name: 'Örnek Kişi', email: profile.email }), { ...profile, name: 'ÖRNEK KİŞİ' }).status, 'not_matched');
  assert.equal(match(person({ name: '李 小龙', email: profile.email }), { ...profile, name: '李 小龙' }).status, 'matched');
});

test('name, age and city alone never authorize an automatic identity match', () => {
  const record = person({ age: 20, address: { addressLocality: 'Example City' } });
  assert.equal(match(record).status, 'needs_identity');
  assert.equal(match(record, { name: profile.name, age: 20, city: profile.city }).status, 'needs_identity');
  assert.equal(match([record, record]).status, 'ambiguous');
});

test('explicit age or locality conflicts override otherwise matching contact identity', () => {
  assert.equal(match(person({ email: profile.email, age: 21 })).status, 'not_matched');
  assert.equal(match(person({ email: profile.email, address: { addressLocality: 'Another City' } })).status, 'not_matched');
  assert.equal(match(person({ email: profile.email, address: { addressLocality: '  EXAMPLE　CITY  ' } })).status, 'matched');
});

test('emails retain their full local part and phones require every typed digit', () => {
  for (const email of ['PERSON@example.test', 'ｐｅｒｓｏｎ@example.test', 'person+other@example.test', 'person@different.test', 'per.son@example.test'])
    assert.equal(match(person({ email })).status, 'not_matched');
  for (const telephone of ['5551234567', '+1 555 123 4568', '0015551234567'])
    assert.equal(match(person({ telephone })).status, 'not_matched');
  for (const changes of [{ email: 'p***@example.test' }, { telephone: '+1 555 *** 4567' }, { telephone: '4567' }])
    assert.equal(match(person(changes)).status, 'needs_identity');
});

test('invalid user identity and removal-contact substitution remain unresolved', () => {
  for (const changes of [{ email: 'invalid' }, { phone: '555' }, { age: '20' }, { city: {} }])
    assert.equal(match(person({ email: profile.email, telephone: profile.phone }), { ...profile, ...changes }).status, 'needs_identity');
  assert.equal(match(person({ email: 'removal@example.test' }), { name: profile.name, confirmation_email: 'removal@example.test' }).status, 'needs_identity');
  assert.equal(match(person({ email: 'removal@example.test' }), { name: profile.name, mail_contact: { contact_email: 'removal@example.test' } }).status, 'needs_identity');
  for (const name of [undefined, null, '', {}, 'Example\u0000Person'])
    assert.equal(match(person({ name, email: profile.email })).status, 'needs_identity');
});

test('duplicate strong candidates and unresolved same-name records remain ambiguous', () => {
  const record = person({ email: profile.email });
  assert.equal(match([record, record]).status, 'ambiguous');
  assert.equal(match([record, person({ age: 20 })]).status, 'ambiguous');
  assert.equal(match([record, person({ name: 'Different Person', email: profile.email })]).status, 'matched');
});

test('structured records need exact HTTPS page association rather than sameAs or unrelated links', () => {
  for (const changes of [{ url: '/relative' }, { url: 'http://www.spokeo.com/person' }, { url: url + '/' }, { url: url + '?redirect=elsewhere' }, { url: url + '#person' }, { url: 'https://unrelated.example/person', '@id': url }])
    assert.equal(match(person({ email: profile.email, ...changes })).status, 'unsupported');
  assert.equal(match({ '@context': 'https://schema.org', '@type': 'Person', name: profile.name, email: profile.email, sameAs: url }).status, 'unsupported');
  const byId = person({ email: profile.email, '@id': url }); delete byId.url;
  assert.equal(match(byId).status, 'matched');
  assert.equal(Matcher.matchPage(profile, doc(person({ email: profile.email })), url.replace('https:', 'http:'), { now }).status, 'unsupported');
  const navigated=doc(person({email:profile.email}));navigated.URL=url.replace('p123456','p654321');
  assert.equal(Matcher.matchPage(profile,navigated,url,{now}).status,'unsupported');
});

test('only standard schema.org Person blocks and bounded graphs are extracted', () => {
  const child = person({ email: profile.email }); delete child['@context'];
  assert.equal(match({ '@context': 'https://schema.org/', '@graph': [{ '@graph': [child] }] }).status, 'matched');
  assert.equal(match({ '@context': { '@vocab': 'https://schema.org/' }, '@graph': child }).status, 'matched');
  assert.equal(match({ ...child, '@type': 'https://schema.org/Person' }).status, 'matched');
  assert.equal(match({ ...child, '@context': 'https://unrelated.example' }).status, 'unsupported');
  assert.equal(match({ ...child, '@type': 'https://schema.org/Person', '@context': 'https://unrelated.example' }).status, 'unsupported');
  assert.equal(match({ ...child, '@context': ['https://schema.org', { Person: 'https://unrelated.example' }] }).status, 'unsupported');
  assert.equal(match({ ...child, '@context': { '@vocab': 'https://schema.org', email: 'https://unrelated.example' } }).status, 'unsupported');
  assert.equal(match({ ...person({ email: profile.email }), '@type': 'Organization' }).status, 'unsupported');
  assert.equal(match({ mainEntity: person({ email: profile.email }) }).status, 'unsupported');
});

test('valid birth dates derive exact current age without future or rolled-over dates', () => {
  assert.equal(match(person({ email: profile.email, birthDate: '2006-11-05' })).status, 'matched');
  assert.equal(match(person({ email: profile.email, birthDate: '2006-11-06' })).status, 'not_matched');
  for (const birthDate of ['2006-02-30', '2027-01-01', '2006', '2006-11-05T00:00:00Z', '0000-00-00'])
    assert.equal(match(person({ email: profile.email, birthDate })).status, 'needs_identity');
  assert.equal(match(person({ email: profile.email, birthDate: '2006-11-05', age: 19 })).status, 'not_matched');
  assert.equal(match(person({ email: profile.email, birthDate: '2004-02-29' }), { ...profile, age: 21 }, { now: '2026-02-28' }).status, 'matched');
  assert.equal(match(person({ email: profile.email }), profile, { now: '2026-02-30' }).status, 'needs_identity');
});

test('extraction rejects oversized, malformed or over-deep sources without a partial match', () => {
  const valid = person({ email: profile.email });
  assert.equal(match([valid, '{not-json}']).status, 'unsupported');
  assert.equal(match([valid, JSON.stringify({ ignored: 'x'.repeat(102400) })]).status, 'unsupported');
  assert.equal(match(Array.from({ length: 21 }, () => valid)).status, 'unsupported');
  assert.equal(match({ '@context': 'https://schema.org', '@graph': Array.from({ length: 21 }, () => valid) }).status, 'unsupported');
  let deep = valid; for (let i = 0; i < 8; i++) deep = { '@graph': deep };
  assert.equal(match(deep).status, 'unsupported');
  assert.equal(match({ '@graph': Array.from({ length: 513 }, () => null) }).status, 'unsupported');
  for (const graph of ['not-a-node', 123, null, [valid, 'not-a-node']])
    assert.equal(match({ ...valid, '@graph': graph }).status, 'unsupported');
});

test('opaque extraction and results expose no raw candidate identity data', () => {
  const handle = Matcher.extractJSONLD(doc(person({ email: profile.email, telephone: profile.phone, age: profile.age })), url);
  assert.equal(JSON.stringify(handle).includes(profile.email), false);
  assert.equal(JSON.stringify(handle).includes(profile.name), false);
  assert.equal(JSON.stringify(handle).includes(profile.phone), false);
  const result = Matcher.evaluate(profile, handle, { now });
  assert.equal(result.status, 'matched');
  assert.equal(JSON.stringify(result).includes(profile.email), false);
  assert.equal(Object.isFrozen(result), true); assert.equal(Object.isFrozen(result.evidence), true);
  assert.equal(Matcher.evaluate(profile, JSON.parse(JSON.stringify(handle)), { now }).status, 'unsupported');
});

test('prototype payloads cannot introduce records, fields or corrupt ordinary objects', () => {
  const payload = JSON.parse('{"@context":"https://schema.org","@graph":[],"__proto__":{"@type":"Person","url":"' + url + '","name":"Example Person","email":"person@example.test"}}');
  assert.equal(match(payload).status, 'unsupported'); assert.equal({}.email, undefined);
  const inherited = Object.create({ name: profile.name, email: profile.email });
  assert.equal(match(person({ email: profile.email }), inherited).status, 'needs_identity');
  assert.equal(match(person({ email: profile.email, address: JSON.parse('{"__proto__":{"addressLocality":"Another City"}}') })).status, 'matched');
});
