/**
 * Heater facts, read back out of what the catalogue actually states.
 *
 * WHAT THIS IS NOT
 * ----------------
 * It is not a heater catalogue. BUXENA holds no heater SKUs: `products` has an
 * empty `heater_options` column on every row, there is no heater table, and no
 * heater has an approved price. A brand/model/kW/price comparison grid — the
 * obvious thing to build here — could only be produced by inventing it, so it
 * is not built.
 *
 * WHAT IT IS
 * ----------
 * Fifteen published models DO carry verified, model-specific heater statements
 * in their frontmatter, written from supplier product sheets. Those statements
 * answer the question a non-expert customer actually has — "what heater can go
 * in THIS sauna, and is one included?" — and this parses them into structure so
 * the site can compare them honestly.
 *
 * PARSING RULES, ALL CONSERVATIVE
 *   - Nothing is inferred. Electric-only is recorded only where the text says
 *     wood-burning is not compatible; silence means unknown, never "no".
 *   - `stonesIncluded` is set only where the text says stones are included or
 *     standard. Absent stays null, which renders as nothing at all.
 *   - A model with no heaterOptions (all sixteen EDA barrels) returns a record
 *     whose every field is null. It is shown as "confirmed with your quote",
 *     not as a limitation of the sauna.
 *   - The original sentence is always kept in `statements`, so a customer and a
 *     salesperson can read the source wording rather than trusting this parse.
 */

export type HeaterFuel = 'electric' | 'wood' | 'either';

export interface HeaterFacts {
  /** Fuels the catalogue confirms for this model. Empty = not stated. */
  fuels: HeaterFuel[];
  /** True only where the text explicitly rules wood-burning out. */
  woodExplicitlyIncompatible: boolean;
  /** Confirmed output range, e.g. "3.5–4.5 kW". Null when not stated. */
  kwRange: string | null;
  /** Brands named for this model, in the order stated. */
  brands: string[];
  /** True only where stones are stated as included/standard. Null = not stated. */
  stonesIncluded: boolean | null;
  /** True only where app/Wi-Fi control is stated. Null = not stated. */
  appControl: boolean | null;
  /** True only where a heater is stated as included/standard with the sauna. */
  heaterIncluded: boolean | null;
  /** The catalogue's own sentences, verbatim. Always safe to display. */
  statements: string[];
  /** Nothing at all is stated for this model. */
  unknown: boolean;
}

const KNOWN_BRANDS = ['Harvia', 'HUUM', 'Cozy', 'Narvi'];

/** Ranges are written with an en dash in the catalogue; accept a hyphen too. */
const KW_RANGE = /(\d+(?:\.\d+)?\s*[–-]\s*\d+(?:\.\d+)?\s*kW)/i;
const KW_SINGLE = /(\d+(?:\.\d+)?\s*kW)/i;

export function readHeaterFacts(heaterOptions: string[] | undefined | null): HeaterFacts {
  const statements = (heaterOptions ?? []).map((s) => String(s).trim()).filter(Boolean);

  if (statements.length === 0) {
    return {
      fuels: [],
      woodExplicitlyIncompatible: false,
      kwRange: null,
      brands: [],
      stonesIncluded: null,
      appControl: null,
      heaterIncluded: null,
      statements: [],
      unknown: true,
    };
  }

  const all = statements.join(' | ');
  const lower = all.toLowerCase();

  const woodExplicitlyIncompatible = /wood[- ]burning not compatible/i.test(all);

  const fuels: HeaterFuel[] = [];
  const mentionsElectric = /electric/i.test(all);
  const mentionsWood = /wood[- ]burning|wood[- ]fired|wood stove/i.test(all);
  if (mentionsElectric) fuels.push('electric');
  // "wood-burning not compatible" mentions wood in order to exclude it.
  if (mentionsWood && !woodExplicitlyIncompatible) fuels.push('wood');

  const kwRange = (all.match(KW_RANGE)?.[1] ?? all.match(KW_SINGLE)?.[1] ?? null)?.replace(/\s+/g, ' ') ?? null;

  const brands = KNOWN_BRANDS.filter((b) => new RegExp(`\\b${b}\\b`, 'i').test(all));

  // Only an explicit statement counts. "with stones" alone is enough; absence
  // is recorded as unknown, never as "stones not included".
  const stonesIncluded = /with (?:olivine diabase )?stones|stones \(standard\)|stones — included/i.test(all)
    ? true
    : null;

  const appControl = /wi-?fi|app control/i.test(lower) ? true : null;

  const heaterIncluded = /included as standard|\(standard\)/i.test(all) ? true : null;

  return {
    fuels,
    woodExplicitlyIncompatible,
    kwRange,
    brands,
    stonesIncluded,
    appControl,
    heaterIncluded,
    statements,
    unknown: false,
  };
}

/**
 * One short, honest line for a card or a comparison cell.
 *
 * Never says "no heater" or implies a limitation — a model we hold no heater
 * data for is a gap in our data, not a fact about the sauna.
 */
export function heaterSummary(facts: HeaterFacts): string {
  if (facts.unknown) return 'Confirmed with your quote';

  const parts: string[] = [];
  if (facts.fuels.includes('electric') && facts.fuels.includes('wood')) parts.push('Electric or wood-burning');
  else if (facts.fuels.includes('electric')) parts.push('Electric');
  else if (facts.fuels.includes('wood')) parts.push('Wood-burning');

  if (facts.kwRange) parts.push(facts.kwRange);
  if (facts.heaterIncluded) parts.push('heater included');
  if (facts.appControl) parts.push('app control');

  return parts.length ? parts.join(' · ') : 'Confirmed with your quote';
}

/**
 * How a heater sits in a quote. Mirrors the proposal's fulfilment states so a
 * customer is never left inferring whether they are paying for one.
 *
 * `unset` renders nothing. Silence is correct until a salesperson decides, and
 * far safer than a default a customer reads as "included".
 */
export type HeaterInclusion = 'unset' | 'included' | 'optional' | 'separate' | 'not-selected';

export const HEATER_INCLUSION_LABELS: Record<Exclude<HeaterInclusion, 'unset'>, string> = {
  included: 'Included in this package',
  optional: 'Optional — not yet added',
  separate: 'Quoted separately',
  'not-selected': 'Not selected',
};

export function readHeaterInclusion(value: unknown): HeaterInclusion {
  const v = String(value ?? '').trim().toLowerCase();
  return v === 'included' || v === 'optional' || v === 'separate' || v === 'not-selected' ? v : 'unset';
}
