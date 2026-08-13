/**
 * Alternative models must be relevant and must explain themselves.
 *
 * The product page previously showed `filter(same category).slice(0, 3)` — the
 * first three siblings in catalogue order, unrelated to the model being viewed
 * and unexplained. These tests run against the REAL catalogue so a content edit
 * that breaks relevance fails here rather than on a product page.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { relatedModels, type RelatedCandidate } from '../src/lib/related-models.ts';

const CONTENT = fileURLToPath(new URL('../src/content/saunas/', import.meta.url));

function readCatalog(): RelatedCandidate[] {
  return readdirSync(CONTENT)
    .filter((f) => f.endsWith('.md'))
    .map((file) => {
      const fm = readFileSync(join(CONTENT, file), 'utf8').split('---')[1] ?? '';
      const s = (k: string) => {
        const m = fm.match(new RegExp(`^${k}:\\s*(.+)$`, 'm'));
        return m ? m[1].trim().replace(/^["']|["']$/g, '') : undefined;
      };
      const n = (k: string) => {
        const v = s(k);
        return v == null ? undefined : Number(v);
      };
      return {
        slug: file.replace(/\.md$/, ''),
        title: s('title') ?? file,
        location: s('location') as 'indoor' | 'outdoor' | undefined,
        productType: s('productType'),
        series: s('series'),
        category: s('category'),
        capacityMin: n('capacityMin'),
        capacityMax: n('capacityMax'),
        order: n('order') ?? 999,
      } satisfies RelatedCandidate;
    })
    .filter((m) => !/^draft:\s*true/m.test(readFileSync(join(CONTENT, `${m.slug}.md`), 'utf8')));
}

const CATALOG = readCatalog();

test('the real catalogue loaded', () => {
  assert.ok(CATALOG.length >= 30, `got ${CATALOG.length}`);
});

test('every model gets alternatives, and never itself', () => {
  for (const m of CATALOG) {
    const rel = relatedModels(m, CATALOG);
    assert.ok(rel.length > 0, `${m.slug} produced no alternatives`);
    assert.ok(rel.length <= 3);
    assert.ok(!rel.some((r) => r.model.slug === m.slug), `${m.slug} recommended itself`);
    assert.equal(new Set(rel.map((r) => r.model.slug)).size, rel.length, `${m.slug} has duplicates`);
  }
});

test('placement is never traded away — an indoor model is not an outdoor alternative', () => {
  for (const m of CATALOG) {
    if (!m.location) continue;
    for (const r of relatedModels(m, CATALOG)) {
      if (!r.model.location) continue;
      assert.equal(
        r.model.location,
        m.location,
        `${m.slug} (${m.location}) was offered ${r.model.slug} (${r.model.location})`
      );
    }
  }
});

test('every alternative carries a reason', () => {
  for (const m of CATALOG) {
    for (const r of relatedModels(m, CATALOG)) {
      assert.ok(r.reason && r.reason.trim().length > 0, `${r.model.slug} has no reason`);
    }
  }
});

test('the reason never contradicts the capacity data', () => {
  const mid = (x: RelatedCandidate) => {
    if (x.capacityMin == null && x.capacityMax == null) return null;
    if (x.capacityMin == null) return x.capacityMax!;
    if (x.capacityMax == null) return x.capacityMin;
    return (x.capacityMin + x.capacityMax) / 2;
  };
  for (const m of CATALOG) {
    const a = mid(m);
    if (a == null) continue;
    for (const r of relatedModels(m, CATALOG)) {
      const b = mid(r.model);
      if (b == null) continue;
      if (r.reason.startsWith('More spacious')) {
        assert.ok(b > a, `${r.model.slug} labelled "More spacious" but seats ${b} vs ${a}`);
      }
      if (r.reason.startsWith('More compact')) {
        assert.ok(b < a, `${r.model.slug} labelled "More compact" but seats ${b} vs ${a}`);
      }
      if (r.reason.startsWith('Similar capacity')) {
        assert.equal(b, a, `${r.model.slug} labelled "Similar capacity" but seats ${b} vs ${a}`);
      }
    }
  }
});

test('both directions are offered when both exist', () => {
  // A mid-sized outdoor model has both smaller and larger siblings, so the
  // shortlist must answer "bigger?" and "smaller?" rather than three of a size.
  const target = CATALOG.find((m) => m.slug === 'eda-thermowood-2-5m');
  assert.ok(target, 'fixture model missing from catalogue');
  const rel = relatedModels(target!, CATALOG);
  const reasons = rel.map((r) => r.reason).join(' | ');
  assert.ok(
    rel.some((r) => r.reason.startsWith('More compact')),
    `no smaller option offered — got: ${reasons}`
  );
  assert.ok(
    rel.some((r) => r.reason.startsWith('More spacious')),
    `no larger option offered — got: ${reasons}`
  );
});

test('results are deterministic', () => {
  const m = CATALOG[0];
  const a = relatedModels(m, CATALOG).map((r) => r.model.slug + ':' + r.reason);
  const b = relatedModels(m, CATALOG).map((r) => r.model.slug + ':' + r.reason);
  assert.deepEqual(a, b);
});

test('a model with no capacity data still gets sensible alternatives', () => {
  const orphan: RelatedCandidate = {
    slug: 'no-capacity-model', title: 'Test', location: 'outdoor', productType: 'Barrel', order: 1,
  };
  const rel = relatedModels(orphan, CATALOG);
  assert.ok(rel.length > 0);
  for (const r of rel) assert.equal(r.model.location, 'outdoor');
});
