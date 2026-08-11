/**
 * Suggested first-response drafts for Admin → Website Enquiries.
 *
 * Server-side only (imported by the admin enquiry detail page — never
 * shipped to the public bundle). Produces a subject + plain-text body the
 * founder reviews, personalizes and sends from their own mail app. NOTHING
 * here sends email: the output feeds a copy button and a mailto: link.
 *
 * HARD CONTENT RULES (same as everywhere on BUXENA V2): the drafts never
 * state prices, availability, delivery dates, installation promises,
 * warranty terms, technical specifications or supplier information. They
 * confirm, warm the relationship, and ask ONE qualifying question that
 * moves the sale to its next step.
 */

export interface EnquiryReplyInput {
  name?: string | null;
  phone?: string | null;
  location?: string | null;
  saunaInterest?: string | null;
  source?: string | null;
}

export interface EnquiryReply {
  /** Which template was chosen — shown to staff so the mapping is visible. */
  templateName: string;
  subject: string;
  body: string;
}

const clean = (v: string | null | undefined, max = 200) => (v ?? '').trim().slice(0, max);
const displayModel = (title: string) => title.replace(/^BUH-/i, '');
const sourceKey = (source: string) => source.toLowerCase().replace(/[^a-z]/g, '');

const SIGNATURE = ['Warm regards,', 'The BUXENA Team', 'info@buxena.com · buxena.com'].join('\n');

export function buildEnquiryReply(input: EnquiryReplyInput): EnquiryReply {
  const firstName = clean(input.name).split(/\s+/)[0] || '';
  const model = clean(input.saunaInterest) ? displayModel(clean(input.saunaInterest)) : '';
  const location = clean(input.location);
  const phone = clean(input.phone, 40);
  const key = sourceKey(clean(input.source));

  const hi = firstName ? `Hi ${firstName},` : 'Hello,';

  let templateName: string;
  let subject: string;
  let paragraphs: string[];

  if (key.startsWith('quoteform') || key === 'quotecomparison' || key === 'checkavailability') {
    templateName = 'Pricing request';
    subject = model ? `Your BUXENA quote — ${model}` : 'Your BUXENA quote';
    paragraphs = [
      model
        ? `Thank you for your pricing request for the ${model}. I'm preparing your written quote now — it will set out everything for your project clearly, with delivery shown as its own line${location ? ` (I've noted ${location} for that)` : ''}.`
        : `Thank you for your pricing request. I'm preparing your written quote now — it will set out everything for your project clearly, with delivery shown as its own line${location ? ` (I've noted ${location} for that)` : ''}.`,
      'So the quote fits your situation from the start: where will the sauna live — indoors, or outside on a deck, patio or garden base?',
      "Reply here and I'll take it from there.",
    ];
  } else if (key === 'warrantyclaim') {
    templateName = 'Warranty claim';
    subject = model ? `Your BUXENA warranty claim — ${model}` : 'Your BUXENA warranty claim';
    paragraphs = [
      `Thank you for sending this through${model ? ` about your ${model}` : ''}. I have your details and photographs, and a specialist is reviewing them now.`,
      'So we can place it accurately: roughly when did you first notice it, and has it changed since?',
      'We will confirm whether this is a natural characteristic of the timber, a maintenance matter, or something to take up under the applicable manufacturer warranty.',
    ];
  } else if (key === 'consultationrequest') {
    templateName = 'Consultation request';
    subject = 'Your BUXENA consultation';
    paragraphs = [
      `Thank you for requesting a consultation${model ? ` about the ${model}` : ''}. I'd be glad to talk through your project — the space, the models worth considering, and what the process looks like from here.`,
      phone
        ? `Is ${phone} the best number to reach you on, and what days and times generally suit you for a call?`
        : 'What days and times generally suit you for a call?',
    ];
  } else if (key === 'fortrade') {
    templateName = 'Trade / professional';
    subject = 'Your project with BUXENA';
    paragraphs = [
      'Thank you for getting in touch about your project. We work with architects, builders and developers from early planning through supply, and I would like to understand your project properly before suggesting anything.',
      'Could you share a little more about it — the setting, the number of units, and where you are in the timeline?',
    ];
  } else if (key === 'projectintake' || key === 'seeitinmyspace' || key === 'planyoursauna') {
    templateName = 'Project details / space';
    subject = model ? `Your BUXENA project — ${model}` : 'Your BUXENA project';
    paragraphs = [
      `Thank you for sharing your project details${model ? ` — the ${model} is a good starting point` : ''}. A specialist is reviewing what you sent; the next step is a recommendation matched to your space, followed by a written quote.`,
      'One thing that helps us get it right: is power already available where the sauna will sit, or would that be part of the project?',
    ];
  } else {
    templateName = 'General enquiry';
    subject = model ? `Your BUXENA enquiry — ${model}` : 'Your BUXENA enquiry';
    paragraphs = [
      `Thank you for reaching out${model ? ` about the ${model}` : ''}.`,
      'We’d be happy to help you find the right sauna for your space and how you plan to use it.',
      'To help us narrow down the best options, will the sauna be installed indoors or outdoors?',
    ];
  }

  const body = [hi, '', paragraphs.join('\n\n'), '', SIGNATURE].join('\n');
  return { templateName, subject, body };
}

/**
 * mailto: URL with recipient, subject and body pre-filled. Line breaks are
 * CRLF-encoded per RFC 6068 so every mail client renders real paragraphs.
 * Opening this link only DRAFTS the email in the founder's own mail app —
 * nothing can send without them pressing Send there.
 */
export function buildMailtoHref(email: string, reply: EnquiryReply): string {
  const subject = encodeURIComponent(reply.subject);
  const body = encodeURIComponent(reply.body.replace(/\n/g, '\r\n'));
  // Recipient stays in its plain form (the one every mail client accepts);
  // strip only characters that could break out of the address slot. The
  // address was already format-validated when the enquiry was captured.
  const to = email.trim().replace(/[?#&\s"<>\r\n]/g, '');
  return `mailto:${to}?subject=${subject}&body=${body}`;
}
