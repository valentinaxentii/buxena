/**
 * BUXENA — client-side conversion event layer.
 *
 * DELIBERATELY PROVIDER-AGNOSTIC. This file installs NO advertising or
 * analytics vendor: no GA4 property, no Google Ads conversion ID, no Meta
 * Pixel, no Pinterest tag. Nothing here sends a network request on its own.
 *
 * Events are pushed onto `window.dataLayer` — the same queue GTM/GA4 read
 * from. When a real property/pixel ID is approved, adding the vendor's own
 * snippet in BaseLayout is the ONLY change needed: every event below is
 * already firing and will be picked up retroactively from the queue, because
 * dataLayer is a persistent array, not a live stream.
 *
 * Until then this is a self-contained, zero-third-party audit trail that can
 * be inspected in the browser console via `window.dataLayer`.
 */

/** Every conversion-relevant event the site can emit. */
export type TrackEvent =
  | 'product_view'
  | 'category_view'
  | 'pricing_request_started'
  | 'pricing_request_submitted'
  | 'availability_request'
  | 'advisor_started'
  | 'advisor_question_answered'
  | 'advisor_completed'
  | 'model_recommended'
  | 'advisor_model_view'
  | 'advisor_compare_click'
  | 'advisor_space_visualization_click'
  | 'advisor_pricing_click'
  | 'phone_click'
  | 'email_click'
  | 'specification_download'
  | 'quote_started'
  | 'quote_submitted'
  | 'package_view'
  | 'package_selected'
  | 'build_package_click'
  | 'project_pricing_click'
  | 'how_it_works_view'
  | 'upload_project_click'
  | 'find_my_sauna_click'
  | 'request_pricing_click'
  | 'trade_project_submitted'
  | 'final_cta_view'
  | 'final_pricing_click'
  | 'final_upload_project_click'
  | 'final_advisor_click'
  | 'footer_pricing_click'
  | 'social_click'
  | 'space_flow_started'
  | 'space_photo_uploaded'
  | 'space_flow_completed'
  | 'space_model_recommended'
  | 'space_pricing_click'
  | 'space_specialist_click'
  | 'product_gallery_view'
  | 'product_configure_click'
  // Interactive configurator (components/ProductConfigurator.astro). These are
  // the funnel steps between "looked at the model" and "asked for a quote", so
  // they are what shows whether configuring actually converts.
  | 'product_option_selected'
  | 'product_zip_entered'
  | 'product_quote_cta'
  // Technical resources (components/ProductResources.astro). A customer who
  // opens a floor plan or an installation video is qualifying themselves.
  | 'product_resource_opened'
  | 'product_video_opened'
  | 'product_3d_opened'
  | 'product_availability_click'
  | 'product_package_view'
  | 'product_package_selected'
  | 'product_spec_download'
  | 'product_trade_click'
  | 'product_upload_project_click'
  | 'specification_request_click'
  | 'document_download'
  | 'form_error'
  | 'form_success'
  | 'project_upload_started'
  | 'project_upload_completed'
  | 'space_compare_click'
  | 'consultation_request_started'
  | 'consultation_request_submitted'
  | 'compare_view'
  | 'compare_pricing_click'
  // THE conversion event — fired on /thank-you/ when an enquiry completes.
  // This is what GA4/Meta should count as a lead, not the submit click.
  | 'lead_confirmed'
  | 'thank_you_direct_visit'
  | 'trade_specification_request'
  | 'presentation_download';

/**
 * Context carried with every lead so the CRM and ad platforms can attribute
 * it. Mirrors the fields the brief asks leads to arrive with.
 */
export interface TrackPayload {
  model?: string;
  category?: string;
  location?: 'indoor' | 'outdoor' | string;
  zip?: string;
  state?: string;
  timeline?: string;
  budget?: string;
  package?: string;
  formType?: string;
  [key: string]: unknown;
}

declare global {
  interface Window {
    dataLayer?: Record<string, unknown>[];
  }
}

/** First-touch campaign attribution, read from the URL and the referrer. */
export function campaignContext(): Record<string, string> {
  if (typeof window === 'undefined') return {};

  const params = new URLSearchParams(window.location.search);
  const utm: Record<string, string> = {};

  for (const key of ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'gclid', 'fbclid']) {
    const value = params.get(key);
    if (value) utm[key] = value;
  }

  return {
    ...utm,
    landing_page: window.location.pathname,
    ...(document.referrer ? { referrer: document.referrer } : {}),
  };
}

/**
 * Push a conversion event onto the dataLayer queue.
 * Safe to call before any tag manager exists — the array is created on demand.
 */
export function track(event: TrackEvent, payload: TrackPayload = {}): void {
  if (typeof window === 'undefined') return;

  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({
    event,
    ...campaignContext(),
    ...payload,
  });
}
