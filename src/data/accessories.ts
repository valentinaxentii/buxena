export interface AccessoryProduct {
  sku: string;
  name: string;
  category: 'sets' | 'lighting' | 'stones' | 'wellness';
  material?: string;
  summary: string;
  featured?: boolean;
}

/**
 * Curated accessory assortment backed by the SAWO dealer price list received
 * 2026-08-28. Supplier FCA prices deliberately do not live in this public
 * module. A product appears here only when its exact SKU and description are
 * present in the source workbook.
 */
export const accessoryProducts: AccessoryProduct[] = [
  {
    sku: 'SET-BASIC-H',
    name: 'Sauna Essentials — Basic',
    category: 'sets',
    material: 'Hemlock',
    summary: 'Four-piece starter set with wooden pail, ladle, sand timer and eucalyptus aroma oil.',
  },
  {
    sku: 'SET-ESS-D',
    name: 'Sauna Essentials — Cedar',
    category: 'sets',
    material: 'Cedar',
    summary: 'Eight-piece cedar set with pail, ladle, thermo-hygrometer, sand timer, aroma cup, aroma oil and sauna signage.',
    featured: true,
  },
  {
    sku: 'SET-SIG-BL',
    name: 'Signature Accessory Set — Black',
    category: 'sets',
    material: 'Black',
    summary: 'Nine-piece coordinated black set with Kanto pail, Puro ladle, thermo-hygrometer, sand timer, headrest and aroma accessories.',
  },
  {
    sku: 'SET-SIG-D',
    name: 'Signature Accessory Set — Cedar',
    category: 'sets',
    material: 'Cedar',
    summary: 'Nine-piece coordinated cedar set with Kanto pail, Puro ladle, thermo-hygrometer, sand timer, headrest and aroma accessories.',
  },
  {
    sku: '923-D-SET',
    name: 'Curve Light 237 — Cedar Pair',
    category: 'lighting',
    material: 'Cedar',
    summary: 'Pair of compact wooden curve lights with integrated LED strips.',
  },
  {
    sku: '924-D-SET',
    name: 'Curve Light 365 — Cedar Pair',
    category: 'lighting',
    material: 'Cedar',
    summary: 'Pair of medium wooden curve lights with integrated LED strips.',
    featured: true,
  },
  {
    sku: '925-D-SET',
    name: 'Curve Light 610 — Cedar Pair',
    category: 'lighting',
    material: 'Cedar',
    summary: 'Pair of long wooden curve lights with integrated LED strips.',
  },
  {
    sku: 'LP15-004-US',
    name: 'Sauna Light Transformer — US Plug',
    category: 'lighting',
    summary: 'US-plug transformer specified for the compatible sauna lighting system.',
  },
  {
    sku: 'R-980',
    name: 'Rounded Olivine Diabase Stones — 3–10 cm',
    category: 'stones',
    summary: 'Rounded olivine diabase sauna stones, 20 kg pack, 3–10 cm size range.',
    featured: true,
  },
  {
    sku: 'R-981',
    name: 'Rounded Olivine Diabase Stones — 8–15 cm',
    category: 'stones',
    summary: 'Rounded olivine diabase sauna stones, 20 kg pack, 8–15 cm size range.',
  },
  {
    sku: 'R-982',
    name: 'White Quartz Decorative Stones — 3–10 cm',
    category: 'stones',
    summary: 'Rounded white quartz decorative stones, 10 kg pack, intended as a top layer over hot stones.',
  },
  {
    sku: 'R-983',
    name: 'White Quartz Decorative Stones — 8–15 cm',
    category: 'stones',
    summary: 'Rounded white quartz decorative stones, 10 kg pack, intended as a top layer over hot stones.',
  },
  {
    sku: 'R-160',
    name: 'Luxury Soapstone Aroma Cup',
    category: 'wellness',
    material: 'Soapstone',
    summary: 'Hand-crafted soapstone aroma cup for adding fragrance to the sauna ritual.',
  },
  {
    sku: 'R-100',
    name: 'Soapstone Aroma Cup',
    category: 'wellness',
    material: 'Soapstone',
    summary: 'Compact hand-crafted soapstone aroma cup for sauna fragrance.',
  },
];

export const accessoryCategories = [
  { id: 'sets', label: 'Accessory Sets', blurb: 'Coordinated essentials instead of a basket of unrelated parts.' },
  { id: 'lighting', label: 'Lighting', blurb: 'Warm sauna-safe lighting and the verified components it needs.' },
  { id: 'stones', label: 'Sauna Stones', blurb: 'Rounded heater stones and decorative top stones in verified pack sizes.' },
  { id: 'wellness', label: 'Ritual & Wellness', blurb: 'Small details that make the sauna feel finished and personal.' },
] as const;
