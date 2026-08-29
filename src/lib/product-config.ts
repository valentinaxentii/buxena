/**
 * Builds a product's configurator from the data that model actually has.
 *
 * V3 keeps the V2 rule: an option is shown only when the model's verified
 * content supplies it. The upgrade is structural — supplier-backed choices
 * can now be organised into a clear Room → Heat & Controls → Finish & Extras
 * journey without inventing options to fill the UI.
 */

export type ConfigStage = 'room' | 'heat' | 'extras';

export const CONFIG_STAGE_META: Record<ConfigStage, { label: string; help: string }> = {
  room: {
    label: 'Room',
    help: 'Choose the verified room, orientation, supply and finish options for this model.',
  },
  heat: {
    label: 'Heat & Controls',
    help: 'Choose only from heater and control combinations verified for this sauna.',
  },
  extras: {
    label: 'Finish & Accessories',
    help: 'Add verified lighting, safety and accessory options where this model supports them.',
  },
};

export interface ConfigOption {
  /** Stable value submitted with the enquiry. */
  value: string;
  /** What the customer reads. */
  label: string;
  /** Optional clarifier shown under the label. */
  hint?: string;
  /** Supplier/manufacturer SKU for internal quote follow-up. Never displayed as a price. */
  sku?: string;
}

export interface StructuredConfigGroup {
  key: string;
  label: string;
  help?: string;
  stage: ConfigStage;
  options: ConfigOption[];
}

export interface ConfigGroup extends StructuredConfigGroup {
  /** true → derived from this model's verified data; false → customer preference. */
  fromProductData: boolean;
}

/** The subset of a sauna's frontmatter the configurator reads. */
export interface ConfigurableModel {
  title: string;
  options?: string[];
  heaterOptions?: string[];
  materials?: string[];
  /**
   * V3 structured supplier-backed choices. These are preferred when present.
   * Legacy fields above remain supported so every V2 product keeps working.
   */
  configurationGroups?: StructuredConfigGroup[];
}

/**
 * `heaterOptions` entries are written as "Electric: Harvia, HUUM (with app
 * control)" — a family followed by the brands verified for it. The family is
 * the meaningful choice; the brands are detail the specialist confirms. Split
 * on the first colon so the option reads as "Electric" with the brands as a
 * hint, and fall back to the whole string when there is no colon.
 */
function parseHeaterOption(raw: string, index: number): ConfigOption {
  const idx = raw.indexOf(':');
  if (idx === -1) return { value: raw.trim(), label: raw.trim() };
  const family = raw.slice(0, idx).trim();
  const brands = raw.slice(idx + 1).trim();
  return {
    value: family || `heater-${index}`,
    label: family,
    hint: brands ? `Verified for this model: ${brands}` : undefined,
  };
}

function toOption(raw: string): ConfigOption {
  return { value: raw.trim(), label: raw.trim() };
}

function cleanStructuredGroups(groups: StructuredConfigGroup[] | undefined): ConfigGroup[] {
  if (!groups?.length) return [];
  const seen = new Set<string>();
  const cleaned: ConfigGroup[] = [];

  for (const group of groups) {
    const key = group.key.trim();
    const label = group.label.trim();
    if (!key || !label || seen.has(key)) continue;

    const options = group.options
      .map((option) => ({
        value: option.value.trim(),
        label: option.label.trim(),
        hint: option.hint?.trim() || undefined,
        sku: option.sku?.trim() || undefined,
      }))
      .filter((option) => option.value && option.label);

    if (!options.length) continue;
    seen.add(key);
    cleaned.push({
      key,
      label,
      help: group.help?.trim() || undefined,
      stage: group.stage,
      options,
      fromProductData: true,
    });
  }

  return cleaned;
}

/**
 * How the customer intends to install. A PREFERENCE, not a product claim.
 * It remains in the quote form, where every model asks it once.
 */
export const INSTALLATION_PREFERENCES: ConfigOption[] = [
  { value: 'DIY', label: 'I will install it myself', hint: 'Flat-pack and self-assembly' },
  { value: 'BUXENA', label: 'BUXENA installation team', hint: 'Subject to your location' },
  { value: 'THIRD_PARTY', label: 'My own contractor', hint: 'We supply drawings and specifications' },
  { value: 'UNDECIDED', label: 'Not decided yet', hint: 'We will talk it through' },
];

export function buildConfigGroups(model: ConfigurableModel): ConfigGroup[] {
  const groups = cleanStructuredGroups(model.configurationGroups);
  const usedKeys = new Set(groups.map((group) => group.key));

  // Backward compatibility for V2 content. Structured V3 groups win when they
  // use the same key, so a model cannot show both the old and new version of a
  // choice while content is migrated gradually.
  if (model.options?.length && !usedKeys.has('supply')) {
    groups.push({
      key: 'supply',
      label: 'Supply format',
      help: 'Verified for this model.',
      stage: 'room',
      fromProductData: true,
      options: model.options.map(toOption),
    });
  }

  if (model.heaterOptions?.length && !usedKeys.has('heater')) {
    groups.push({
      key: 'heater',
      label: 'Heater',
      help: 'Only heater types verified for this model are listed. Controls and stones are matched to your choice.',
      stage: 'heat',
      fromProductData: true,
      options: model.heaterOptions.map(parseHeaterOption),
    });
  }

  if (model.materials && model.materials.length > 1 && !usedKeys.has('material')) {
    groups.push({
      key: 'material',
      label: 'Wood / finish',
      help: 'Verified for this model.',
      stage: 'room',
      fromProductData: true,
      options: model.materials.map(toOption),
    });
  }

  return groups;
}

export function configStages(groups: ConfigGroup[]): { key: ConfigStage; label: string; help: string; groups: ConfigGroup[] }[] {
  return (Object.keys(CONFIG_STAGE_META) as ConfigStage[])
    .map((key) => ({ key, ...CONFIG_STAGE_META[key], groups: groups.filter((group) => group.stage === key) }))
    .filter((stage) => stage.groups.length > 0);
}

/** Does this model have anything real to configure? */
export function hasProductOptions(model: ConfigurableModel): boolean {
  return buildConfigGroups(model).some((g) => g.fromProductData);
}

export function shouldShowConfigurator(model: ConfigurableModel): boolean {
  return hasProductOptions(model);
}

export type ConfiguratorClass = 'configurable' | 'quote-only' | 'blocked-data';

export function classifyModel(
  model: ConfigurableModel,
  seriesPeers: ConfigurableModel[] = []
): ConfiguratorClass {
  if (hasProductOptions(model)) return 'configurable';
  if (seriesPeers.some((peer) => peer.title !== model.title && hasProductOptions(peer))) {
    return 'blocked-data';
  }
  return 'quote-only';
}

export function summariseSelections(
  groups: ConfigGroup[],
  selections: Record<string, string>
): string[] {
  const lines: string[] = [];
  for (const group of groups) {
    const value = selections[group.key];
    if (!value) continue;
    const option = group.options.find((o) => o.value === value);
    const sku = option?.sku ? ` [${option.sku}]` : '';
    lines.push(`${group.label}: ${option?.label ?? value}${sku}`);
  }
  return lines;
}

/**
 * Supplier cost is deliberately absent from this module. Public pricing still
 * comes only from src/data/pricing.ts after founder approval.
 */
export const PRICING_PENDING_MESSAGE =
  'Exact package pricing will be confirmed by BUXENA.';
