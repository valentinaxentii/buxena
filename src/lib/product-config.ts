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
 * How the customer intends to install. A preference, not a product claim, so
 * it is offered on every model. Wording matches the admin's installation_type.
 */
const INSTALLATION_GROUP: ConfigGroup = {
  key: 'installation',
  label: 'Installation',
  help: 'Tells us what to include in your quote. Nothing is committed at this stage.',
  fromProductData: false,
  options: [
    { value: 'DIY', label: 'I will install it myself', hint: 'Flat-pack and self-assembly' },
    { value: 'BUXENA', label: 'BUXENA installation team', hint: 'Subject to your location' },
    { value: 'THIRD_PARTY', label: 'My own contractor', hint: 'We supply drawings and specifications' },
    { value: 'UNDECIDED', label: 'Not decided yet', hint: 'We will talk it through' },
  ],
};

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

  groups.push(INSTALLATION_GROUP);
  return groups;
}

/** Does this model have anything real to configure, beyond the preference questions? */
export function hasProductOptions(model: ConfigurableModel): boolean {
  return buildConfigGroups(model).some((g) => g.fromProductData);
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
