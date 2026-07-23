/**
 * Single source of truth for site-wide strings.
 *
 * DEV vs PRODUCTION
 * -----------------
 * `showDev` is true in `npm run dev` and false in `npm run build`.
 * Development scaffolding — placeholder badges, "to be confirmed" rows,
 * unanswered FAQ entries, unconfirmed contact details — is gated behind it.
 * Customers never see incomplete information; you always do while working.
 */
export const showDev = import.meta.env.DEV;

export const site = {
  name: 'BUXENA',
  tagline: 'Where Wellness Starts',

  // BUXENA curates, imports and supplies. It does not manufacture.
  description:
    'BUXENA selects European-designed saunas for American homes — outdoor cabins, indoor rooms, barrel and cube. Chosen, specified and delivered with guidance at every step.',

  /**
   * UNCONFIRMED. Shown in development only, hidden in production builds,
   * until this mailbox is known to exist. Set `emailConfirmed` to true to
   * publish it.
   */
  email: 'hello@buxena.com',
  emailConfirmed: false,

  phone: '',
  city: '',
  instagram: '',
};

/** The email address, or null when it must not be shown to customers. */
export const publicEmail = site.emailConfirmed || showDev ? site.email : null;

export const nav = [
  { label: 'Saunas', href: '/saunas/' },
  { label: 'Our Story', href: '/our-story/' },
  { label: 'Wellness', href: '/wellness/' },
  { label: 'FAQ', href: '/faq/' },
  { label: 'Contact', href: '/contact/' },
];

export type CategoryId = 'outdoor' | 'indoor' | 'barrel' | 'cube' | 'heaters' | 'accessories';

/**
 * Categories are declared here, but pages are only generated for categories
 * that actually contain a model. Add a heater or an accessory and its
 * collection page, footer link and filter chip appear automatically.
 */
export const categories: {
  id: CategoryId;
  name: string;
  short: string;
  blurb: string;
}[] = [
  {
    id: 'outdoor',
    name: 'Outdoor Saunas',
    short: 'Outdoor',
    blurb: 'Free-standing cabins built for the garden, the deck or the tree line.',
  },
  {
    id: 'indoor',
    name: 'Indoor Saunas',
    short: 'Indoor',
    blurb: 'Rooms designed into the home — basements, bathrooms, private suites.',
  },
  {
    id: 'barrel',
    name: 'Barrel Saunas',
    short: 'Barrel',
    blurb: 'The curved form that heats quickly and sheds weather without fuss.',
  },
  {
    id: 'cube',
    name: 'Cube Saunas',
    short: 'Cube',
    blurb: 'Flat-roofed, architectural volumes with wide panoramic glazing.',
  },
  {
    id: 'heaters',
    name: 'Heaters',
    short: 'Heaters',
    blurb: 'Electric and wood-burning stoves matched to room volume.',
  },
  {
    id: 'accessories',
    name: 'Accessories',
    short: 'Accessories',
    blurb: 'Buckets, ladles, headrests, lighting and finishing details.',
  },
];

export const categoryMap = Object.fromEntries(categories.map((c) => [c.id, c]));
