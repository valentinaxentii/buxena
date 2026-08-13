import type { PDFPage } from 'pdf-lib';
import {
  PAGE_W, PAGE_H, MARGIN, FOOTER_CLEARANCE,
  INK, SECONDARY, BRONZE, HAIRLINE,
  wrapText,
  createReportDoc, newReportPage, drawDocHeader, drawDocFooter, drawPageNumbers,
  type ReportDocContext,
} from './report-kit.ts';
import { DOC_TYPE, DOC_LOGO } from '../doc-theme.ts';

/**
 * Customer quote PDF — migrated onto the shared document design (white paper,
 * 0.6in margins, unified header/footer/table treatment). The quote's CONTENT
 * is unchanged: same fields, same values, same cover and closing structure,
 * same italic tagline on those two pages, same terms copy.
 */

export interface QuotePdfData {
  quote: {
    quote_number: string | null;
    status: string;
    heater: string | null;
    accessories: unknown;
    delivery_cost: number | null;
    installation_cost: number | null;
    discount: number | null;
    tax_rate: number | null;
    subtotal: number | null;
    total: number | null;
    quote_date: string | null;
    expiry_date: string | null;
  };
  customer: { name: string; email: string | null; phone: string | null } | null;
  product: {
    model_name: string;
    category: string | null;
    dimensions: { width?: string; depth?: string; height?: string; unit?: string } | null;
    capacity: string | null;
    timber_type: string | null;
    glass_configuration: string | null;
    heater_options: string[] | null;
    electrical_requirements: string | null;
    images: string[] | null;
  } | null;
  items: { description: string; quantity: number; unit_price: number; line_total: number }[];
  company: {
    name: string;
    email: string;
    website: string | null;
    tagline: string;
    currency: string;
    address?: string | null;
    ein?: string | null;
    phone?: string | null;
  };
}

function warrantySummary(companyName: string): string {
  return `${companyName} saunas are backed by a manufacturer warranty covering structural and heater components against defects in materials and workmanship. Full warranty terms and duration are provided in the product warranty documentation and confirmed at the time of order.`;
}

function paymentTerms(companyName: string): string {
  return `Payment terms are confirmed directly with the ${companyName} sales team at the time of order confirmation and will be set out in full in your order agreement.`;
}

const EXCLUSIONS_NOTE =
  'This proposal is an estimate based on the configuration above and is subject to site inspection, final measurements, and product availability at the time of order. Delivery and installation timelines are estimates and may vary by season, region, and shipping conditions.';

const TIMELINE_NOTES = [
  'Production typically begins once deposit and specifications are confirmed.',
  'Ocean freight and customs clearance follow standard international shipping timelines.',
  'Domestic delivery is scheduled once the unit clears the destination port and warehouse.',
  'Installation is scheduled with the customer once the unit is on site.',
];

const SITE_READINESS_NOTES = [
  'A level, prepared pad or foundation suitable for the sauna’s footprint and weight.',
  'Clear access path for delivery equipment to the installation site.',
  'Electrical supply matching the heater’s requirements, installed by a licensed electrician.',
  'Any required permits or approvals in place prior to installation.',
];

export function missingQuoteFields(data: Pick<QuotePdfData, 'quote' | 'customer' | 'product' | 'items'>): string[] {
  const missing: string[] = [];
  if (!data.customer) missing.push('Customer');
  if (!data.product) missing.push('Sauna Model');
  if (!data.items || data.items.length === 0) missing.push('At least one line item');
  return missing;
}

export async function buildQuotePdf(data: QuotePdfData): Promise<Uint8Array> {
  const ctx = await createReportDoc(
    {
      name: data.company.name,
      email: data.company.email,
      website: data.company.website,
      tagline: data.company.tagline,
      address: data.company.address ?? null,
      ein: data.company.ein ?? null,
      phone: data.company.phone ?? null,
    },
    `Sauna Proposal ${data.quote.quote_number ?? ''}`.trim()
  );
  const { regular, bold, serifBold, serifItalic } = ctx;

  function money(n: number | null | undefined): string {
    try {
      return new Intl.NumberFormat('en-US', { style: 'currency', currency: data.company.currency || 'USD' }).format(Number(n) || 0);
    } catch {
      return `$${(Number(n) || 0).toFixed(2)}`;
    }
  }

  let productImage: Awaited<ReturnType<typeof ctx.doc.embedPng>> | null = null;
  const firstImageUrl = data.product?.images?.[0];
  if (firstImageUrl) {
    try {
      const res = await fetch(firstImageUrl);
      if (res.ok) {
        const bytes = new Uint8Array(await res.arrayBuffer());
        const contentType = res.headers.get('content-type') ?? '';
        productImage = contentType.includes('png') || firstImageUrl.toLowerCase().endsWith('.png')
          ? await ctx.doc.embedPng(bytes)
          : await ctx.doc.embedJpg(bytes);
      }
    } catch {
      productImage = null;
    }
  }

  function sectionHeading(page: PDFPage, text: string, y: number): number {
    page.drawText(text, { x: MARGIN, y, size: 11, font: serifBold, color: INK });
    page.drawLine({ start: { x: MARGIN, y: y - 6 }, end: { x: PAGE_W - MARGIN, y: y - 6 }, thickness: 0.75, color: BRONZE });
    return y - 24;
  }

  function labelValueRow(page: PDFPage, label: string, value: string, y: number): number {
    page.drawText(label, { x: MARGIN, y, size: 9, font: bold, color: INK });
    const lines = wrapText(value || '—', regular, 9.5, PAGE_W - MARGIN * 2 - 160);
    lines.forEach((line, i) => {
      page.drawText(line, { x: MARGIN + 160, y: y - i * 12, size: 9.5, font: regular, color: INK });
    });
    return y - Math.max(1, lines.length) * 12 - 8;
  }

  // ---------------------------------------------------------------- Cover
  {
    const page = newReportPage(ctx);
    const logoDims = ctx.logo.scale(150 / ctx.logo.width);
    page.drawImage(ctx.logo, {
      x: (PAGE_W - logoDims.width) / 2,
      y: PAGE_H - MARGIN - logoDims.height,
      width: logoDims.width,
      height: logoDims.height,
    });

    const title = 'PRIVATE SAUNA PROPOSAL';
    const titleSize = 22;
    const titleWidth = serifBold.widthOfTextAtSize(title, titleSize);
    page.drawText(title, { x: (PAGE_W - titleWidth) / 2, y: PAGE_H - MARGIN - logoDims.height - 46, size: titleSize, font: serifBold, color: INK });

    if (productImage) {
      const maxW = PAGE_W - MARGIN * 2;
      const maxH = 290;
      const scale = Math.min(maxW / productImage.width, maxH / productImage.height);
      const w = productImage.width * scale;
      const h = productImage.height * scale;
      page.drawImage(productImage, { x: (PAGE_W - w) / 2, y: PAGE_H - 320 - h, width: w, height: h });
    }

    const infoY = productImage ? 250 : 420;
    const rows: [string, string][] = [
      ['PREPARED FOR', data.customer?.name ?? '—'],
      ['QUOTE NUMBER', data.quote.quote_number ?? '—'],
      ['DATE', data.quote.quote_date ?? '—'],
      ['SAUNA MODEL', data.product?.model_name ?? '—'],
    ];
    let y = infoY;
    for (const [label, value] of rows) {
      const labelWidth = bold.widthOfTextAtSize(label, 8);
      page.drawText(label, { x: (PAGE_W - labelWidth) / 2, y, size: 8, font: bold, color: SECONDARY });
      const valueWidth = regular.widthOfTextAtSize(value, 13);
      page.drawText(value, { x: (PAGE_W - valueWidth) / 2, y: y - 16, size: 13, font: regular, color: INK });
      y -= 48;
    }

    const tagline = data.company.tagline;
    const taglineWidth = serifItalic.widthOfTextAtSize(tagline, 13);
    page.drawText(tagline, { x: (PAGE_W - taglineWidth) / 2, y: FOOTER_CLEARANCE + 14, size: 13, font: serifItalic, color: BRONZE });
    drawDocFooter(ctx, page);
  }

  // ------------------------------------------------- Page 2 — Selected Sauna
  {
    const page = newReportPage(ctx);
    let y = drawDocHeader(ctx, page, 'The Selected Sauna', []);

    if (productImage) {
      const maxW = PAGE_W - MARGIN * 2;
      const maxH = 200;
      const scale = Math.min(maxW / productImage.width, maxH / productImage.height);
      const w = productImage.width * scale;
      const h = productImage.height * scale;
      page.drawImage(productImage, { x: (PAGE_W - w) / 2, y: y - h, width: w, height: h });
      y -= h + 24;
    }

    page.drawText(data.product?.model_name ?? '—', { x: MARGIN, y, size: 14, font: serifBold, color: INK });
    y -= 28;

    const dims = data.product?.dimensions;
    const dimsText = dims && (dims.width || dims.depth || dims.height)
      ? `${dims.width ?? '—'} × ${dims.depth ?? '—'} × ${dims.height ?? '—'} ${dims.unit ?? ''}`.trim()
      : '—';

    const specs: [string, string][] = [
      ['Category', data.product?.category ?? '—'],
      ['Dimensions', dimsText],
      ['Capacity', data.product?.capacity ?? '—'],
      ['Timber / Material', data.product?.timber_type ?? '—'],
      ['Glass Configuration', data.product?.glass_configuration ?? '—'],
      ['Heater', data.quote.heater || data.product?.heater_options?.join(', ') || '—'],
      ['Electrical Requirements', data.product?.electrical_requirements ?? '—'],
    ];
    for (const [label, value] of specs) {
      y = labelValueRow(page, label, value, y);
    }
    drawDocFooter(ctx, page);
  }

  // ------------------------------------------------- Page 3 — Configuration
  {
    const page = newReportPage(ctx);
    let y = drawDocHeader(ctx, page, 'Your Configuration', []);

    let accessoriesText = 'None selected';
    if (Array.isArray(data.quote.accessories) && data.quote.accessories.length) {
      accessoriesText = data.quote.accessories.map((a) => String(a)).join(', ');
    } else if (data.quote.accessories && typeof data.quote.accessories === 'object') {
      const vals = Object.values(data.quote.accessories as Record<string, unknown>).filter(Boolean);
      if (vals.length) accessoriesText = vals.map((v) => String(v)).join(', ');
    }

    const rows: [string, string][] = [
      ['Sauna', data.product?.model_name ?? '—'],
      ['Heater', data.quote.heater || '—'],
      ['Accessories', accessoriesText],
      ['Delivery', Number(data.quote.delivery_cost) > 0 ? 'Priced in this proposal' : 'Not priced in this proposal — confirm before order'],
      ['Installation', Number(data.quote.installation_cost) > 0 ? 'Priced in this proposal' : 'Not priced in this proposal — confirm before order'],
    ];
    for (const [label, value] of rows) {
      y = labelValueRow(page, label, value, y);
    }
    drawDocFooter(ctx, page);
  }

  // ------------------------------------------------- Page 4 — Investment
  {
    const page = newReportPage(ctx);
    let y = drawDocHeader(ctx, page, 'Investment', []);

    // shared table treatment: bold 7pt headers, 2pt black rule, #ddd dividers,
    // last column flush to the right margin
    const colDesc = MARGIN;
    const colQty = PAGE_W - MARGIN - 210;
    const colPrice = PAGE_W - MARGIN - 150;
    const colTotalRight = PAGE_W - MARGIN;

    page.drawText('DESCRIPTION', { x: colDesc, y, size: DOC_TYPE.tableHeaderPt, font: bold, color: INK });
    page.drawText('QTY', { x: colQty, y, size: DOC_TYPE.tableHeaderPt, font: bold, color: INK });
    page.drawText('UNIT PRICE', { x: colPrice, y, size: DOC_TYPE.tableHeaderPt, font: bold, color: INK });
    const ltLabel = 'LINE TOTAL';
    page.drawText(ltLabel, { x: colTotalRight - bold.widthOfTextAtSize(ltLabel, DOC_TYPE.tableHeaderPt), y, size: DOC_TYPE.tableHeaderPt, font: bold, color: INK });
    y -= 5;
    page.drawLine({ start: { x: MARGIN, y }, end: { x: PAGE_W - MARGIN, y }, thickness: DOC_TYPE.tableHeaderRulePt, color: INK });
    y -= 15;

    for (const item of data.items) {
      const lines = wrapText(item.description, regular, 9.5, colQty - colDesc - 10);
      lines.forEach((line, i) => {
        page.drawText(line, { x: colDesc, y: y - i * 12, size: 9.5, font: regular, color: INK });
      });
      page.drawText(String(item.quantity), { x: colQty, y, size: 9.5, font: regular, color: INK });
      page.drawText(money(item.unit_price), { x: colPrice, y, size: 9.5, font: regular, color: INK });
      const lt = money(item.line_total);
      page.drawText(lt, { x: colTotalRight - regular.widthOfTextAtSize(lt, 9.5), y, size: 9.5, font: regular, color: INK });
      const rowH = Math.max(1, lines.length) * 12 + 8;
      page.drawLine({ start: { x: MARGIN, y: y - rowH + 9 }, end: { x: PAGE_W - MARGIN, y: y - rowH + 9 }, thickness: 0.5, color: HAIRLINE });
      y -= rowH;
    }

    y -= 14;
    const totals: [string, string][] = [
      ['Subtotal', money(data.quote.subtotal)],
      ['Delivery', money(data.quote.delivery_cost)],
      ['Installation', money(data.quote.installation_cost)],
      ['Discount', `-${money(data.quote.discount)}`],
      ['Tax', `${Number(data.quote.tax_rate) || 0}%`],
    ];
    for (const [label, value] of totals) {
      page.drawText(label, { x: colPrice - 60, y, size: 9.5, font: regular, color: INK });
      page.drawText(value, { x: colTotalRight - regular.widthOfTextAtSize(value, 9.5), y, size: 9.5, font: regular, color: INK });
      y -= 16;
    }

    y -= 4;
    page.drawLine({ start: { x: colPrice - 60, y: y + 12 }, end: { x: PAGE_W - MARGIN, y: y + 12 }, thickness: 1, color: INK });
    const totalLabel = `TOTAL (${data.company.currency || 'USD'})`;
    page.drawText(totalLabel, { x: colPrice - 60, y, size: 11, font: bold, color: INK });
    const totalVal = money(data.quote.total);
    page.drawText(totalVal, { x: colTotalRight - bold.widthOfTextAtSize(totalVal, 11), y, size: 11, font: bold, color: INK });

    drawDocFooter(ctx, page);
  }

  // -------------------------------------- Page 5 — Delivery & Installation
  {
    const page = newReportPage(ctx);
    let y = drawDocHeader(ctx, page, 'Delivery & Installation', []);

    y = sectionHeading(page, 'Estimated Process', y);
    for (const note of TIMELINE_NOTES) {
      for (const line of wrapText(`• ${note}`, regular, 9.5, PAGE_W - MARGIN * 2)) {
        page.drawText(line, { x: MARGIN, y, size: 9.5, font: regular, color: INK });
        y -= 14;
      }
      y -= 2;
    }

    y -= 16;
    y = sectionHeading(page, 'Site Readiness', y);
    for (const note of SITE_READINESS_NOTES) {
      for (const line of wrapText(`• ${note}`, regular, 9.5, PAGE_W - MARGIN * 2)) {
        page.drawText(line, { x: MARGIN, y, size: 9.5, font: regular, color: INK });
        y -= 14;
      }
      y -= 2;
    }
    drawDocFooter(ctx, page);
  }

  // ------------------------------------------- Page 6 — Warranty / Terms
  {
    const page = newReportPage(ctx);
    let y = drawDocHeader(ctx, page, 'Warranty & Terms', []);

    y = sectionHeading(page, 'Warranty', y);
    for (const line of wrapText(warrantySummary(data.company.name), regular, 9.5, PAGE_W - MARGIN * 2)) {
      page.drawText(line, { x: MARGIN, y, size: 9.5, font: regular, color: INK });
      y -= 14;
    }

    y -= 16;
    y = sectionHeading(page, 'Quote Validity', y);
    page.drawText(`This proposal is valid until ${data.quote.expiry_date ?? `the date noted by your ${data.company.name} representative`}.`, {
      x: MARGIN, y, size: 9.5, font: regular, color: INK,
    });
    y -= 28;

    y = sectionHeading(page, 'Payment Terms', y);
    for (const line of wrapText(paymentTerms(data.company.name), regular, 9.5, PAGE_W - MARGIN * 2)) {
      page.drawText(line, { x: MARGIN, y, size: 9.5, font: regular, color: INK });
      y -= 14;
    }

    y -= 16;
    y = sectionHeading(page, 'Before You Proceed', y);
    const decisionNote = 'Review the itemized configuration, site requirements and expiry date with your BUXENA representative. The order is confirmed only after both sides agree the final specifications, availability and order agreement.';
    for (const line of wrapText(decisionNote, regular, 9.5, PAGE_W - MARGIN * 2)) {
      page.drawText(line, { x: MARGIN, y, size: 9.5, font: regular, color: INK });
      y -= 14;
    }

    y -= 16;
    y = sectionHeading(page, 'Notes & Exclusions', y);
    for (const line of wrapText(EXCLUSIONS_NOTE, regular, 9.5, PAGE_W - MARGIN * 2)) {
      page.drawText(line, { x: MARGIN, y, size: 9.5, font: regular, color: INK });
      y -= 14;
    }

    // closing block — structure kept: small logo, italic tagline, contact line
    y = Math.max(y - 46, FOOTER_CLEARANCE + 66);
    const logoDims = ctx.logo.scale(90 / ctx.logo.width);
    page.drawImage(ctx.logo, { x: (PAGE_W - logoDims.width) / 2, y, width: logoDims.width, height: logoDims.height });
    y -= 16;
    const closingTagline = data.company.tagline;
    const closingWidth = serifItalic.widthOfTextAtSize(closingTagline, 11);
    page.drawText(closingTagline, { x: (PAGE_W - closingWidth) / 2, y, size: 11, font: serifItalic, color: BRONZE });
    y -= 15;
    const contact = [data.company.email, data.company.website].filter(Boolean).join('  ·  ');
    const contactWidth = regular.widthOfTextAtSize(contact, 8.5);
    page.drawText(contact, { x: (PAGE_W - contactWidth) / 2, y, size: 8.5, font: regular, color: SECONDARY });

    drawDocFooter(ctx, page);
  }

  drawPageNumbers(ctx);
  return ctx.doc.save();
}
