/**
 * Technical assets: what may be shown to a customer, and what is still owed
 * by a supplier.
 *
 * Two audiences from one dataset, deliberately:
 *   - the product page asks "may I show this?" and gets a hard no by default
 *   - the readiness view and the gap report ask "what is missing?" and get an
 *     answer specific enough to put in an email
 *
 * The publication rule is three conditions, all of which default to refusing:
 * VERIFIED status, written permission, and an actual URL. Anything else stays
 * internal. That is stricter than it needs to be for, say, a floor plan we
 * drew ourselves — and it stays strict, because the register exists precisely
 * because permission was once assumed instead of recorded.
 */

export type AssetStatus =
  | 'VERIFIED'
  | 'REQUESTED'
  | 'MISSING'
  | 'UNVERIFIED'
  | 'NOT_APPLICABLE'
  | 'INTERNAL_ONLY';

export interface TechnicalAsset {
  status?: AssetStatus;
  url?: string;
  title?: string;
  source?: string;
  permission?: 'granted-written' | 'pending' | 'none';
  note?: string;
  provider?: string;
  poster?: string;
  durationSeconds?: number;
}

export type TechnicalAssets = Record<string, TechnicalAsset | undefined>;

/** How a slot is presented, and how much it matters commercially. */
export interface AssetSlot {
  key: string;
  label: string;
  /** Public action wording. Absent → internal-only slot, never a button. */
  action?: string;
  /** How it renders when public. */
  kind: 'video' | 'drawing' | 'document' | 'model' | 'internal';
  /**
   * 'sales'    — a customer asks for this before buying; its absence costs sales
   * 'ops'      — needed to fulfil and install, not to sell
   * 'internal' — never customer-facing
   */
  weight: 'sales' | 'ops' | 'internal';
}

/**
 * Every tracked slot, in the order a buyer would want them. Order matters: the
 * action row renders in this sequence, so the most persuasive resource is
 * first.
 */
export const ASSET_SLOTS: AssetSlot[] = [
  { key: 'installationVideo', label: 'Installation video', action: 'Watch Installation', kind: 'video', weight: 'sales' },
  { key: 'assemblyVideo', label: 'Assembly video', action: 'Watch Assembly', kind: 'video', weight: 'sales' },
  { key: 'threeD', label: '3D / CAD', action: 'View 3D', kind: 'model', weight: 'sales' },
  { key: 'floorPlan', label: 'Floor plan', action: 'View Floor Plan', kind: 'drawing', weight: 'sales' },
  { key: 'dimensionDrawing', label: 'Dimension drawing', action: 'View Dimensions', kind: 'drawing', weight: 'sales' },
  { key: 'elevations', label: 'Elevations', action: 'View Elevations', kind: 'drawing', weight: 'ops' },
  { key: 'benchLayout', label: 'Bench layout', action: 'View Bench Layout', kind: 'drawing', weight: 'ops' },
  { key: 'installationManual', label: 'Installation manual', action: 'Installation Guide', kind: 'document', weight: 'sales' },
  { key: 'electricalGuide', label: 'Electrical guide', action: 'Electrical Guide', kind: 'document', weight: 'sales' },
  { key: 'foundationGuide', label: 'Foundation guide', action: 'Foundation Guide', kind: 'document', weight: 'sales' },
  { key: 'heaterManual', label: 'Heater manual', action: 'Heater Manual', kind: 'document', weight: 'ops' },
  { key: 'warrantyDocument', label: 'Warranty document', action: 'Warranty', kind: 'document', weight: 'sales' },
  { key: 'packagingDimensions', label: 'Packaging dimensions', kind: 'internal', weight: 'ops' },
  { key: 'packagingPhotos', label: 'Packaging photos', kind: 'internal', weight: 'ops' },
  { key: 'unloadingInstructions', label: 'Unloading instructions', kind: 'internal', weight: 'ops' },
  { key: 'imagePermission', label: 'Image permission', kind: 'internal', weight: 'sales' },
];

export function slotFor(key: string): AssetSlot | undefined {
  return ASSET_SLOTS.find((s) => s.key === key);
}

/** May this asset be shown to a customer? All three conditions, no exceptions. */
export function isPubliclyAvailable(asset: TechnicalAsset | undefined, slot?: AssetSlot): boolean {
  if (!asset) return false;
  if (slot && (slot.kind === 'internal' || !slot.action)) return false;
  if (asset.status !== 'VERIFIED') return false;
  if (asset.permission !== 'granted-written') return false;
  return Boolean(asset.url && asset.url.trim());
}

export interface PublicAsset {
  slot: AssetSlot;
  asset: TechnicalAsset;
}

/**
 * The customer-facing resources for a model, in ASSET_SLOTS order.
 * Empty for every model today, which is why no action row renders.
 */
export function publicAssets(assets: TechnicalAssets | undefined): PublicAsset[] {
  if (!assets) return [];
  const out: PublicAsset[] = [];
  for (const slot of ASSET_SLOTS) {
    const asset = assets[slot.key];
    if (isPubliclyAvailable(asset, slot)) out.push({ slot, asset: asset! });
  }
  return out;
}

export function hasPublicAssets(assets: TechnicalAssets | undefined): boolean {
  return publicAssets(assets).length > 0;
}

// ---------------------------------------------------------------------------
// Internal readiness
// ---------------------------------------------------------------------------

export type ReadinessVerdict = 'READY FOR SALES' | 'PARTIAL' | 'BLOCKED';

export interface SlotReadiness {
  slot: AssetSlot;
  status: AssetStatus;
}

export interface ProductReadiness {
  verdict: ReadinessVerdict;
  rows: SlotReadiness[];
  /** Sales-weighted slots that are not settled — what to chase, in priority order. */
  missingHighValue: AssetSlot[];
}

/**
 * A slot is "settled" when it needs no further action: we have it, or it
 * genuinely does not apply. REQUESTED is deliberately NOT settled — an
 * unanswered email is not an asset.
 */
function isSettled(status: AssetStatus): boolean {
  return status === 'VERIFIED' || status === 'NOT_APPLICABLE' || status === 'INTERNAL_ONLY';
}

/**
 * Readiness for one model.
 *
 * Deliberately NOT a percentage. "7/10" reads as 70% done when the three
 * missing items might be the floor plan, the electrical guide and image
 * permission — the exact things that lose a sale. A verdict plus the named
 * gaps is honest; a score flatters.
 */
export function productReadiness(assets: TechnicalAssets | undefined): ProductReadiness {
  const rows: SlotReadiness[] = ASSET_SLOTS.map((slot) => ({
    slot,
    status: (assets?.[slot.key]?.status ?? 'MISSING') as AssetStatus,
  }));

  const salesRows = rows.filter((r) => r.slot.weight === 'sales');
  const missingHighValue = salesRows.filter((r) => !isSettled(r.status)).map((r) => r.slot);

  // BLOCKED when nothing sales-critical is settled — the state the whole
  // catalogue is in today, and calling it "partial" would overstate it.
  const settledSales = salesRows.filter((r) => isSettled(r.status)).length;
  const verdict: ReadinessVerdict =
    missingHighValue.length === 0 ? 'READY FOR SALES' : settledSales === 0 ? 'BLOCKED' : 'PARTIAL';

  return { verdict, rows, missingHighValue };
}
