import test from 'node:test';
import assert from 'node:assert/strict';
import { sessionAttribution } from '../src/lib/enquiry-attribution.ts';

function memoryStorage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
    removeItem: (key: string) => { values.delete(key); },
  };
}

test('a campaign survives catalogue and model navigation before the quote', () => {
  const storage = memoryStorage();
  const first = sessionAttribution({ url: 'https://buxena.com/saunas/?utm_source=google&utm_campaign=outdoor', referrer: 'https://www.google.com/search?q=private', storage, now: 1 });
  sessionAttribution({ url: 'https://buxena.com/saunas/bux-uku-160/', storage, now: 100 });
  const quote = sessionAttribution({ url: 'https://buxena.com/quote/?model=BUH-UKU', referrer: 'https://buxena.com/saunas/bux-uku-160/', storage, now: 200 });
  assert.deepEqual(quote, first);
  assert.equal(quote.utmCampaign, 'outdoor');
  assert.equal(quote.referrerHost, 'www.google.com');
  assert.equal(quote.landingPath, '/saunas/');
});

test('arbitrary URL fields, fragments, click IDs and full referrer URLs are excluded', () => {
  const context = sessionAttribution({ url: 'https://buxena.com/quote/?email=private@example.com&gclid=123&utm_source=search#contact', referrer: 'https://example.com/private?name=person' });
  assert.deepEqual(context, { landingPath: '/quote/', referrerHost: 'example.com', utmSource: 'search' });
  assert.equal(sessionAttribution({ url: 'https://buxena.com/quote/', referrer: 'https://buxena.com/saunas/' }).referrerHost, undefined);
});

test('expired context does not credit an old campaign to a later inquiry', () => {
  const storage = memoryStorage();
  sessionAttribution({ url: 'https://buxena.com/?utm_source=old', storage, now: 0 });
  const context = sessionAttribution({ url: 'https://buxena.com/quote/', storage, now: 30 * 60 * 1000 });
  assert.deepEqual(context, { landingPath: '/quote/' });
});

test('restricted or corrupt storage cannot stop an inquiry', () => {
  const blocked = {
    getItem: () => { throw new Error('blocked'); },
    setItem: () => { throw new Error('blocked'); },
    removeItem: () => { throw new Error('blocked'); },
  };
  assert.equal(sessionAttribution({ url: 'https://buxena.com/quote/?utm_source=current', storage: blocked }).utmSource, 'current');
  const broken = { ...memoryStorage(), getItem: () => '{invalid' };
  assert.deepEqual(sessionAttribution({ url: 'https://buxena.com/quote/', storage: broken }), { landingPath: '/quote/' });
});

test('a privacy opt-out clears attribution and prevents collection', () => {
  const storage = memoryStorage();
  sessionAttribution({ url: 'https://buxena.com/?utm_source=old', storage });
  assert.deepEqual(sessionAttribution({ url: 'https://buxena.com/quote/?utm_source=new', storage, optOut: true }), {});
  assert.deepEqual(sessionAttribution({ url: 'https://buxena.com/quote/', storage }), { landingPath: '/quote/' });
});
