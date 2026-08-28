import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (path: string) => fs.readFileSync(path, 'utf8');

test('primary navigation exposes the commercial buying paths', () => {
  const site = read('src/data/site.ts');
  for (const href of ['/saunas/', '/plan-your-sauna/', '/heaters/', '/accessories/', '/resources/']) {
    assert.match(site, new RegExp(`href: '${href.replaceAll('/', '\\/')}'`));
  }
});

test('resources center only links to routes that exist in the project', () => {
  const page = read('src/pages/resources.astro');
  const expected = [
    'src/pages/plan-your-sauna.astro',
    'src/pages/compare.astro',
    'src/pages/saunas/index.astro',
    'src/pages/see-it-in-my-space.astro',
    'src/pages/heaters.astro',
    'src/pages/heater-guide.astro',
    'src/pages/accessories.astro',
    'src/pages/how-buying-works.astro',
    'src/pages/faq.astro',
    'src/pages/consultation.astro',
    'src/pages/for-trade.astro',
    'src/pages/quote.astro',
  ];
  for (const path of expected) assert.ok(fs.existsSync(path), `missing route source: ${path}`);
  assert.match(page, /Get Project Pricing/);
});

test('commercial pages do not expose supplier cost fields', () => {
  const publicSources = [
    read('src/pages/heaters.astro'),
    read('src/pages/accessories.astro'),
    read('src/pages/resources.astro'),
    read('src/data/heater-systems.ts'),
  ].join('\n');
  assert.doesNotMatch(publicSources, /FCA\s*\$|EXW\s*\$|dealer cost|landed cost|margin target/i);
});
