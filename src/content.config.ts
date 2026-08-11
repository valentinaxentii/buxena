import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

/**
 * A placeholder image slot.
 * While we wait on real photography, `src` is left empty and the site renders a
 * clearly-labelled placeholder block using `note` as the art-direction brief.
 * To go live with a real photo: drop the file in /public/images/ and set
 * `src: "/images/filename.jpg"`. The placeholder disappears automatically.
 */
const imageSlot = z.object({
  src: z.string().optional(),
  alt: z.string(),
  note: z.string().optional(),
});

/**
 * IMPORTANT — factual integrity.
 * Every specification field below is OPTIONAL by design. Nothing about
 * dimensions, capacity, materials, heaters, certifications, warranty or price
 * is assumed or auto-filled. If a field is absent the page renders
 * "To be confirmed" rather than a guess. Only add values you can source from
 * the supplier's own documentation.
 */
const saunas = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/saunas' }),
  schema: z.object({
    title: z.string(),
    category: z.enum(['outdoor', 'indoor', 'barrel', 'cube', 'heaters', 'accessories']),
    tagline: z.string(),
    summary: z.string(),
    order: z.number().default(100),
    draft: z.boolean().default(false),

    /**
     * INTERNAL ONLY — never rendered to customers.
     * Records WHY a model is withheld from the catalog, so a `draft: true`
     * is never mistaken for unfinished content. Set alongside draft: true.
     * Current use: models whose manufacturer cannot be verified.
     */
    hold: z.string().optional(),

    // Set to false only once every fact on the page has been verified.
    placeholder: z.boolean().default(true),

    heroImage: imageSlot,
    gallery: z.array(imageSlot).default([]),

    // --- Specification blocks: all optional, all unverified until filled in ---
    capacity: z.string().optional(),
    dimensions: z.array(z.object({ label: z.string(), value: z.string() })).optional(),
    materials: z.array(z.string()).optional(),
    heaterOptions: z.array(z.string()).optional(),
    features: z.array(z.string()).optional(),
    specs: z.array(z.object({ label: z.string(), value: z.string() })).optional(),
    downloads: z
      .array(z.object({ label: z.string(), file: z.string().optional(), note: z.string().optional() }))
      .optional(),

    // --- Pricing architecture (founders: BUXENA WILL show prices) --------
    // All optional and ALL EMPTY until real, approved numbers exist.
    // The UI renders each line only when its field has a value, and shows
    // "Request Pricing" wherever a number is absent — so approved prices
    // can be inserted per model with a one-line frontmatter change and no
    // code work. Never populate from guesses.
    /**
     * PER-MODEL WARRANTY — architecture ready, ALL EMPTY until verified.
     * Each field takes the manufacturer's own stated term for THIS model
     * (e.g. "5 years structural, per Capra"). Where a field is absent the
     * site says "See applicable manufacturer warranty" instead — which is
     * the current state of every model. NEVER populate from assumption,
     * from another model, or from a competitor's published terms.
     */
    warranty: z
      .object({
        structural: z.string().optional(),
        workmanship: z.string().optional(),
        heater: z.string().optional(),
        controls: z.string().optional(),
        electrical: z.string().optional(),
        accessories: z.string().optional(),
        source: z.string().optional(),   // the supplier document the terms came from
      })
      .optional(),

    msrp: z.string().optional(),                 // internal reference, not auto-displayed
    fromPrice: z.string().optional(),            // "From $18,900" — sauna alone
    completeFromPrice: z.string().optional(),    // "Complete packages from $23,400"
    projectPricing: z.boolean().default(false),  // true → "Project Pricing" label
    deliveryEstimate: z.string().optional(),     // location-based wording, only if approved
    availability: z.enum(['in-stock', 'in-transit', 'preorder']).optional(),

    // --- Catalog facets (sourced from supplier product data) ---
    location: z.enum(['outdoor', 'indoor']).optional(),
    productType: z.string().optional(),   // e.g. "Barrel", "Cube"
    series: z.string().optional(),        // e.g. "EDA", "ITI", "AURA", "ELLA", "ILLI", "ALLA"
    capacityMin: z.number().optional(),
    capacityMax: z.number().optional(),
    options: z.array(z.string()).optional(),   // available options / upgrades
    delivery: z.string().optional(),           // delivery / installation information
  }),
});

/**
 * TRUST ARCHITECTURE — reviews & real projects.
 * Schemas only: BOTH collections are intentionally EMPTY. No fake
 * testimonials, no fake projects, ever. When a real review or a completed
 * customer project (with written photo permission) exists, add a markdown
 * file and the surfaces that consume these collections can start rendering.
 */
const reviews = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/reviews' }),
  schema: z.object({
    customerName: z.string(),          // first name / initial only, e.g. "Sarah K."
    cityState: z.string().optional(),  // "Fairfield, CT"
    product: z.string().optional(),    // internal model title (BUH-…)
    date: z.string(),                  // ISO date of the review
    verifiedPurchase: z.boolean().default(false),
    photoPermission: z.boolean().default(false), // written permission for any project photo
    rating: z.number().min(1).max(5).optional(),
  }),
});

const projects = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/projects' }),
  schema: z.object({
    title: z.string(),
    model: z.string(),                 // internal model title (BUH-…)
    location: z.string().optional(),   // "Hudson Valley, NY"
    images: z.array(z.object({ src: z.string(), alt: z.string() })).default([]),
    permissionStatus: z.enum(['granted-written', 'pending', 'none']).default('none'),
    date: z.string().optional(),
  }),
});

export const collections = { saunas, reviews, projects };
