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
  }),
});

export const collections = { saunas };
