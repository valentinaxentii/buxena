/**
 * Sauna Advisor — the recommendation must never contradict itself.
 *
 * WHY THIS EXISTS
 * ---------------
 * On 2026-08-13 the founder opened the advisor, answered "3–4 people", and the
 * BEST MATCH was "EDA Thermowood 1.3m — 2–3 people", with copy reading
 * "Recommended because you selected outdoor use, seating for 3–4 people".
 *
 * Two defects combined:
 *   1. `'3-4'` was encoded as `minSeats: 3`, so the bar was "seats at least 3"
 *      and a 2–3 model cleared it.
 *   2. Candidates were sorted by capacity ASCENDING, so whichever model
 *      scraped over the bar was ranked first. The weakest qualifying sauna was
 *      structurally guaranteed to be "Best Match".
 *
 * And the explanation was built from the visitor's ANSWERS rather than from the
 * model, so it confidently asserted a fit that had never been checked.
 *
 * These tests run against the REAL catalogue, not fixtures, so a future content
 * edit that reintroduces the contradiction fails here rather than in a
 * customer's browser.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  recommendSaunas,
  CAPACITY_OPTIONS,
  FORM_OPTIONS,
  type CatalogModel,
  type PlanAnswers,
} from '../src/data/planYourSauna.ts';

const CONTENT = fileURLToPath(new URL('../src/content/saunas/', import.meta.url));

/**
 * Minimal frontmatter reader.
 *
 * Comment lines are skipped explicitly. The image-rights audit left
 * `# src: removed …` inside several heroImage blocks, and a naive scan treats
 * that commented line as a real value — which is exactly how an earlier check
 * of mine reported "0 models missing images" while sixteen were.
 */
function readModels(): CatalogModel[] {
  return readdirSync(CONTENT)
    .filter((f) => f.endsWith('.md'))
    .map((file) => {
      const raw = readFileSync(join(CONTENT, file), 'utf8');
      const fm = raw.split('---')[1] ?? '';
      const scalar = (key: string) => {
        const m = fm.match(new RegExp(`^${key}:\\s*(.+)$`, 'm'));
        return m ? m[1].trim().replace(/^["']|["']$/g, '') : undefined;
      };
      const num = (key: string) => {
        const v = scalar(key);
        return v == null ? undefined : Number(v);
      };

      let heroSrc: string | undefined;
      let heroAlt = '';
      let inHero = false;
      for (const line of fm.split(/\r?\n/)) {
        if (/^heroImage:/.test(line)) { inHero = true; continue; }
        if (inHero && /^[A-Za-z]/.test(line)) inHero = false;
        if (!inHero) continue;
        const t = line.trim();
        if (t.startsWith('#')) continue; // a commented-out src is not an src
        const s = t.match(/^src:\s*(.+)$/);
        if (s) heroSrc = s[1].replace(/^["']|["']$/g, '');
        const a = t.match(/^alt:\s*(.+)$/);
        if (a) heroAlt = a[1].replace(/^["']|["']$/g, '');
      }

      return {
        slug: file.replace(/\.md$/, ''),
        title: scalar('title') ?? file,
        tagline: scalar('tagline') ?? '',
        location: scalar('location') as 'indoor' | 'outdoor' | undefined,
        productType: scalar('productType'),
        series: scalar('series'),
        capacity: scalar('capacity'),
        capacityMin: num('capacityMin'),
        capacityMax: num('capacityMax'),
        heroImage: { src: heroSrc, alt: heroAlt },
        order: num('order') ?? 999,
      } satisfies CatalogModel;
    })
    .filter((m) => !/^draft:\s*true/m.test(readFileSync(join(CONTENT, `${m.slug}.md`), 'utf8')));
}

const CATALOG = readModels();

const answers = (over: Partial<PlanAnswers> = {}): PlanAnswers => ({
  location: 'outdoor',
  capacity: 'unsure',
  form: 'no-preference',
  glass: 'no-preference',
  heat: 'unsure',
  install: 'unsure',
  zip: '',
  ...over,
});

/** Seats the visitor actually needs for a given answer value. */
const needed = (value: string) =>
  CAPACITY_OPTIONS.find((c) => c.value === value)!.seatsNeeded;

test('the catalogue itself loaded (guards a silently-empty test)', () => {
  assert.ok(CATALOG.length >= 30, `expected the real catalogue, got ${CATALOG.length} models`);
  assert.ok(CATALOG.some((m) => m.slug === 'eda-thermowood-1-3m'), 'the regression model is missing');
});

// ---------------------------------------------------------------------------
// The exact reported defect
// ---------------------------------------------------------------------------
test('REGRESSION: a 2–3 model is never Best Match for a 3–4 answer', () => {
  const recs = recommendSaunas(CATALOG, answers({ capacity: '3-4' }));
  assert.ok(recs.length > 0, 'expected recommendations');

  const top = recs[0];
  assert.equal(top.label, 'Best Match');
  assert.notEqual(top.model.slug, 'eda-thermowood-1-3m');
  assert.ok(
    (top.model.capacityMax ?? 0) >= needed('3-4'),
    `Best Match ${top.model.slug} seats ${top.model.capacityMax}, needs ${needed('3-4')}`
  );
});

test('REGRESSION: the explanation never claims a capacity the model lacks', () => {
  for (const value of ['1-2', '3-4', '5-6', '7+']) {
    const recs = recommendSaunas(CATALOG, answers({ capacity: value }));
    for (const rec of recs) {
      const claimsSeating = rec.matches.some((m) => m.startsWith('Seats'));
      if (claimsSeating) {
        assert.ok(
          (rec.model.capacityMax ?? 0) >= needed(value),
          `${rec.model.slug} ticks "Seats" for ${value} but seats only ${rec.model.capacityMax}`
        );
        assert.equal(rec.meetsAllHard, true);
      } else {
        // No tick means it must be disclosed as a trade-off, not left silent.
        assert.ok(
          rec.tradeOffs.length > 0,
          `${rec.model.slug} neither confirms nor discloses its capacity for ${value}`
        );
      }
    }
  }
});

// ---------------------------------------------------------------------------
// Personas A–E from the brief
// ---------------------------------------------------------------------------
/**
 * `mustSeat` is a LITERAL, deliberately not derived from CAPACITY_OPTIONS.
 *
 * An earlier version of this table asserted against `needed(answer)`, which
 * reads the same constant the capacity bug lived in. Restoring the defect moved
 * the expectation with it and every persona still passed — the test agreed with
 * the bug. A test may not import its expected value from the code under test.
 */
const PERSONAS: Array<{ name: string; a: PlanAnswers; perfectExpected: boolean; mustSeat: number }> = [
  { name: 'A — outdoor, 2 people', a: answers({ location: 'outdoor', capacity: '1-2' }), perfectExpected: true, mustSeat: 2 },
  { name: 'B — outdoor, 3–4 people', a: answers({ location: 'outdoor', capacity: '3-4' }), perfectExpected: true, mustSeat: 4 },
  { name: 'C — outdoor, 5–6 people', a: answers({ location: 'outdoor', capacity: '5-6' }), perfectExpected: true, mustSeat: 6 },
  { name: 'D — indoor, 2 people', a: answers({ location: 'indoor', capacity: '1-2' }), perfectExpected: true, mustSeat: 2 },
  // Indoor tops out well below seven, so nothing can satisfy this. The UI must
  // say so rather than pretend.
  { name: 'E — indoor, 7+ people (no perfect model exists)', a: answers({ location: 'indoor', capacity: '7+' }), perfectExpected: false, mustSeat: 7 },
];

for (const p of PERSONAS) {
  test(`persona ${p.name}`, () => {
    const recs = recommendSaunas(CATALOG, p.a);
    assert.ok(recs.length > 0, 'every persona must get an answer, never a dead end');

    // Placement is strict: it is never traded away.
    for (const r of recs) {
      assert.equal(
        r.model.location,
        p.a.location,
        `${r.model.slug} is ${r.model.location} but the visitor asked for ${p.a.location}`
      );
    }

    if (p.perfectExpected) {
      assert.equal(recs[0].label, 'Best Match');
      assert.equal(recs[0].meetsAllHard, true);
      assert.equal(recs[0].tradeOffs.length, 0, 'a Best Match must carry no trade-off');
      assert.ok(
        (recs[0].model.capacityMax ?? 0) >= p.mustSeat,
        `Best Match ${recs[0].model.slug} seats ${recs[0].model.capacityMax}, must seat ${p.mustSeat}`
      );
      // The constant must agree with the literal, so a future edit to
      // CAPACITY_OPTIONS that reintroduces the off-by-a-range fails here.
      assert.equal(needed(p.a.capacity), p.mustSeat, `seatsNeeded for "${p.a.capacity}" drifted`);
    } else {
      assert.equal(recs[0].label, 'Closest Match', 'must not claim "Best Match" when nothing qualifies');
      assert.equal(recs[0].meetsAllHard, false);
      assert.ok(recs[0].tradeOffs.length > 0, 'a compromise must be stated, not hidden');
    }

    // Every recommendation must be able to explain itself.
    for (const r of recs) {
      assert.ok(
        r.matches.length + r.tradeOffs.length > 0,
        `${r.model.slug} produced no explanation at all`
      );
    }
  });
}

// ---------------------------------------------------------------------------
// Hard vs soft
// ---------------------------------------------------------------------------
test('a soft shape preference never outranks a hard capacity requirement', () => {
  // Ask for a barrel AND six seats. Any barrel too small must lose to a model
  // that actually seats six, whatever its shape.
  const recs = recommendSaunas(CATALOG, answers({ capacity: '5-6', form: 'Barrel' }));
  assert.equal(recs[0].meetsAllHard, true);
  assert.ok((recs[0].model.capacityMax ?? 0) >= 6);
});

test('a soft shape preference is honoured when capacity is equal', () => {
  const recs = recommendSaunas(CATALOG, answers({ capacity: '3-4', form: 'Cube' }));
  // A qualifying cube exists (UKU 160 seats 3–4), so the preference should win.
  assert.equal(recs[0].model.productType, 'Cube');
  assert.ok(recs[0].matches.includes('Cube design'));
});

test('shape is a preference, not a filter — a mismatch is disclosed, not hidden', () => {
  const recs = recommendSaunas(CATALOG, answers({ capacity: '3-4', form: 'Cube' }));
  for (const r of recs) {
    if (r.model.productType !== 'Cube') {
      assert.ok(
        r.tradeOffs.some((t) => t.includes('rather than')),
        `${r.model.slug} is not a Cube but says nothing about it`
      );
    }
  }
});

test('every form option offered is a productType that really exists', () => {
  const real = new Set(CATALOG.map((m) => m.productType));
  for (const opt of FORM_OPTIONS) {
    if (opt.value === 'no-preference') continue;
    assert.ok(real.has(opt.value), `form option "${opt.value}" matches no model in the catalogue`);
  }
});

test('every real productType is offerable (no model is unreachable)', () => {
  const offered = new Set(FORM_OPTIONS.map((o) => o.value));
  for (const type of new Set(CATALOG.map((m) => m.productType))) {
    if (!type) continue;
    assert.ok(offered.has(type), `productType "${type}" exists but cannot be chosen in the wizard`);
  }
});

test('unverified capacity is treated as a miss, never as a pass', () => {
  const unknown: CatalogModel = {
    slug: 'no-capacity', title: 'Test', tagline: '', location: 'outdoor',
    productType: 'Barrel', capacityMax: undefined, order: 1,
  };
  const recs = recommendSaunas([unknown], answers({ capacity: '3-4' }));
  assert.equal(recs[0].meetsAllHard, false);
  assert.equal(recs[0].label, 'Closest Match');
  assert.ok(recs[0].tradeOffs.some((t) => /not yet published/i.test(t)));
  assert.ok(!recs[0].matches.some((m) => m.startsWith('Seats')), 'must not claim seating it does not have');
});

test('"not sure" about capacity filters nothing out', () => {
  const recs = recommendSaunas(CATALOG, answers({ capacity: 'unsure' }));
  assert.ok(recs.length > 0);
  assert.equal(recs[0].label, 'Best Match');
  assert.equal(recs[0].meetsAllHard, true);
});

test('results are deterministic for identical answers', () => {
  const a = recommendSaunas(CATALOG, answers({ capacity: '3-4' })).map((r) => r.model.slug);
  const b = recommendSaunas(CATALOG, answers({ capacity: '3-4' })).map((r) => r.model.slug);
  assert.deepEqual(a, b);
});

test('at most three recommendations, each a distinct model', () => {
  for (const value of ['1-2', '3-4', '5-6', '7+', 'unsure']) {
    const recs = recommendSaunas(CATALOG, answers({ capacity: value }));
    assert.ok(recs.length <= 3);
    assert.equal(new Set(recs.map((r) => r.model.slug)).size, recs.length);
  }
});
