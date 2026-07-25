/**
 * Plan Your Sauna — question definitions + recommendation scoring.
 *
 * Steps 1–3 and 6–7 use verified catalog fields (location, capacity,
 * productType) as hard filters. Steps 4–5 (glass, heater) are collected
 * as preference/information only — no model currently has verified,
 * differentiating glazing or heater-compatibility data, so those answers
 * never filter, score, or appear in the "why it matches" explanation.
 * They ARE stored with the shortlist/quote request for BUXENA to review
 * manually. See README/content.config.ts if that data becomes available —
 * at that point PREFERENCE-ONLY steps below can graduate to real filters.
 */

export interface CapacityOption {
  value: string;
  label: string;
  minSeats: number; // 0 = no filter ("not sure")
}

export const CAPACITY_OPTIONS: CapacityOption[] = [
  { value: '1-2', label: '1–2', minSeats: 1 },
  { value: '3-4', label: '3–4', minSeats: 3 },
  { value: '5-6', label: '5–6', minSeats: 5 },
  { value: '7+', label: '7+', minSeats: 7 },
  { value: 'unsure', label: 'Not sure', minSeats: 0 },
];

export const LOCATION_OPTIONS = [
  { value: 'outdoor', label: 'Outdoors' },
  { value: 'indoor', label: 'Indoors' },
  { value: 'unsure', label: 'Not sure yet' },
];

// Only real catalog productType values (verified via content.config.ts data:
// every model is currently either "Barrel" or "Oval" — no Cube, Panoramic
// or Traditional-cabin product exists yet, so those are not offered here).
export const FORM_OPTIONS = [
  { value: 'Barrel', label: 'Barrel' },
  { value: 'Oval', label: 'Rounded / architectural (Oval)' },
  { value: 'no-preference', label: 'No preference' },
];

// Preference-only — never used to filter or score. See file header.
export const GLASS_OPTIONS = [
  { value: 'private', label: 'More private' },
  { value: 'glass-front', label: 'Glass front' },
  { value: 'panoramic', label: 'Panoramic / more glass' },
  { value: 'no-preference', label: 'No preference' },
];

// Preference-only — never used to filter or score. See file header.
export const HEAT_OPTIONS = [
  { value: 'electric', label: 'Electric' },
  { value: 'wood', label: 'Wood-burning' },
  { value: 'smart', label: 'Smart / remote control preferred' },
  { value: 'unsure', label: 'Not sure' },
];

export const INSTALL_OPTIONS = [
  { value: 'quote', label: 'I would like BUXENA to quote installation' },
  { value: 'own-contractor', label: 'I have my own contractor' },
  { value: 'unsure', label: 'I am not sure yet' },
];

export interface PlanAnswers {
  location: string;
  capacity: string;
  form: string;
  glass: string;
  heat: string;
  install: string;
  zip: string;
}

/** Lean, build-time-safe shape of a catalog model — only fields the wizard needs. */
export interface CatalogModel {
  slug: string;
  title: string;
  tagline: string;
  location?: 'outdoor' | 'indoor';
  productType?: string;
  capacity?: string;
  capacityMin?: number;
  capacityMax?: number;
  materials?: string[];
  dimensions?: { label: string; value: string }[];
  heroImage?: { src?: string; alt: string };
  order: number;
}

export interface Recommendation {
  model: CatalogModel;
  why: string[];
}

/**
 * Hard-filters on location, capacity and form (all verified fields).
 * Glass/heater answers are intentionally ignored here — see file header.
 */
export function recommendSaunas(catalog: CatalogModel[], answers: PlanAnswers): Recommendation[] {
  const capacityOpt = CAPACITY_OPTIONS.find((c) => c.value === answers.capacity);
  const minSeats = capacityOpt?.minSeats ?? 0;

  const candidates = catalog.filter((m) => {
    if (answers.location !== 'unsure' && m.location !== answers.location) return false;
    if (answers.form !== 'no-preference' && m.productType !== answers.form) return false;
    if (minSeats > 0) {
      if (m.capacityMax == null) return false; // unverified capacity — exclude rather than guess
      if (m.capacityMax < minSeats) return false;
    }
    return true;
  });

  candidates.sort((a, b) => {
    const aMax = a.capacityMax ?? Infinity;
    const bMax = b.capacityMax ?? Infinity;
    if (aMax !== bMax) return aMax - bMax;
    return (a.order ?? 999) - (b.order ?? 999);
  });

  const top = candidates.slice(0, 3);

  return top.map((model) => {
    const why: string[] = [];
    if (answers.location !== 'unsure') {
      why.push(answers.location === 'outdoor' ? 'outdoor use' : 'indoor use');
    }
    if (minSeats > 0) {
      why.push(`seating for ${capacityOpt!.label}${answers.capacity === '7+' ? '' : ''} people`);
    }
    if (answers.form !== 'no-preference') {
      const label = FORM_OPTIONS.find((f) => f.value === answers.form)?.label ?? answers.form;
      why.push(`a ${label.toLowerCase()} design`);
    }
    return { model, why };
  });
}
