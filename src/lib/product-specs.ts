/**
 * Groups a model's specification rows into readable categories.
 *
 * The page previously rendered one flat table of every `specs` row in
 * frontmatter order — layout next to roof next to heater next to bands. For a
 * considered purchase the customer is asking specific questions ("will it
 * fit?", "how is it heated?"), and a flat list makes them scan the whole thing
 * for each one.
 *
 * Grouping is derived from the label that is ALREADY in the data. No
 * frontmatter is rewritten and no value is invented — this only decides which
 * heading an existing row sits under, and an empty category never renders.
 */

export interface SpecRow {
  label: string;
  value: string;
}

export interface SpecGroup {
  key: string;
  title: string;
  rows: SpecRow[];
}

/**
 * Label patterns per category, in priority order. First match wins, so the
 * more specific patterns are listed before the general ones — "wall thickness"
 * has to reach DIMENSIONS before CONSTRUCTION claims it for "wall".
 */
const CATEGORY_RULES: { key: string; title: string; match: RegExp }[] = [
  {
    key: 'dimensions',
    title: 'Dimensions',
    match: /\b(length|width|depth|diameter|height|footprint|thickness|weight|size|area|external|internal)\b/i,
  },
  {
    key: 'door-glass',
    title: 'Door & Glass',
    match: /\b(door|glass|glazing|window|front wall)\b/i,
  },
  {
    key: 'heating',
    title: 'Heating',
    match: /\b(heater|stove|heating|chimney|flue|kw|electrical|power|voltage|amp)\b/i,
  },
  {
    key: 'interior',
    title: 'Interior',
    match: /\b(bench|benches|backrest|seating|interior|lining|floor|duckboard|lighting|headrest)\b/i,
  },
  {
    key: 'ventilation',
    title: 'Ventilation',
    match: /\b(vent|ventilation|airflow|air intake)\b/i,
  },
  {
    key: 'installation',
    title: 'Installation & Base',
    match: /\b(assembly|install|foundation|base|delivery|flat-pack|kit|anchor)\b/i,
  },
  {
    key: 'construction',
    title: 'Construction',
    match: /\b(wall|roof|timber|wood|material|insulation|band|hoop|exterior|frame|treatment|layout)\b/i,
  },
];

const OTHER_GROUP = { key: 'other', title: 'Other specifications' };

/**
 * Build the grouped view.
 *
 * Rows that match nothing land in "Other specifications" rather than being
 * dropped — losing a verified fact because no pattern happened to match it
 * would be far worse than an imperfect heading.
 *
 * Categories with no rows are omitted entirely: an empty "Ventilation" heading
 * on a model with no ventilation data advertises the gap rather than the
 * product.
 */
export function groupSpecs(
  specs: SpecRow[] = [],
  dimensions: SpecRow[] = []
): SpecGroup[] {
  const buckets = new Map<string, SpecGroup>();

  const push = (groupKey: string, title: string, row: SpecRow) => {
    if (!buckets.has(groupKey)) buckets.set(groupKey, { key: groupKey, title, rows: [] });
    buckets.get(groupKey)!.rows.push(row);
  };

  // `dimensions` is already a dedicated frontmatter block, so it goes straight
  // to the Dimensions group without pattern matching.
  for (const row of dimensions) push('dimensions', 'Dimensions', row);

  for (const row of specs) {
    const rule = CATEGORY_RULES.find((r) => r.match.test(row.label));
    if (rule) push(rule.key, rule.title, row);
    else push(OTHER_GROUP.key, OTHER_GROUP.title, row);
  }

  // Stable, sensible reading order: what it is, then how it is built, then how
  // it runs. "Other" last.
  const order = [
    'dimensions',
    'construction',
    'door-glass',
    'interior',
    'heating',
    'ventilation',
    'installation',
    'other',
  ];
  return order
    .map((key) => buckets.get(key))
    .filter((g): g is SpecGroup => Boolean(g && g.rows.length));
}
