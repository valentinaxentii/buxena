/**
 * Builds a product's configurator from the data that model actually has.
 *
 * THE RULE: a group appears only when the model's own frontmatter supplies its
 * choices. Nothing here invents a wood option, a glass option, a control system
 * or a size variant to make the UI look complete — an option a customer can
 * select is a promise BUXENA has to keep, and 32 of 35 models have no verified
 * dealer data behind them yet.
 *
 * Two kinds of group, kept distinct on purpose:
 *
 *   PRODUCT groups are derived from verified supplier data (`options`,
 *   `heaterOptions`). They differ per model and vanish when the data is absent.
 *
 *   PREFERENCE groups ask what the CUSTOMER wants — how they intend to install
 *   it, where it is going. These are not claims about the product, so they are
 *   safe to ask on every model. Installation vocabulary matches what the admin
 *   already records against a unit (DIY / BUXENA / third-party), so a staff
 *   member reads the same words in the enquiry that they use in the back office.
 */

export interface ConfigOption {
  /** Stable value submitted with the enquiry. */
  value: string;
  /** What the customer reads. */
  label: string;
  /** Optional clarifier shown under the label. */
  hint?: string;
}

export interface ConfigGroup {
  /** Stable key, used in the summary and the enquiry payload. */
  key: string;
  /** Section heading, e.g. "Heater". */
  label: string;
  /** Why we are asking — shown small, under the heading. */
  help?: string;
  options: ConfigOption[];
  /** true → derived from this model's verified data; false → a customer preference. */
  fromProductData: boolean;
}

/** The subset of a sauna's frontmatter the configurator reads. */
export interface ConfigurableModel {
  title: string;
  options?: string[];
  heaterOptions?: string[];
  materials?: string[];
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

/**
 * How the customer intends to install. A PREFERENCE, not a product claim.
 *
 * It lives in the quote form (components/QuoteForm.astro), not here, and is
 * asked once for every model — including the models with no configurator at
 * all. Exported so both surfaces read the same four values, which match the
 * admin's `installation_type` vocabulary, so a staff member sees in the enquiry
 * the same words they use in the back office.
 */
export const INSTALLATION_PREFERENCES: ConfigOption[] = [
  { value: 'DIY', label: 'I will install it myself', hint: 'Flat-pack and self-assembly' },
  { value: 'BUXENA', label: 'BUXENA installation team', hint: 'Subject to your location' },
  { value: 'THIRD_PARTY', label: 'My own contractor', hint: 'We supply drawings and specifications' },
  { value: 'UNDECIDED', label: 'Not decided yet', hint: 'We will talk it through' },
];

export function buildConfigGroups(model: ConfigurableModel): ConfigGroup[] {
  const groups: ConfigGroup[] = [];

  // Assembly / supply format — only where the model states it.
  if (model.options?.length) {
    groups.push({
      key: 'supply',
      label: 'Supply format',
      help: 'Verified for this model.',
      fromProductData: true,
      options: model.options.map(toOption),
    });
  }

  // Heater — only where the model states verified compatibility. Heater
  // compatibility is a safety-relevant claim and is never assumed.
  if (model.heaterOptions?.length) {
    groups.push({
      key: 'heater',
      label: 'Heater',
      help: 'Only heater types verified for this model are listed. Controls and stones are matched to your choice.',
      fromProductData: true,
      options: model.heaterOptions.map(parseHeaterOption),
    });
  }

  // Exterior material — only when the model lists more than one. A single
  // material is a fact about the product, not a choice, and belongs in the
  // specifications rather than being dressed up as an option.
  if (model.materials && model.materials.length > 1) {
    groups.push({
      key: 'material',
      label: 'Exterior',
      help: 'Verified for this model.',
      fromProductData: true,
      options: model.materials.map(toOption),
    });
  }

  return groups;
}

/** Does this model have anything real to configure? */
export function hasProductOptions(model: ConfigurableModel): boolean {
  return buildConfigGroups(model).some((g) => g.fromProductData);
}

/**
 * Should the product page render a configurator at all?
 *
 * Only when the model has real, verified choices. A configurator whose single
 * question is "how will you install it?" is a fake configurator: it performs
 * the appearance of configurability while asking nothing about the product,
 * and on a premium page that reads as padding. Those models get the quote and
 * project CTAs instead, and the installation question is asked once in the
 * quote form where every model asks it.
 *
 * This is a pure function of the model's own data, so a model turns its
 * configurator on automatically the moment verified options are added to its
 * frontmatter — no code change, no page to remember to update.
 */
export function shouldShowConfigurator(model: ConfigurableModel): boolean {
  return hasProductOptions(model);
}

/**
 * How a model is classified for internal follow-up.
 *
 *   'configurable'  — verified choices exist; the configurator is shown.
 *   'quote-only'    — no configurable dimension for this model; correct as-is.
 *   'blocked-data'  — the model TYPE has options in the range, but this record
 *                     has none recorded. Not a product fact, a data gap: chase
 *                     the supplier rather than invent the options.
 *
 * The distinction between the last two matters commercially. 'quote-only' needs
 * nothing; 'blocked-data' is a task with a supplier's name on it.
 */
export type ConfiguratorClass = 'configurable' | 'quote-only' | 'blocked-data';

export function classifyModel(
  model: ConfigurableModel,
  /** Sibling models in the same series, used to spot a data gap. */
  seriesPeers: ConfigurableModel[] = []
): ConfiguratorClass {
  if (hasProductOptions(model)) return 'configurable';
  // A peer in the same series HAS verified options, so this one plausibly has
  // them too and nobody has recorded them yet.
  if (seriesPeers.some((peer) => peer.title !== model.title && hasProductOptions(peer))) {
    return 'blocked-data';
  }
  return 'quote-only';
}

/**
 * The configuration as one line per answered group, for the enquiry message.
 * Unanswered groups are omitted — a blank is not a selection, and padding the
 * note with "not selected" makes it harder for staff to read what was chosen.
 */
export function summariseSelections(
  groups: ConfigGroup[],
  selections: Record<string, string>
): string[] {
  const lines: string[] = [];
  for (const group of groups) {
    const value = selections[group.key];
    if (!value) continue;
    const option = group.options.find((o) => o.value === value);
    lines.push(`${group.label}: ${option?.label ?? value}`);
  }
  return lines;
}

/**
 * Pricing state for the summary panel.
 *
 * `src/data/pricing.ts` is deliberately empty — no price is approved for
 * publication — so this returns the honest "we will confirm" wording rather
 * than a computed total. When approved prices exist, this is the one place
 * that has to learn to add them up.
 */
export const PRICING_PENDING_MESSAGE =
  'Exact package pricing will be confirmed by BUXENA.';
