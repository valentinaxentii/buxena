import { publicConfigurationFor } from '../data/product-configurations';

/**
 * Builds a product configurator only from verified product data / public
 * configuration facts. Supplier cost and supplier SKU data never enter this
 * browser-facing module.
 */

export type ConfigStage = 'room' | 'heat' | 'extras';

export const CONFIG_STAGE_META: Record<ConfigStage, { label: string; help: string }> = {
  room: { label: 'Room', help: 'Choose the verified room, orientation, supply and finish options for this model.' },
  heat: { label: 'Heat & Controls', help: 'Choose only from heater and control combinations verified for this sauna.' },
  extras: { label: 'Finish & Accessories', help: 'Add verified lighting, safety and accessory options where this model supports them.' },
};

export interface ConfigOption {
  /** Stable BUXENA-safe value. Never use a supplier SKU here. */
  value: string;
  label: string;
  hint?: string;
}

export interface StructuredConfigGroup {
  key: string;
  label: string;
  help?: string;
  stage: ConfigStage;
  options: ConfigOption[];
}

export interface ConfigGroup extends StructuredConfigGroup {
  fromProductData: boolean;
}

export interface ConfigurableModel {
  title: string;
  options?: string[];
  heaterOptions?: string[];
  materials?: string[];
  configurationGroups?: StructuredConfigGroup[];
}

function parseHeaterOption(raw: string, index: number): ConfigOption {
  const colon = raw.indexOf(':');
  if (colon === -1) return { value: raw.trim(), label: raw.trim() };
  const family = raw.slice(0, colon).trim();
  const brands = raw.slice(colon + 1).trim();
  return {
    value: family || `heater-${index}`,
    label: family,
    hint: brands ? `Verified for this model: ${brands}` : undefined,
  };
}

function toOption(raw: string): ConfigOption {
  return { value: raw.trim(), label: raw.trim() };
}

function cleanStructuredGroups(groups: StructuredConfigGroup[]): ConfigGroup[] {
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

export const INSTALLATION_PREFERENCES: ConfigOption[] = [
  { value: 'DIY', label: 'I will install it myself', hint: 'Flat-pack and self-assembly' },
  { value: 'BUXENA', label: 'BUXENA installation team', hint: 'Subject to your location' },
  { value: 'THIRD_PARTY', label: 'My own contractor', hint: 'We supply drawings and specifications' },
  { value: 'UNDECIDED', label: 'Not decided yet', hint: 'We will talk it through' },
];

export function buildConfigGroups(model: ConfigurableModel): ConfigGroup[] {
  // Explicit per-model configuration wins. Registry facts fill the gap while
  // SAWO products are staged without forcing new frontmatter schema fields.
  const structured = [
    ...(model.configurationGroups ?? []),
    ...(publicConfigurationFor(model.title) as StructuredConfigGroup[]),
  ];
  const groups = cleanStructuredGroups(structured);
  const usedKeys = new Set(groups.map((group) => group.key));

  if (model.options?.length && !usedKeys.has('supply')) {
    groups.push({
      key: 'supply', label: 'Supply format', help: 'Verified for this model.', stage: 'room', fromProductData: true,
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
      key: 'material', label: 'Wood / finish', help: 'Verified for this model.', stage: 'room', fromProductData: true,
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

export function hasProductOptions(model: ConfigurableModel): boolean {
  return buildConfigGroups(model).some((group) => group.fromProductData);
}

export function shouldShowConfigurator(model: ConfigurableModel): boolean {
  return hasProductOptions(model);
}

export type ConfiguratorClass = 'configurable' | 'quote-only' | 'blocked-data';

export function classifyModel(model: ConfigurableModel, seriesPeers: ConfigurableModel[] = []): ConfiguratorClass {
  if (hasProductOptions(model)) return 'configurable';
  if (seriesPeers.some((peer) => peer.title !== model.title && hasProductOptions(peer))) return 'blocked-data';
  return 'quote-only';
}

export function summariseSelections(groups: ConfigGroup[], selections: Record<string, string>): string[] {
  const lines: string[] = [];
  for (const group of groups) {
    const value = selections[group.key];
    if (!value) continue;
    const option = group.options.find((candidate) => candidate.value === value);
    lines.push(`${group.label}: ${option?.label ?? value}`);
  }
  return lines;
}

export const PRICING_PENDING_MESSAGE = 'Exact package pricing will be confirmed by BUXENA.';
