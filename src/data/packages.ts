/**
 * BUXENA commercial packages — the three ways to buy.
 *
 * DATA ONLY, NO PRICES. Package pricing is quoted per model and per site
 * through the existing quote pipeline. `fromPrice` exists so approved
 * pricing can be displayed later ("Sauna from $X") — leave it unset until
 * real, approved numbers exist; the UI omits pricing when absent.
 *
 * COMMERCIAL-CLAIM DISCIPLINE (founders' review, 2026-08-10):
 * - No unconditional inclusion claims. Exact included accessories are
 *   AWAITING COMMERCIAL CONFIRMATION — the Ritual Kit is a potential
 *   package component, not a stated universal inclusion.
 * - "Installation coordination where available" — BUXENA does not claim
 *   to install nationally.
 * - No "Most Popular"/"Best Seller" until sales data proves it. The only
 *   flag is "BUXENA Recommended".
 */
export interface SaunaPackage {
  id: 'sauna' | 'complete' | 'project';
  name: string;
  flag?: string;
  summary: string;
  includes: string[];
  note?: string;
  /** Approved display price, e.g. "from $8,900" or "Project Pricing". Unset = omitted. */
  fromPrice?: string;
}

export const packages: SaunaPackage[] = [
  {
    id: 'sauna',
    name: 'Sauna',
    summary: 'Core sauna structure and confirmed standard equipment — for buyers who already have their heater, electrician and site plan in hand.',
    includes: [
      'The sauna itself, in your chosen configuration',
      'Confirmed standard equipment for the model',
      'Delivery coordination to your address',
    ],
  },
  {
    id: 'complete',
    name: 'BUXENA Complete',
    flag: 'BUXENA Recommended',
    summary: 'One sauna. One properly matched system — heater, controls, stones and lighting coordinated as one project.',
    includes: [
      'Everything in the Sauna package',
      'Correctly matched heater for the room',
      'Controls configured for the heater',
      'Sauna stones matched to the heater',
      'Interior lighting suited to the space',
      'Essential accessories',
    ],
    note: 'Exact configuration and inclusions are confirmed per model in your written quote.',
  },
  {
    id: 'project',
    name: 'BUXENA Project',
    summary: 'Everything in Complete, plus the project itself — for sites where access, foundation and electrical need managing, not just mentioning.',
    includes: [
      'Everything in BUXENA Complete',
      'Delivery coordination',
      'Project and site review',
      'Installation coordination where available',
    ],
    note: 'Scope is agreed per project — what your site actually needs, not a fixed bundle.',
  },
];
