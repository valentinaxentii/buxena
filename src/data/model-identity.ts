/**
 * BUXENA model identity — the master map between what customers see and
 * what BUXENA orders.
 *
 * Data lives in model-identity.json (shared with
 * scripts/build-model-presentation.mjs so the website and the PDFs can never
 * disagree). This module adds types and lookup helpers.
 *
 * CUSTOMER-FACING: publicName + code (e.g. "ELLA" / "BUH-01").
 * INTERNAL ONLY: internalRef (supplier model) and supplier. These exist so
 * purchasing, specifications and supplier communication stay connected to
 * the correct product — they must NEVER be rendered on a customer-facing
 * page, PDF or email.
 *
 * CODE SYSTEM (block-allocated so it expands without renumbering):
 *   BUH-01…09  indoor cabins
 *   BUH-10…19  cube saunas
 *   BUH-20…69  barrel saunas
 *   BUH-70+    reserved (heaters, accessories, custom projects)
 *
 * Keys are the internal title exactly as written in content frontmatter, so
 * an unmapped model falls back to its existing display name and nothing
 * breaks. Source content files and URLs are NOT renamed by this system.
 */
import raw from './model-identity.json';

export interface ModelIdentity {
  /** Customer-facing name, e.g. "ELLA". */
  publicName: string;
  /** BUXENA model code, e.g. "BUH-01". */
  code: string;
  /** Supplier's own model designation — INTERNAL ONLY. */
  internalRef: string;
  /** Manufacturer, or an explicit not-verified marker — INTERNAL ONLY. */
  supplier: string;
  series?: string;
  category?: string;
  capacity?: string;
  materials?: string[];

  /** Verified manufacturer, or null when unidentified — INTERNAL ONLY. */
  manufacturer?: string | null;
  manufacturerConfidence?: string;
  /** The manufacturer's own model designation — INTERNAL ONLY. */
  supplierModel?: string;
  /** Dealer EXW in EUR where verified; null otherwise. INTERNAL ONLY. */
  exwEur?: number | null;
  /** Supplier LIST price (not dealer-quoted) — modelling only. INTERNAL. */
  exwListEur?: number;
  exwSource?: string;
  /** 40HC loading class and per-unit freight+port. INTERNAL. */
  container?: { cls: string; unitsPer40HC: number; freightPortPerUnit: number } | null;
  usTerritory?: string;
  imageRights?: string;
  /** Set when the model is withheld from customer-facing sales. */
  hold?: string | null;
  /**
   * Launch readiness, classified on the MOST SEVERE outstanding blocker:
   * READY · WAITING FOR PERMISSION · WAITING FOR COST · SPECIAL ORDER ·
   * WAITING FOR SUPPLIER · HOLD. Surfaced at Admin → Catalog Status.
   */
  launchStatus?: string;
  /** One-line description of what is actually outstanding. */
  launchBlocker?: string;
  sourceFile: string;
  slug: string;
}

export const MODEL_IDENTITY = raw as unknown as Record<string, ModelIdentity>;

/** Identity for a content title, or null when unmapped. */
export function identityFor(title: string | undefined): ModelIdentity | null {
  if (!title) return null;
  return MODEL_IDENTITY[title.trim()] ?? null;
}

// Same 8-title guard as catalog.ts's RENAMED_CAPRA_TITLES — BUH- is used by
// every model regardless of supplier (NORD, VIRU included), so only these
// specific titles get "BUX " on an unmapped fallback.
const RENAMED_CAPRA_TITLES = new Set([
  'BUH-ELLA H1', 'BUH-ELLA H2', 'BUH-ILLI H1', 'BUH-ILLI H2',
  'BUH-ALLA H1', 'BUH-ALLA H2', 'BUH-UKU 160', 'BUH-UKU 230',
]);

/** Customer-facing name — falls back to the display title when unmapped. */
export function publicNameFor(title: string | undefined): string {
  const id = identityFor(title);
  if (id) return id.publicName;
  const t = title ?? '';
  return RENAMED_CAPRA_TITLES.has(t) ? t.replace(/^BUH-/i, 'BUX ') : t.replace(/^BUH-/i, '');
}

/** BUXENA model code, or null when unmapped. */
export function codeFor(title: string | undefined): string | null {
  return identityFor(title)?.code ?? null;
}

/** Reverse lookup: BUXENA code → internal content title. */
export function titleForCode(code: string): string | null {
  const hit = Object.entries(MODEL_IDENTITY).find(([, v]) => v.code === code.trim());
  return hit ? hit[0] : null;
}

/**
 * Public URL of a model's downloadable presentation, by slug.
 * The caller must confirm the file exists (product pages do this at build
 * time) — this only builds the conventional path.
 */
export function presentationPath(slug: string): string {
  return `/docs/presentations/${slug}-presentation.pdf`;
}
