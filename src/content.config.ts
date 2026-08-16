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
 * TECHNICAL ASSET STATES.
 *
 * Every slot carries one, and the default is MISSING — the honest answer for
 * a catalogue where no supplier has yet sent a drawing, a manual or a video.
 *
 *   VERIFIED       we hold it, it is correct, and we may publish it
 *   REQUESTED      asked for; waiting on the supplier
 *   MISSING        not held and not yet asked for
 *   UNVERIFIED     held, but not confirmed correct or not cleared for use
 *   NOT_APPLICABLE genuinely does not exist for this model (e.g. no chimney)
 *   INTERNAL_ONLY  held, correct, but never for customers (cost sheets)
 *
 * Only VERIFIED can ever reach a customer, and only with written permission
 * as well — see `technicalAsset` below.
 */
const assetStatus = z.enum([
  'VERIFIED',
  'REQUESTED',
  'MISSING',
  'UNVERIFIED',
  'NOT_APPLICABLE',
  'INTERNAL_ONLY',
]);

/**
 * A technical document, drawing or file.
 *
 * PUBLICATION NEEDS THREE THINGS, and every default refuses:
 *   status: 'VERIFIED'          — we know it is right
 *   permission: 'granted-written' — the supplier said in writing we may use it
 *   url                          — there is actually something to open
 *
 * `docs/image-rights-register.md` exists because publication permission was
 * once assumed rather than recorded. 0 of 35 assets currently have written
 * permission, so nothing here publishes today — which is the correct state,
 * not a bug.
 */
const technicalAsset = z.object({
  status: assetStatus.default('MISSING'),
  url: z.string().optional(),
  title: z.string().optional(),
  /** Who supplied it — used by the gap report, never shown to customers. */
  source: z.string().optional(),
  permission: z.enum(['granted-written', 'pending', 'none']).default('none'),
  note: z.string().optional(),
});

/** An approved installation or assembly video. */
const technicalVideo = technicalAsset.extend({
  provider: z.enum(['youtube', 'vimeo', 'url']).optional(),
  /** Poster frame. Without one the player shows a neutral panel, never a guess. */
  poster: z.string().optional(),
  /** Seconds — shown on the button so nobody starts a 40-minute film by accident. */
  durationSeconds: z.number().optional(),
});

/** A 3D model or an approved external viewer. */
const technicalModel = technicalAsset.extend({
  provider: z.enum(['sketchfab', 'glb', 'external']).optional(),
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

    /**
     * TECHNICAL ASSETS — drawings, manuals, video, 3D.
     *
     * ARCHITECTURE ONLY UNTIL SUPPLIERS ANSWER. Every slot is optional and
     * every one is empty today. The product page renders an action for a slot
     * only when it is VERIFIED, permitted in writing, and has a URL — so a
     * model with no assets shows no buttons, no empty tabs and no "coming
     * soon", exactly like every other unverified field in this schema.
     *
     * `imagePermission` tracks the gallery photography rather than a document:
     * it is the answer blocking 48 assets in docs/image-rights-register.md and
     * gates paid advertising, so it is worth reporting alongside the rest.
     */
    technicalAssets: z
      .object({
        installationVideo: technicalVideo.optional(),
        assemblyVideo: technicalVideo.optional(),
        floorPlan: technicalAsset.optional(),
        dimensionDrawing: technicalAsset.optional(),
        elevations: technicalAsset.optional(),
        benchLayout: technicalAsset.optional(),
        installationManual: technicalAsset.optional(),
        electricalGuide: technicalAsset.optional(),
        foundationGuide: technicalAsset.optional(),
        heaterManual: technicalAsset.optional(),
        warrantyDocument: technicalAsset.optional(),
        packagingDimensions: technicalAsset.optional(),
        packagingPhotos: technicalAsset.optional(),
        unloadingInstructions: technicalAsset.optional(),
        threeD: technicalModel.optional(),
        imagePermission: technicalAsset.optional(),
      })
      .optional(),

    // --- Catalog facets (sourced from supplier product data) ---
    location: z.enum(['outdoor', 'indoor']).optional(),
    productType: z.string().optional(),   // e.g. "Barrel", "Cube"
    series: z.string().optional(),        // e.g. "EDA", "ITI", "AURA", "ELLA", "ILLI", "ALLA"
    capacityMin: z.number().optional(),
    capacityMax: z.number().optional(),
    options: z.array(z.string()).optional(),   // available options / upgrades
    delivery: z.string().optional(),           // delivery / installation information
    /**
     * Sales clarity record. Fields remain absent until verified for this
     * specific model; the public page then uses safe proposal fallbacks.
     */
    salesFacts: z.object({
      inclusions: z.array(z.string()).optional(),
      exclusions: z.array(z.string()).optional(),
      deliveryTiming: z.string().optional(),
      assembly: z.string().optional(),
      siteRequirements: z.array(z.string()).optional(),
      electrical: z.string().optional(),
      warranty: z.string().optional(),
      optionalServices: z.array(z.string()).optional(),
      source: z.string().optional(), // internal audit reference; never rendered
    }).optional(),
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

    // The quote itself — the customer's own sentence, unedited. Optional like
    // every other field here; the render layer additionally requires it
    // (alongside `approved`) before a card can appear.
    quote: z.string().optional(),

    // A real customer photo, only ever rendered alongside photoPermission: true.
    image: imageSlot.optional(),

    /**
     * THE PUBLICATION GATE. `verifiedPurchase` records a purchase fact;
     * `approved` is the separate, deliberate decision that this specific
     * record may go on the public site. Defaults to false so a review added
     * for internal record-keeping (a draft, one still being confirmed with
     * the customer) never renders just because the file exists.
     */
    approved: z.boolean().default(false),

    // Who granted permission and how — an audit trail, matching the pattern
    // already used for technicalAsset.source/permission above. Never shown
    // to customers.
    permissionSource: z.string().optional(),
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
