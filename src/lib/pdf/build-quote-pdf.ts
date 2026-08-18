import type { PDFImage, PDFPage } from 'pdf-lib';
import {
  PAGE_W, PAGE_H, MARGIN, FOOTER_CLEARANCE,
  INK, SECONDARY, BRONZE, HAIRLINE, WHITE, hex,
  wrapText,
  createReportDoc, newReportPage,
} from './report-kit.ts';
import { DOC_TYPE } from '../doc-theme.ts';

const PAPER = hex('#F7F3EB');
const PAPER_DEEP = hex('#EEE6D9');
const PANEL = hex('#FBF8F2');
const DARK = hex('#100F0D');
const DARK_SOFT = hex('#24201C');
const IVORY = hex('#F3E7D4');
const GOLD = hex('#C18A32');

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
  visuals?: {
    heaterInterior?: string | null;
    ritual?: string | null;
    siteReadiness?: string | null;
    coldPlunge?: string | null;
  };
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

  async function embedRemoteImage(url: string | null | undefined): Promise<PDFImage | null> {
    if (!url) return null;
    try {
      const res = await fetch(url);
      if (res.ok) {
        const bytes = new Uint8Array(await res.arrayBuffer());
        const contentType = res.headers.get('content-type') ?? '';
        return contentType.includes('png') || url.toLowerCase().endsWith('.png')
          ? await ctx.doc.embedPng(bytes)
          : await ctx.doc.embedJpg(bytes);
      }
    } catch {
      return null;
    }
    return null;
  }

  const [productImage, heaterInteriorImage, ritualImage, siteReadinessImage, coldPlungeImage] = await Promise.all([
    embedRemoteImage(data.product?.images?.[0]),
    embedRemoteImage(data.visuals?.heaterInterior),
    embedRemoteImage(data.visuals?.ritual),
    embedRemoteImage(data.visuals?.siteReadiness),
    embedRemoteImage(data.visuals?.coldPlunge),
  ]);

  function drawContainedImage(page: PDFPage, image: PDFImage, x: number, y: number, width: number, height: number): void {
    const scale = Math.min(width / image.width, height / image.height);
    const drawWidth = image.width * scale;
    const drawHeight = image.height * scale;
    page.drawImage(image, {
      x: x + (width - drawWidth) / 2,
      y: y + (height - drawHeight) / 2,
      width: drawWidth,
      height: drawHeight,
    });
  }

  function newProposalPage(): PDFPage {
    const page = newReportPage(ctx);
    page.drawRectangle({ x: 0, y: 0, width: PAGE_W, height: PAGE_H, color: PAPER });
    return page;
  }

  function drawBrandBand(page: PDFPage, rightLabel: string): number {
    const bandHeight = 102;
    const bandBottom = PAGE_H - bandHeight;
    page.drawRectangle({ x: 0, y: bandBottom, width: PAGE_W, height: bandHeight, color: DARK });

    const logoDims = ctx.logo.scale(128 / ctx.logo.width);
    page.drawImage(ctx.logo, {
      x: MARGIN,
      y: bandBottom + (bandHeight - logoDims.height) / 2,
      width: logoDims.width,
      height: logoDims.height,
    });

    const label = rightLabel.toUpperCase();
    const labelSize = 7.5;
    page.drawText(label, {
      x: PAGE_W - MARGIN - bold.widthOfTextAtSize(label, labelSize),
      y: bandBottom + bandHeight / 2 - 2,
      size: labelSize,
      font: bold,
      color: IVORY,
    });
    return bandBottom - 30;
  }

  function drawProposalFooter(page: PDFPage): void {
    const ruleY = MARGIN + 26;
    page.drawLine({ start: { x: MARGIN, y: ruleY }, end: { x: PAGE_W - MARGIN, y: ruleY }, thickness: 0.8, color: BRONZE });
    const contact = [data.company.email, data.company.website].filter(Boolean).join('  ·  ');
    page.drawText(contact, { x: MARGIN, y: ruleY - 16, size: 7.2, font: regular, color: SECONDARY });
    const documentLabel = 'BUXENA customer proposal';
    page.drawText(documentLabel, {
      x: PAGE_W - MARGIN - regular.widthOfTextAtSize(documentLabel, 7.2),
      y: ruleY - 16,
      size: 7.2,
      font: regular,
      color: SECONDARY,
    });
  }

  function drawProposalPageNumbers(): void {
    const pages = ctx.doc.getPages();
    pages.forEach((page, index) => {
      const label = `Page ${index + 1} of ${pages.length}`;
      const size = 7.2;
      page.drawText(label, {
        x: (PAGE_W - regular.widthOfTextAtSize(label, size)) / 2,
        y: MARGIN - 10,
        size,
        font: regular,
        color: SECONDARY,
      });
    });
  }

  function sectionHeading(page: PDFPage, section: string, text: string, y: number): number {
    page.drawLine({ start: { x: MARGIN, y: y + 10 }, end: { x: MARGIN + 28, y: y + 10 }, thickness: 0.8, color: BRONZE });
    page.drawText(section, { x: MARGIN, y: y - 5, size: 8, font: serifItalic, color: BRONZE });
    page.drawText(text, { x: MARGIN + 42, y, size: 21, font: serifBold, color: DARK_SOFT });
    return y - 34;
  }

  function subsectionHeading(page: PDFPage, text: string, y: number): number {
    page.drawText(text.toUpperCase(), { x: MARGIN, y, size: 7.5, font: bold, color: BRONZE });
    page.drawLine({ start: { x: MARGIN, y: y - 7 }, end: { x: PAGE_W - MARGIN, y: y - 7 }, thickness: 0.65, color: BRONZE });
    return y - 25;
  }

  function labelValueRow(page: PDFPage, label: string, value: string, y: number): number {
    page.drawText(label.toUpperCase(), { x: MARGIN, y, size: 7.2, font: bold, color: BRONZE });
    const lines = wrapText(value || '-', regular, 9.5, PAGE_W - MARGIN * 2 - 150);
    lines.forEach((line, i) => {
      page.drawText(line, { x: MARGIN + 150, y: y - i * 12, size: 9.5, font: regular, color: DARK_SOFT });
    });
    const nextY = y - Math.max(1, lines.length) * 12 - 9;
    page.drawLine({ start: { x: MARGIN, y: nextY + 5 }, end: { x: PAGE_W - MARGIN, y: nextY + 5 }, thickness: 0.45, color: HAIRLINE });
    return nextY;
  }

  // ---------------------------------------------------------------- Cover
  {
    const page = newProposalPage();
    let y = drawBrandBand(page, `Prepared for ${data.customer?.name ?? 'you'}`);

    const leftW = 315;
    const metaX = MARGIN + 350;
    const metaW = PAGE_W - MARGIN - metaX;

    const title = `${data.product?.model_name ?? 'Complete Sauna'} Proposal`;
    const titleLines = wrapText(title, serifBold, 34, leftW);
    titleLines.forEach((line, index) => {
      page.drawText(line, { x: MARGIN, y: y - index * 37, size: 34, font: serifBold, color: DARK_SOFT });
    });
    y -= titleLines.length * 37 + 4;

    const intro = 'Complete project scope, equipment, delivered investment, site requirements and next steps - organized in one clear document.';
    const introLines = wrapText(intro, regular, 10.5, leftW);
    introLines.forEach((line, index) => {
      page.drawText(line, { x: MARGIN, y: y - index * 15, size: 10.5, font: regular, color: SECONDARY });
    });

    const metadata: [string, string][] = [
      ['PROPOSAL', data.quote.quote_number ?? '-'],
      ['PREPARED', data.quote.quote_date ?? '-'],
      ['VALID UNTIL', data.quote.expiry_date ?? '-'],
    ];
    let metaY = 646;
    for (const [label, value] of metadata) {
      page.drawLine({ start: { x: metaX, y: metaY + 10 }, end: { x: metaX + metaW, y: metaY + 10 }, thickness: 0.5, color: BRONZE });
      page.drawText(label, { x: metaX, y: metaY - 5, size: 6.8, font: bold, color: BRONZE });
      page.drawText(value, {
        x: metaX + metaW - regular.widthOfTextAtSize(value, 8.8),
        y: metaY - 5,
        size: 8.8,
        font: regular,
        color: DARK_SOFT,
      });
      metaY -= 34;
    }

    const validityY = 486;
    page.drawRectangle({ x: MARGIN, y: validityY, width: PAGE_W - MARGIN * 2, height: 34, color: PANEL });
    page.drawRectangle({ x: MARGIN, y: validityY, width: 2, height: 34, color: BRONZE });
    page.drawText('Pricing and scope are held through the validity date above.', {
      x: MARGIN + 13, y: validityY + 12, size: 8.8, font: bold, color: DARK_SOFT,
    });

    y = sectionHeading(page, '01', 'See your sauna configuration', 446);
    const cardTop = y - 2;
    const cardBottom = FOOTER_CLEARANCE + 13;
    const cardHeight = cardTop - cardBottom;
    const splitX = MARGIN + 302;
    page.drawRectangle({ x: MARGIN, y: cardBottom, width: PAGE_W - MARGIN * 2, height: cardHeight, color: PANEL, borderColor: BRONZE, borderWidth: 0.6 });
    page.drawRectangle({ x: splitX, y: cardBottom, width: PAGE_W - MARGIN - splitX, height: cardHeight, color: PAPER_DEEP });
    page.drawLine({ start: { x: splitX, y: cardBottom }, end: { x: splitX, y: cardTop }, thickness: 0.5, color: BRONZE });

    page.drawRectangle({ x: MARGIN + 12, y: cardTop - 32, width: 104, height: 20, color: DARK_SOFT });
    page.drawText('YOUR SELECTED MODEL', { x: MARGIN + 20, y: cardTop - 25, size: 6.6, font: bold, color: WHITE });

    if (productImage) {
      const maxW = splitX - MARGIN - 42;
      const maxH = cardHeight - 68;
      const scale = Math.min(maxW / productImage.width, maxH / productImage.height);
      const width = productImage.width * scale;
      const height = productImage.height * scale;
      page.drawImage(productImage, {
        x: MARGIN + (splitX - MARGIN - width) / 2,
        y: cardBottom + 18,
        width,
        height,
      });
    }

    const detailX = splitX + 24;
    page.drawText('PROJECT DETAILS', { x: detailX, y: cardTop - 72, size: 7, font: bold, color: BRONZE });

    const dims = data.product?.dimensions;
    const dimsText = dims && (dims.width || dims.depth || dims.height)
      ? `${dims.width ?? '-'} x ${dims.depth ?? '-'} x ${dims.height ?? '-'} ${dims.unit ?? ''}`.trim()
      : '-';
    const coverFacts: [string, string][] = [
      ['CATEGORY', data.product?.category ?? '-'],
      ['CAPACITY', data.product?.capacity ?? '-'],
      ['DIMENSIONS', dimsText],
      ['MATERIAL', data.product?.timber_type ?? '-'],
    ];
    let factY = cardTop - 108;
    for (const [label, value] of coverFacts) {
      page.drawText(label, { x: detailX, y: factY, size: 6.5, font: bold, color: BRONZE });
      const valueLines = wrapText(value, regular, 8.3, PAGE_W - MARGIN - detailX - 10);
      valueLines.forEach((line, index) => page.drawText(line, { x: detailX, y: factY - 12 - index * 11, size: 8.3, font: regular, color: DARK_SOFT }));
      factY -= 29 + Math.max(0, valueLines.length - 1) * 11;
    }

    drawProposalFooter(page);
  }

  // ------------------------------------------------- Page 2 — Configuration
  {
    const page = newProposalPage();
    let y = drawBrandBand(page, `Customer proposal · ${data.quote.quote_number ?? ''}`);
    y = sectionHeading(page, '02', 'Your configuration', y);

    let accessoriesText = 'None selected';
    if (Array.isArray(data.quote.accessories) && data.quote.accessories.length) {
      accessoriesText = data.quote.accessories.map((a) => String(a)).join(', ');
    } else if (data.quote.accessories && typeof data.quote.accessories === 'object') {
      const vals = Object.values(data.quote.accessories as Record<string, unknown>).filter(Boolean);
      if (vals.length) accessoriesText = vals.map((v) => String(v)).join(', ');
    }

    const controlItem = data.items.find((item) => /control/i.test(item.description))?.description ?? 'As itemized in this proposal';
    const panelHeight = 156;
    const panelBottom = y - panelHeight;
    page.drawRectangle({ x: MARGIN, y: panelBottom, width: PAGE_W - MARGIN * 2, height: panelHeight, color: DARK_SOFT });
    page.drawText('SELECTED HEATING SYSTEM', { x: MARGIN + 20, y: y - 26, size: 7, font: bold, color: GOLD });
    const heaterLines = wrapText(data.quote.heater || 'Heater selection confirmed with your proposal', serifBold, 19, PAGE_W - MARGIN * 2 - 40);
    heaterLines.slice(0, 2).forEach((line, index) => {
      page.drawText(line, { x: MARGIN + 20, y: y - 54 - index * 22, size: 19, font: serifBold, color: IVORY });
    });

    const specColumns: [string, string][] = [
      ['CONTROLS', controlItem],
      ['INCLUDED ACCESSORIES', accessoriesText],
    ];
    const columnWidth = (PAGE_W - MARGIN * 2 - 40) / 2;
    specColumns.forEach(([label, value], index) => {
      const x = MARGIN + 20 + index * columnWidth;
      page.drawText(label, { x, y: panelBottom + 47, size: 6.5, font: bold, color: GOLD });
      const valueLines = wrapText(value, regular, 7.8, columnWidth - 13);
      valueLines.slice(0, 3).forEach((line, lineIndex) => {
        page.drawText(line, { x, y: panelBottom + 31 - lineIndex * 10, size: 7.8, font: regular, color: IVORY });
      });
    });

    y = panelBottom - 30;
    const rows: [string, string][] = [
      ['Glass configuration', data.product?.glass_configuration ?? '-'],
      ['Electrical requirements', data.product?.electrical_requirements ?? '-'],
      ['Delivery', Number(data.quote.delivery_cost) > 0 ? 'Priced in this proposal' : 'Not priced in this proposal - confirm before order'],
      ['Installation', Number(data.quote.installation_cost) > 0 ? 'Priced in this proposal' : 'Not priced in this proposal - confirm before order'],
    ];
    for (const [label, value] of rows) {
      y = labelValueRow(page, label, value, y);
    }

    if (heaterInteriorImage) {
      const cardX = MARGIN;
      const cardY = FOOTER_CLEARANCE + 44;
      const cardW = PAGE_W - MARGIN * 2;
      const cardH = 218;
      const imageW = 185;
      page.drawRectangle({ x: cardX, y: cardY, width: cardW, height: cardH, color: PAPER_DEEP });
      drawContainedImage(page, heaterInteriorImage, cardX, cardY, imageW, cardH);
      const copyX = cardX + imageW + 24;
      page.drawText('REPRESENTATIVE INTERIOR', { x: copyX, y: cardY + 174, size: 7, font: bold, color: BRONZE });
      page.drawText('Warmth, control and comfort', { x: copyX, y: cardY + 143, size: 17, font: serifBold, color: DARK_SOFT });
      const copy = 'A considered interior helps the selected heater, controls and material work together as one calm sauna environment.';
      wrapText(copy, regular, 9, cardW - imageW - 48).forEach((line, index) => {
        page.drawText(line, { x: copyX, y: cardY + 114 - index * 13, size: 9, font: regular, color: DARK_SOFT });
      });
      const caption = 'Atmosphere image. Exact equipment is defined in the selected-system panel above.';
      wrapText(caption, regular, 7.5, cardW - imageW - 48).forEach((line, index) => {
        page.drawText(line, { x: copyX, y: cardY + 45 - index * 10, size: 7.5, font: regular, color: SECONDARY });
      });
    }
    drawProposalFooter(page);
  }

  // ------------------------------------------------- Page 3 — Investment
  {
    const page = newProposalPage();
    let y = drawBrandBand(page, `Customer proposal · ${data.quote.quote_number ?? ''}`);
    y = sectionHeading(page, '03', 'Delivered investment', y);

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
    const taxAmount = Math.max(
      0,
      (Number(data.quote.total) || 0)
        - (Number(data.quote.subtotal) || 0)
        - (Number(data.quote.delivery_cost) || 0)
        - (Number(data.quote.installation_cost) || 0)
        + (Number(data.quote.discount) || 0)
    );
    const taxRate = Number(data.quote.tax_rate) || 0;
    const totals: [string, string][] = [
      ['Subtotal', money(data.quote.subtotal)],
      ['Delivery', money(data.quote.delivery_cost)],
      ['Installation', money(data.quote.installation_cost)],
      ['Discount', `-${money(data.quote.discount)}`],
      [`Sales tax (${taxRate}%)`, money(taxAmount)],
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

    if (ritualImage) {
      const cardX = MARGIN;
      const cardY = FOOTER_CLEARANCE + 44;
      const cardW = PAGE_W - MARGIN * 2;
      const cardH = 172;
      const imageW = 300;
      page.drawRectangle({ x: cardX, y: cardY, width: cardW, height: cardH, color: DARK_SOFT });
      drawContainedImage(page, ritualImage, cardX, cardY, imageW, cardH);
      const copyX = cardX + imageW + 22;
      page.drawText('THE EXPERIENCE', { x: copyX, y: cardY + 129, size: 7, font: bold, color: GOLD });
      page.drawText('Beyond the numbers', { x: copyX, y: cardY + 101, size: 16, font: serifBold, color: IVORY });
      const copy = 'A complete proposal brings the equipment, delivery and final sauna ritual into one clear investment.';
      wrapText(copy, regular, 8.5, cardW - imageW - 44).forEach((line, index) => {
        page.drawText(line, { x: copyX, y: cardY + 75 - index * 12, size: 8.5, font: regular, color: IVORY });
      });
      page.drawText('Accessories are included only when itemized above.', { x: copyX, y: cardY + 23, size: 7.2, font: regular, color: GOLD });
    }

    drawProposalFooter(page);
  }

  // -------------------------------------- Page 4 — Delivery & Installation
  {
    const page = newProposalPage();
    let y = drawBrandBand(page, `Customer proposal · ${data.quote.quote_number ?? ''}`);
    y = sectionHeading(page, '04', 'Delivery & site readiness', y);

    y = subsectionHeading(page, 'Estimated Process', y);
    for (const note of TIMELINE_NOTES) {
      for (const line of wrapText(`• ${note}`, regular, 9.5, PAGE_W - MARGIN * 2)) {
        page.drawText(line, { x: MARGIN, y, size: 9.5, font: regular, color: INK });
        y -= 14;
      }
      y -= 2;
    }

    y -= 16;
    y = subsectionHeading(page, 'Site Readiness', y);
    for (const note of SITE_READINESS_NOTES) {
      for (const line of wrapText(`• ${note}`, regular, 9.5, PAGE_W - MARGIN * 2)) {
        page.drawText(line, { x: MARGIN, y, size: 9.5, font: regular, color: INK });
        y -= 14;
      }
      y -= 2;
    }

    if (siteReadinessImage) {
      const cardX = MARGIN;
      const cardY = FOOTER_CLEARANCE + 44;
      const cardW = PAGE_W - MARGIN * 2;
      const cardH = 176;
      const imageW = 320;
      page.drawRectangle({ x: cardX, y: cardY, width: cardW, height: cardH, color: PANEL });
      drawContainedImage(page, siteReadinessImage, cardX, cardY, imageW, cardH);
      const copyX = cardX + imageW + 21;
      page.drawText('SPACE & LIGHT', { x: copyX, y: cardY + 132, size: 7, font: bold, color: BRONZE });
      page.drawText('Plan the setting', { x: copyX, y: cardY + 103, size: 16, font: serifBold, color: DARK_SOFT });
      page.drawText('Concept image for spatial inspiration.', { x: copyX, y: cardY + 67, size: 7.2, font: regular, color: SECONDARY });
    }
    drawProposalFooter(page);
  }

  // ------------------------------------------- Page 5 — Warranty / Terms
  {
    const page = newProposalPage();
    let y = drawBrandBand(page, `Customer proposal · ${data.quote.quote_number ?? ''}`);
    y = sectionHeading(page, '05', 'Warranty & next steps', y);

    y = subsectionHeading(page, 'Warranty', y);
    for (const line of wrapText(warrantySummary(data.company.name), regular, 9.5, PAGE_W - MARGIN * 2)) {
      page.drawText(line, { x: MARGIN, y, size: 9.5, font: regular, color: INK });
      y -= 14;
    }

    y -= 16;
    y = subsectionHeading(page, 'Payment Terms', y);
    for (const line of wrapText(paymentTerms(data.company.name), regular, 9.5, PAGE_W - MARGIN * 2)) {
      page.drawText(line, { x: MARGIN, y, size: 9.5, font: regular, color: INK });
      y -= 14;
    }

    y -= 16;
    y = subsectionHeading(page, 'Before You Proceed', y);
    const decisionNote = 'Confirm the final specifications, availability and order agreement with your BUXENA representative before payment.';
    for (const line of wrapText(decisionNote, regular, 9.5, PAGE_W - MARGIN * 2)) {
      page.drawText(line, { x: MARGIN, y, size: 9.5, font: regular, color: INK });
      y -= 14;
    }

    y -= 16;
    y = subsectionHeading(page, 'Notes & Exclusions', y);
    for (const line of wrapText(EXCLUSIONS_NOTE, regular, 9.5, PAGE_W - MARGIN * 2)) {
      page.drawText(line, { x: MARGIN, y, size: 9.5, font: regular, color: INK });
      y -= 14;
    }

    if (coldPlungeImage) {
      const cardX = MARGIN;
      const cardY = FOOTER_CLEARANCE + 44;
      const cardW = PAGE_W - MARGIN * 2;
      const cardH = 172;
      const imageW = 300;
      page.drawRectangle({ x: cardX, y: cardY, width: cardW, height: cardH, color: DARK_SOFT });
      drawContainedImage(page, coldPlungeImage, cardX, cardY, imageW, cardH);
      const copyX = cardX + imageW + 22;
      const copyW = cardW - imageW - 44;
      page.drawText('OPTIONAL WELLNESS ADD-ON', { x: copyX, y: cardY + 129, size: 7, font: bold, color: GOLD });
      const titleLines = wrapText('Complete the contrast ritual', serifBold, 16, copyW);
      titleLines.slice(0, 2).forEach((line, index) => {
        page.drawText(line, { x: copyX, y: cardY + 101 - index * 18, size: 16, font: serifBold, color: IVORY });
      });
      const copy = 'A cold plunge adds a dedicated cool-down step beside the sauna.';
      wrapText(copy, regular, 8.5, copyW).forEach((line, index) => {
        page.drawText(line, { x: copyX, y: cardY + 58 - index * 12, size: 8.5, font: regular, color: IVORY });
      });
      const caption = 'Concept image. Not included unless separately itemized.';
      wrapText(caption, regular, 7.2, copyW).forEach((line, index) => {
        page.drawText(line, { x: copyX, y: cardY + 23 - index * 9, size: 7.2, font: regular, color: GOLD });
      });
    }

    drawProposalFooter(page);
  }

  drawProposalPageNumbers();
  return ctx.doc.save();
}
