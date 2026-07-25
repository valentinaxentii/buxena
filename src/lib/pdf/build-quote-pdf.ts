import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage, type RGB } from 'pdf-lib';
import { BUXENA_LOGO_ESPRESSO_PNG_BASE64 } from './logo-base64';

const PAGE_W = 612;
const PAGE_H = 792;
const MARGIN = 56;

const CREAM = hex('#F6F2EA');
const CHARCOAL = hex('#14120F');
const GOLD = hex('#B8935F');
const MUTED = hex('#6B655A');

function hex(h: string): RGB {
  const n = parseInt(h.replace('#', ''), 16);
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
}

function letterSpaced(text: string): string {
  return text.toUpperCase().split('').join(' ');
}

function wrapText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);
  return lines;
}

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
  const doc = await PDFDocument.create();
  doc.setTitle(`${data.company.name} Sauna Proposal ${data.quote.quote_number ?? ''}`.trim());
  doc.setAuthor(data.company.name);

  function money(n: number | null | undefined): string {
    try {
      return new Intl.NumberFormat('en-US', { style: 'currency', currency: data.company.currency || 'USD' }).format(Number(n) || 0);
    } catch {
      return `$${(Number(n) || 0).toFixed(2)}`;
    }
  }

  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const italic = await doc.embedFont(StandardFonts.HelveticaOblique);

  const logoBytes = Buffer.from(BUXENA_LOGO_ESPRESSO_PNG_BASE64, 'base64');
  const logo = await doc.embedPng(logoBytes);

  let productImage: Awaited<ReturnType<typeof doc.embedPng>> | null = null;
  const firstImageUrl = data.product?.images?.[0];
  if (firstImageUrl) {
    try {
      const res = await fetch(firstImageUrl);
      if (res.ok) {
        const bytes = new Uint8Array(await res.arrayBuffer());
        const contentType = res.headers.get('content-type') ?? '';
        productImage = contentType.includes('png') || firstImageUrl.toLowerCase().endsWith('.png')
          ? await doc.embedPng(bytes)
          : await doc.embedJpg(bytes);
      }
    } catch {
      productImage = null;
    }
  }

  let pageNum = 0;
  function newPage(): PDFPage {
    const page = doc.addPage([PAGE_W, PAGE_H]);
    page.drawRectangle({ x: 0, y: 0, width: PAGE_W, height: PAGE_H, color: CREAM });
    pageNum += 1;
    return page;
  }

  function footer(page: PDFPage) {
    const parts = [data.company.name, data.company.tagline, data.company.email, data.company.website].filter(Boolean);
    const text = parts.join('  ·  ');
    const size = 8;
    const width = regular.widthOfTextAtSize(text, size);
    page.drawText(text, { x: (PAGE_W - width) / 2, y: 34, size, font: regular, color: MUTED });
    const pageLabel = String(pageNum);
    page.drawText(pageLabel, {
      x: PAGE_W - MARGIN - regular.widthOfTextAtSize(pageLabel, 8),
      y: 34,
      size: 8,
      font: regular,
      color: MUTED,
    });
  }

  function sectionHeading(page: PDFPage, text: string, y: number): number {
    page.drawText(letterSpaced(text), { x: MARGIN, y, size: 11, font: bold, color: GOLD });
    page.drawLine({
      start: { x: MARGIN, y: y - 8 },
      end: { x: PAGE_W - MARGIN, y: y - 8 },
      thickness: 0.75,
      color: GOLD,
    });
    return y - 30;
  }

  function labelValueRow(page: PDFPage, label: string, value: string, y: number): number {
    page.drawText(label, { x: MARGIN, y, size: 9.5, font: bold, color: CHARCOAL });
    const lines = wrapText(value || '—', regular, 10.5, PAGE_W - MARGIN * 2 - 170);
    lines.forEach((line, i) => {
      page.drawText(line, { x: MARGIN + 170, y: y - i * 13, size: 10.5, font: regular, color: CHARCOAL });
    });
    return y - Math.max(1, lines.length) * 13 - 10;
  }

  // ---------------------------------------------------------------- Page 1
  {
    const page = newPage();
    const logoDims = logo.scale(150 / logo.width);
    page.drawImage(logo, {
      x: (PAGE_W - logoDims.width) / 2,
      y: PAGE_H - 150,
      width: logoDims.width,
      height: logoDims.height,
    });

    const title = 'PRIVATE SAUNA PROPOSAL';
    const titleSpaced = letterSpaced(title);
    const titleSize = 20;
    const titleWidth = bold.widthOfTextAtSize(titleSpaced, titleSize);
    page.drawText(titleSpaced, { x: (PAGE_W - titleWidth) / 2, y: PAGE_H - 230, size: titleSize, font: bold, color: CHARCOAL });

    if (productImage) {
      const maxW = PAGE_W - MARGIN * 2;
      const maxH = 300;
      const scale = Math.min(maxW / productImage.width, maxH / productImage.height);
      const w = productImage.width * scale;
      const h = productImage.height * scale;
      page.drawImage(productImage, { x: (PAGE_W - w) / 2, y: PAGE_H - 300 - h - 30, width: w, height: h });
    }

    const infoY = productImage ? 260 : 420;
    const rows: [string, string][] = [
      ['Prepared for', data.customer?.name ?? '—'],
      ['Quote Number', data.quote.quote_number ?? '—'],
      ['Date', data.quote.quote_date ?? '—'],
      ['Sauna Model', data.product?.model_name ?? '—'],
    ];
    let y = infoY;
    for (const [label, value] of rows) {
      const labelSize = 9;
      const labelText = letterSpaced(label);
      const labelWidth = bold.widthOfTextAtSize(labelText, labelSize);
      page.drawText(labelText, { x: (PAGE_W - labelWidth) / 2, y, size: labelSize, font: bold, color: MUTED });
      const valueSize = 13;
      const valueWidth = regular.widthOfTextAtSize(value, valueSize);
      page.drawText(value, { x: (PAGE_W - valueWidth) / 2, y: y - 18, size: valueSize, font: regular, color: CHARCOAL });
      y -= 52;
    }

    const tagline = data.company.tagline;
    const taglineWidth = italic.widthOfTextAtSize(tagline, 13);
    page.drawText(tagline, { x: (PAGE_W - taglineWidth) / 2, y: 70, size: 13, font: italic, color: GOLD });
    footer(page);
  }

  // ---------------------------------------------------------------- Page 2 — Selected Sauna
  {
    const page = newPage();
    let y = PAGE_H - 90;
    page.drawText(letterSpaced('The Selected Sauna'), { x: MARGIN, y, size: 16, font: bold, color: CHARCOAL });
    y -= 40;

    if (productImage) {
      const maxW = PAGE_W - MARGIN * 2;
      const maxH = 220;
      const scale = Math.min(maxW / productImage.width, maxH / productImage.height);
      const w = productImage.width * scale;
      const h = productImage.height * scale;
      page.drawImage(productImage, { x: (PAGE_W - w) / 2, y: y - h, width: w, height: h });
      y -= h + 30;
    }

    page.drawText(data.product?.model_name ?? '—', { x: MARGIN, y, size: 15, font: bold, color: GOLD });
    y -= 36;

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
    footer(page);
  }

  // ---------------------------------------------------------------- Page 3 — Configuration
  {
    const page = newPage();
    let y = PAGE_H - 90;
    page.drawText(letterSpaced('Your Configuration'), { x: MARGIN, y, size: 16, font: bold, color: CHARCOAL });
    y -= 50;

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
      ['Delivery', Number(data.quote.delivery_cost) > 0 ? 'Included' : 'Not included'],
      ['Installation', Number(data.quote.installation_cost) > 0 ? 'Included' : 'Not included'],
    ];
    for (const [label, value] of rows) {
      y = labelValueRow(page, label, value, y);
    }
    footer(page);
  }

  // ---------------------------------------------------------------- Page 4 — Investment
  {
    const page = newPage();
    let y = PAGE_H - 90;
    page.drawText(letterSpaced('Investment'), { x: MARGIN, y, size: 16, font: bold, color: CHARCOAL });
    y -= 44;

    const colDesc = MARGIN;
    const colQty = PAGE_W - MARGIN - 220;
    const colPrice = PAGE_W - MARGIN - 150;
    const colTotal = PAGE_W - MARGIN - 70;

    page.drawText('DESCRIPTION', { x: colDesc, y, size: 8.5, font: bold, color: MUTED });
    page.drawText('QTY', { x: colQty, y, size: 8.5, font: bold, color: MUTED });
    page.drawText('UNIT PRICE', { x: colPrice, y, size: 8.5, font: bold, color: MUTED });
    page.drawText('LINE TOTAL', { x: colTotal, y, size: 8.5, font: bold, color: MUTED });
    y -= 6;
    page.drawLine({ start: { x: MARGIN, y }, end: { x: PAGE_W - MARGIN, y }, thickness: 0.75, color: GOLD });
    y -= 20;

    for (const item of data.items) {
      const lines = wrapText(item.description, regular, 10, colQty - colDesc - 10);
      lines.forEach((line, i) => {
        page.drawText(line, { x: colDesc, y: y - i * 12, size: 10, font: regular, color: CHARCOAL });
      });
      page.drawText(String(item.quantity), { x: colQty, y, size: 10, font: regular, color: CHARCOAL });
      page.drawText(money(item.unit_price), { x: colPrice, y, size: 10, font: regular, color: CHARCOAL });
      page.drawText(money(item.line_total), { x: colTotal, y, size: 10, font: regular, color: CHARCOAL });
      y -= Math.max(1, lines.length) * 12 + 12;
    }

    y -= 10;
    page.drawLine({ start: { x: MARGIN, y }, end: { x: PAGE_W - MARGIN, y }, thickness: 0.5, color: MUTED });
    y -= 24;

    const totals: [string, string][] = [
      ['Subtotal', money(data.quote.subtotal)],
      ['Delivery', money(data.quote.delivery_cost)],
      ['Installation', money(data.quote.installation_cost)],
      ['Discount', `-${money(data.quote.discount)}`],
      ['Tax', `${Number(data.quote.tax_rate) || 0}%`],
    ];
    for (const [label, value] of totals) {
      page.drawText(label, { x: colPrice - 60, y, size: 10, font: regular, color: CHARCOAL });
      page.drawText(value, { x: colTotal, y, size: 10, font: regular, color: CHARCOAL });
      y -= 18;
    }

    y -= 10;
    page.drawText(`TOTAL (${data.company.currency || 'USD'})`, { x: colPrice - 60, y, size: 12, font: bold, color: GOLD });
    page.drawText(money(data.quote.total), { x: colTotal, y, size: 12, font: bold, color: GOLD });

    footer(page);
  }

  // ---------------------------------------------------------------- Page 5 — Delivery & Installation
  {
    const page = newPage();
    let y = PAGE_H - 90;
    page.drawText(letterSpaced('Delivery & Installation'), { x: MARGIN, y, size: 16, font: bold, color: CHARCOAL });
    y -= 40;

    y = sectionHeading(page, 'Estimated Process', y + 14);
    for (const note of TIMELINE_NOTES) {
      const lines = wrapText(`• ${note}`, regular, 10, PAGE_W - MARGIN * 2);
      for (const line of lines) {
        page.drawText(line, { x: MARGIN, y, size: 10, font: regular, color: CHARCOAL });
        y -= 15;
      }
      y -= 3;
    }

    y -= 20;
    y = sectionHeading(page, 'Site Readiness', y + 14);
    for (const note of SITE_READINESS_NOTES) {
      const lines = wrapText(`• ${note}`, regular, 10, PAGE_W - MARGIN * 2);
      for (const line of lines) {
        page.drawText(line, { x: MARGIN, y, size: 10, font: regular, color: CHARCOAL });
        y -= 15;
      }
      y -= 3;
    }
    footer(page);
  }

  // ---------------------------------------------------------------- Page 6 — Warranty / Terms
  {
    const page = newPage();
    let y = PAGE_H - 90;
    page.drawText(letterSpaced('Warranty & Terms'), { x: MARGIN, y, size: 16, font: bold, color: CHARCOAL });
    y -= 40;

    y = sectionHeading(page, 'Warranty', y + 14);
    for (const line of wrapText(warrantySummary(data.company.name), regular, 10, PAGE_W - MARGIN * 2)) {
      page.drawText(line, { x: MARGIN, y, size: 10, font: regular, color: CHARCOAL });
      y -= 15;
    }

    y -= 20;
    y = sectionHeading(page, 'Quote Validity', y + 14);
    page.drawText(`This proposal is valid until ${data.quote.expiry_date ?? `the date noted by your ${data.company.name} representative`}.`, {
      x: MARGIN, y, size: 10, font: regular, color: CHARCOAL,
    });
    y -= 34;

    y = sectionHeading(page, 'Payment Terms', y + 14);
    for (const line of wrapText(paymentTerms(data.company.name), regular, 10, PAGE_W - MARGIN * 2)) {
      page.drawText(line, { x: MARGIN, y, size: 10, font: regular, color: CHARCOAL });
      y -= 15;
    }

    y -= 20;
    y = sectionHeading(page, 'Notes & Exclusions', y + 14);
    for (const line of wrapText(EXCLUSIONS_NOTE, regular, 10, PAGE_W - MARGIN * 2)) {
      page.drawText(line, { x: MARGIN, y, size: 10, font: regular, color: CHARCOAL });
      y -= 15;
    }

    y -= 60;
    const logoDims = logo.scale(90 / logo.width);
    page.drawImage(logo, { x: (PAGE_W - logoDims.width) / 2, y, width: logoDims.width, height: logoDims.height });
    y -= 20;
    const closingTagline = data.company.tagline;
    const closingWidth = italic.widthOfTextAtSize(closingTagline, 11);
    page.drawText(closingTagline, { x: (PAGE_W - closingWidth) / 2, y, size: 11, font: italic, color: GOLD });
    y -= 18;
    const contact = [data.company.email, data.company.website].filter(Boolean).join('  ·  ');
    const contactWidth = regular.widthOfTextAtSize(contact, 9);
    page.drawText(contact, { x: (PAGE_W - contactWidth) / 2, y, size: 9, font: regular, color: MUTED });

    footer(page);
  }

  return doc.save();
}
