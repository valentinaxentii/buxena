/**
 * Plan Your Sauna — question definitions + recommendation scoring.
 *
 * WHAT CHANGED AND WHY (2026-08-13)
 * ---------------------------------
 * The founder was shown "EDA Thermowood 1.3m — 2–3 people" as the BEST MATCH
 * for an answer of "3–4 people". Two independent defects produced that:
 *
 *   1. `'3-4'` carried `minSeats: 3`, so the requirement was read as "seats at
 *      least 3". A 2–3 sauna satisfies that. But a visitor who says 3–4 needs
 *      room for FOUR — the top of the range they chose is the requirement, not
 *      the bottom of it.
 *   2. Candidates were sorted `aMax - bMax` ascending, so whichever model
 *      scraped past the bar ranked FIRST. The weakest qualifying sauna was
 *      structurally guaranteed to be called "Best Match".
 *
 * Together those sent a customer wanting a four-person sauna toward a
 * three-person one, with copy asserting it matched. That is the dangerous class
 * of bug: silent, confident and wrong.
 *
 * HARD REQUIREMENTS vs SOFT PREFERENCES
 * -------------------------------------
 * hard  placement (indoor/outdoor) — strict, never relaxed. A model built for
 *       indoor installation is not a "compromise" outdoors, it is unsuitable.
 * hard  seating capacity — relaxable ONLY into an explicitly-labelled
 *       Closest Match, and never silently.
 * soft  form/shape — ranks, never excludes. Someone who idly picked "Barrel"
 *       should still see a cube that actually fits their family.
 * none  glazing and heater answers — collected for BUXENA to read, never
 *       scored. No model carries verified, differentiating data for either.
 *
 * WHAT IS DELIBERATELY NOT CHECKED
 * --------------------------------
 * Footprint, electrical supply and heater compatibility are all real hard
 * requirements in principle. The wizard never asks for a footprint or a supply,
 * and per-model heater data is prose rather than structured, so there is
 * nothing verified to test against. Inventing a "Fits your footprint" tick is
 * exactly the fabrication this codebase forbids, so no such claim is rendered.
 * Add the question and the structured field together, then extend HARD_CHECKS.
 */

export interface CapacityOption {
  value: string;
  label: string;
  /**
   * How many people the sauna must actually seat for this answer.
   *
   * The TOP of the chosen range, not the bottom. "3–4" means the visitor needs
   * room for four; a model seating at most three does not meet it. 0 disables
   * the check ("not sure").
   */
  seatsNeeded: number;
}

export const CAPACITY_OPTIONS: CapacityOption[] = [
  { value: '1-2', label: '1–2', seatsNeeded: 2 },
  { value: '3-4', label: '3–4', seatsNeeded: 4 },
  { value: '5-6', label: '5–6', seatsNeeded: 6 },
  { value: '7+', label: '7+', seatsNeeded: 7 },
  { value: 'unsure', label: 'Not sure', seatsNeeded: 0 },
];

export const LOCATION_OPTIONS = [
  { value: 'outdoor', label: 'Outdoors' },
  { value: 'indoor', label: 'Indoors' },
  { value: 'unsure', label: 'Not sure yet' },
];

/**
 * Real catalog productType values only.
 *
 * "Cube" was missing here while four Cube models (NORD 200/240, UKU 160/230)
 * existed in the catalog, so a visitor could never ask for one. Now that form
 * is a soft preference this is a ranking signal rather than a gate, but an
 * incomplete list still misrepresented the range.
 */
export const FORM_OPTIONS = [
  { value: 'Barrel', label: 'Barrel' },
  { value: 'Cube', label: 'Cube / cabin' },
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
  series?: string;
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
  /** Verified facts about THIS model that satisfy what the visitor asked for. */
  matches: string[];
  /** Honest compromises. Empty when the model meets every hard requirement. */
  tradeOffs: string[];
  /** False when a hard requirement is unmet — drives "Closest Match" wording. */
  meetsAllHard: boolean;
  /** Card heading: "Best Match" / "Closest Match" / "Alternative" / … */
  label: string;
}

const BEST_LABELS = ['Best Match', 'Alternative', 'Another Option'];
const CLOSEST_LABELS = ['Closest Match', 'Also Close', 'Another Option'];

/** Per-model evaluation against the visitor's answers. */
interface Evaluation {
  model: CatalogModel;
  matches: string[];
  tradeOffs: string[];
  /** Number of unmet HARD requirements. 0 = fully qualified. */
  hardMisses: number;
  /** How far short of the required seating, in people. 0 when met or unknown. */
  seatShortfall: number;
  /** Soft preference satisfied — ranks, never excludes. */
  softMatch: boolean;
  hasPhoto: boolean;
}

function evaluate(model: CatalogModel, answers: PlanAnswers): Evaluation {
  const matches: string[] = [];
  const tradeOffs: string[] = [];
  let hardMisses = 0;
  let seatShortfall = 0;

  // --- HARD: placement -----------------------------------------------------
  // Mismatches never reach here: recommendSaunas() excludes them outright, so a
  // tick is only ever added for a model genuinely built for the stated place.
  if (answers.location && answers.location !== 'unsure') {
    matches.push(model.location === 'outdoor' ? 'Outdoor installation' : 'Indoor installation');
  }

  // --- HARD: seating capacity ----------------------------------------------
  const capacityOpt = CAPACITY_OPTIONS.find((c) => c.value === answers.capacity);
  const seatsNeeded = capacityOpt?.seatsNeeded ?? 0;

  if (seatsNeeded > 0) {
    if (model.capacityMax == null) {
      // Unverified capacity is a miss, not a pass. Claiming a model seats
      // someone when the catalog does not say so is the fabrication rule.
      hardMisses += 1;
      seatShortfall = seatsNeeded;
      tradeOffs.push('Seating capacity not yet published for this model');
    } else if (model.capacityMax >= seatsNeeded) {
      matches.push(`Seats ${model.capacity ?? `${model.capacityMax} people`}`);
    } else {
      hardMisses += 1;
      seatShortfall = seatsNeeded - model.capacityMax;
      tradeOffs.push(
        `Seats ${model.capacity ?? `${model.capacityMax} people`} — you asked for ${capacityOpt!.label} people`
      );
    }
  } else if (model.capacity) {
    // No stated requirement, so this is information rather than a match.
    matches.push(`Seats ${model.capacity}`);
  }

  // --- SOFT: form / shape --------------------------------------------------
  let softMatch = false;
  if (answers.form && answers.form !== 'no-preference') {
    const askedLabel = FORM_OPTIONS.find((f) => f.value === answers.form)?.label ?? answers.form;
    if (model.productType === answers.form) {
      softMatch = true;
      matches.push(`${model.productType} design`);
    } else if (model.productType) {
      tradeOffs.push(`${model.productType} rather than the ${askedLabel.toLowerCase()} you preferred`);
    }
  }

  return {
    model,
    matches,
    tradeOffs,
    hardMisses,
    seatShortfall,
    softMatch,
    hasPhoto: Boolean(model.heroImage?.src && String(model.heroImage.src).trim()),
  };
}

/**
 * Rank fully-qualified candidates.
 *
 * Order of precedence, and the reasoning for each:
 *   1. soft preference matched — an explicitly requested shape beats a
 *      marginally better-sized one the visitor did not ask for.
 *   2. smallest ADEQUATE capacity — every model here already seats the
 *      required number, so the smallest is the right-sized one rather than an
 *      upsell. This is the same ascending sort as before, but it is now only
 *      ever applied to models that genuinely qualify, which is what made the
 *      original ordering harmful.
 *   3. has photography — a pure tie-breaker between models that fit equally
 *      well. It never outranks fit, so it cannot distort a recommendation; it
 *      only decides which of two equal options is shown first, and a card with
 *      a real photograph is the better one to lead with.
 *   4. catalog order — deterministic, so the same answers always give the same
 *      shortlist.
 */
function compareQualified(a: Evaluation, b: Evaluation): number {
  if (a.softMatch !== b.softMatch) return a.softMatch ? -1 : 1;
  const aMax = a.model.capacityMax ?? Infinity;
  const bMax = b.model.capacityMax ?? Infinity;
  if (aMax !== bMax) return aMax - bMax;
  if (a.hasPhoto !== b.hasPhoto) return a.hasPhoto ? -1 : 1;
  return (a.model.order ?? 999) - (b.model.order ?? 999);
}

/** Rank compromised candidates: least-compromised first. */
function compareClosest(a: Evaluation, b: Evaluation): number {
  if (a.hardMisses !== b.hardMisses) return a.hardMisses - b.hardMisses;
  if (a.seatShortfall !== b.seatShortfall) return a.seatShortfall - b.seatShortfall;
  if (a.softMatch !== b.softMatch) return a.softMatch ? -1 : 1;
  if (a.hasPhoto !== b.hasPhoto) return a.hasPhoto ? -1 : 1;
  return (a.model.order ?? 999) - (b.model.order ?? 999);
}

/**
 * Recommend up to three models.
 *
 * Returns fully-qualified models labelled "Best Match" when any exist. When
 * none do, returns the least-compromised models labelled "Closest Match" with
 * the compromise stated on the card — never a "Best Match" that fails a
 * requirement the visitor actually gave us.
 */
export function recommendSaunas(catalog: CatalogModel[], answers: PlanAnswers): Recommendation[] {
  // Placement is the one strict gate. Everything else is scored, so a visitor
  // always gets an honest answer rather than an empty page.
  const placementOk = catalog.filter(
    (m) => !answers.location || answers.location === 'unsure' || m.location === answers.location
  );

  const evaluations = placementOk.map((m) => evaluate(m, answers));
  const qualified = evaluations.filter((e) => e.hardMisses === 0);

  const pool = qualified.length > 0 ? qualified.sort(compareQualified) : evaluations.sort(compareClosest);
  const labels = qualified.length > 0 ? BEST_LABELS : CLOSEST_LABELS;

  return pool.slice(0, 3).map((e, i) => ({
    model: e.model,
    matches: e.matches,
    tradeOffs: e.tradeOffs,
    meetsAllHard: e.hardMisses === 0,
    label: labels[i] ?? 'Option',
  }));
}
