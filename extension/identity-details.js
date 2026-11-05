/* One-action identity details. Callers must keep the returned values out of storage. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.EraseIdentityDetails = api;
})(typeof globalThis === 'object' ? globalThis : this, function () {
  'use strict';
  const CONTRACTS = Object.freeze({ fastpeoplesearch: Object.freeze({
    id: 'fastpeoplesearch-final-2026-11-05-v1',
    warningText: 'Please review the information above to ensure it is accurate. You will not be able to modify the information once you click submit.',
    consentText: 'I certify that I am the person (or an authorized agent of the person) to whom this information pertains. I confirm the information above is accurate.',
    additionalRequirementText: 'The current form marks date of birth, street address and phone as required, despite its wording that date of birth or street address is enough. Review all requested fields before approving, or cancel and review the official form yourself.'
  }) });
  const STATE = /^(AL|AK|AZ|AR|CA|CO|CT|DE|DC|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY|AA|AE|AP|AS|FM|GU|MH|MP|PR|PW|VI)$/;
  class IdentityDetailError extends Error {}
  const fail = message => { throw new IdentityDetailError(message); };
  function plainText(value, maximum, message) {
    if (typeof value !== 'string' || value.length > maximum + 32 || /[\x00-\x1f\x7f<>]/.test(value)) fail(message);
    const cleaned = value.trim().replace(/\s+/g, ' ');
    if (!cleaned || cleaned.length > maximum) fail(message);
    return cleaned;
  }
  function birthDate(value, now) {
    const message = 'Enter an accurate full date of birth for a person aged 18 to 120.';
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) fail(message);
    const [year, month, day] = value.split('-').map(Number), date = new Date(Date.UTC(year, month - 1, day));
    if (year < 1000 || date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) fail(message);
    const current = new Date(now === undefined ? Date.now() : now);
    if (!Number.isFinite(current.getTime())) fail('The current date is unavailable. Refresh before reviewing these details.');
    let age = current.getUTCFullYear() - year;
    if (current.getUTCMonth() + 1 < month || current.getUTCMonth() + 1 === month && current.getUTCDate() < day) age--;
    if (age < 18 || age > 120) fail(message);
    return value;
  }
  function validateRequirements(value) {
    try {
      const keys = ['date_of_birth', 'street_address', 'phone', 'no_validate', 'submit_no_validate'];
      if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).length !== keys.length ||
          !keys.every(key => Object.hasOwn(value, key) && typeof value[key] === 'boolean'))
        fail('The broker’s required fields could not be verified. Review the existing form before continuing.');
      return Object.fromEntries(keys.map(key => [key, value[key]]));
    } catch (error) {
      if (error instanceof IdentityDetailError) throw error;
      throw new IdentityDetailError('The broker’s required fields could not be verified. Review the existing form before continuing.');
    }
  }
  function usPhone(value) {
    const message = 'Enter your accurate US phone number with ten digits or a leading country code of 1.';
    if (typeof value !== 'string' || value.length > 40 || !/^\+?[0-9 ().-]+$/.test(value.trim())) fail(message);
    let digits = value.replace(/\D/g, '');
    if (digits.length === 11 && digits[0] === '1') digits = digits.slice(1);
    if (!/^[0-9]{10}$/.test(digits)) fail(message);
    return '(' + digits.slice(0, 3) + ') ' + digits.slice(3, 6) + '-' + digits.slice(6);
  }
  function validate(details, options = {}) {
    try {
      if (!details || typeof details !== 'object' || Array.isArray(details)) fail('Choose the information required for this broker form.');
      const method = details.method;
      if (!['date_of_birth', 'street_address', 'full_matching_details'].includes(method)) fail('Choose the supported identity information required by this form.');
      const requirements = options.requirements === undefined ? null : validateRequirements(options.requirements);
      const nativeValidation = requirements && !requirements.no_validate && !requirements.submit_no_validate;
      const full = method === 'full_matching_details';
      if (full && !(nativeValidation && requirements.date_of_birth && requirements.street_address && requirements.phone))
        fail('The form has not established a need for all these identity fields. Review its requirements before continuing.');
      const identityKey = method === 'date_of_birth' ? 'date_of_birth' : 'street_address';
      const keys = full ? ['method', 'date_of_birth', 'street_address', 'phone', 'city', 'state', 'zip_code'] : ['method', identityKey, 'city', 'state', 'zip_code'];
      if (Object.keys(details).length !== keys.length || !keys.every(key => Object.hasOwn(details, key)))
        fail('Provide only the selected identity detail, city, state and ZIP.');
      const city = plainText(details.city, 120, 'Enter your accurate current city.');
      const state = plainText(details.state, 2, 'Use a US state abbreviation.').toUpperCase();
      const zip = plainText(details.zip_code, 5, 'Use your accurate five-digit ZIP code.');
      if (!STATE.test(state)) fail('Use a US state abbreviation.');
      if (!/^[0-9]{5}$/.test(zip)) fail('Use your accurate five-digit ZIP code.');
      if (nativeValidation && (requirements.date_of_birth && method !== 'date_of_birth' && !full ||
          requirements.street_address && method !== 'street_address' && !full || requirements.phone && !full))
        fail('The selected information does not satisfy the broker’s required fields. Review the form’s requirements before continuing.');
      if (full) return { method, date_of_birth: birthDate(details.date_of_birth, options.now),
        street_address: plainText(details.street_address, 200, 'Enter your accurate current street address.'),
        phone: usPhone(details.phone), city, state, zip_code: zip };
      const identity = method === 'date_of_birth' ? birthDate(details.date_of_birth, options.now) : plainText(details.street_address, 200, 'Enter your accurate current street address.');
      return { method, [identityKey]: identity, city, state, zip_code: zip };
    } catch (error) {
      if (error instanceof IdentityDetailError) throw error;
      throw new IdentityDetailError('These identity details could not be validated. Review the selected fields.');
    }
  }
  return Object.freeze({ CONTRACTS, validate, validateRequirements, IdentityDetailError });
});
