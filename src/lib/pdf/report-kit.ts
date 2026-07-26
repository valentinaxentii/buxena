import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage, type RGB } from 'pdf-lib';
import { BUXENA_LOGO_ESPRESSO_PNG_BASE64, BUXENA_LOGO_COMPACT_PNG_BASE64 } from './logo-base64.ts';
import { DOC_MARGIN_PT, DOC_COLORS, DOC_LOGO, DOC_TYPE, DOC_STATUS_COLORS } from '../doc-theme.ts';

/**
 * Shared document kit — the PDF side of the unified document design.
 * All geometry, palette, and type-scale values come from src/lib/doc-theme.ts,
 * the single source of truth also consumed (as CSS variables) by the print
 * stylesheet. White paper; colour only as bronze/black rules, black/#444/#333
 * text, status colours, and the logo image.
 *
 * Fonts — stated plainly: Cormorant Garamond and Jost are NOT embeddable
 * (no font files in the repo; embedding needs @pdf-lib/fontkit). Closest
 * standard-font fallbacks are used instead of silently shipping Helvetica
 * everywhere: Times-Roman (serif) for the document title and italic accents,
 * Helvetica for body text.
 */

export const PAGE_W = 612; // US Letter
export const PAGE_H = 792;
export const MARGIN = DOC_MARGIN_PT; // 0.6in = 43.2pt, all four sides

export function hex(h: string): RGB {
  const n = parseInt(h.replace('#', ''), 16);
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
}

export const BRONZE = hex(DOC_COLORS.bronze);
export const INK = hex(DOC_COLORS.ink);
export const SECONDARY = hex(DOC_COLORS.secondary);
export const FOOTER_INK = hex(DOC_COLORS.footer);
export const HAIRLINE = hex(DOC_COLORS.hairline);
export const WHITE = rgb(1, 1, 1);
export const STATUS_RGB: Record<string, RGB> = {
  red: hex(DOC_STATUS_COLORS.red),
  amber: hex(DOC_STATUS_COLORS.amber),
  green: hex(DOC_STATUS_COLORS.green),
  neutral: hex(DOC_STATUS_COLORS.neutral),
};

export function wrapText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const words = String(text ?? '').split(/\s+/).filter(Boolean);
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
  return lines.length ? lines : ['—'];
}

export function moneyFmt(n: number): string {
  return `$${(Number(n) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export interface ReportCompany {
  name: string;
  email: string;
  website: string | null;
  tagline: string;
  ein?: string | null;
  address?: string | null;
  phone?: string | null;
}

export interface ReportDocContext {
  doc: PDFDocument;
  regular: PDFFont;   // Helvetica — body (Jost fallback)
  bold: PDFFont;      // Helvetica-Bold
  serif: PDFFont;     // Times-Roman — titles (Cormorant fallback)
  serifBold: PDFFont;
  serifItalic: PDFFont;
  logo: Awaited<ReturnType<PDFDocument['embedPng']>>;        // full lockup
  logoCompact: Awaited<ReturnType<PDFDocument['embedPng']>>; // header lockup
  company: ReportCompany;
}

export async function createReportDoc(company: ReportCompany, title: string): Promise<ReportDocContext> {
  const doc = await PDFDocument.create();
  doc.setTitle(`${company.name} ${title}`.trim());
  doc.setAuthor(company.name);
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const serif = await doc.embedFont(StandardFonts.TimesRoman);
  const serifBold = await doc.embedFont(StandardFonts.TimesRomanBold);
  const serifItalic = await doc.embedFont(StandardFonts.TimesRomanItalic);
  const logo = await doc.embedPng(Buffer.from(BUXENA_LOGO_ESPRESSO_PNG_BASE64, 'base64'));
  const logoCompact = await doc.embedPng(Buffer.from(BUXENA_LOGO_COMPACT_PNG_BASE64, 'base64'));
  return { doc, regular, bold, serif, serifBold, serifItalic, logo, logoCompact, company };
}

/** New WHITE page — no background fill of any kind. */
export function newReportPage(ctx: ReportDocContext): PDFPage {
  return ctx.doc.addPage([PAGE_W, PAGE_H]);
}

/**
 * Page header, one row, elements sharing a bottom edge:
 * LEFT — the compact logo IMAGE only (nothing else).
 * RIGHT — title (serif ~21pt) / subtitle / generated line, right-aligned to
 * the right margin. 1.5pt bronze rule beneath, margin to margin.
 * Returns next y.
 */
export function drawDocHeader(ctx: ReportDocContext, page: PDFPage, title: string, subLines: string[]): number {
  const top = PAGE_H - MARGIN;
  let ty = top - DOC_TYPE.titlePt;
  page.drawText(title, {
    x: PAGE_W - MARGIN - ctx.serifBold.widthOfTextAtSize(title, DOC_TYPE.titlePt),
    y: ty,
    size: DOC_TYPE.titlePt,
    font: ctx.serifBold,
    color: INK,
  });
  ty -= 13;
  for (const line of subLines) {
    page.drawText(line, {
      x: PAGE_W - MARGIN - ctx.regular.widthOfTextAtSize(line, DOC_TYPE.subPt),
      y: ty,
      size: DOC_TYPE.subPt,
      font: ctx.regular,
      color: SECONDARY,
    });
    ty -= 11;
  }
  const textBottom = ty + 11 - 2;

  const dims = ctx.logoCompact.scale(DOC_LOGO.pdfPt / ctx.logoCompact.width);
  page.drawImage(ctx.logoCompact, { x: MARGIN, y: textBottom, width: dims.width, height: dims.height });

  const ruleY = Math.min(textBottom, textBottom) - 10;
  page.drawLine({ start: { x: MARGIN, y: ruleY }, end: { x: PAGE_W - MARGIN, y: ruleY }, thickness: DOC_TYPE.headerRulePt, color: BRONZE });
  return ruleY - 20;
}

/** Continuation-page header: compact logo left + the same bronze rule. */
export function drawCompactLetterhead(ctx: ReportDocContext, page: PDFPage): number {
  const dims = ctx.logoCompact.scale(DOC_LOGO.compactPt / ctx.logoCompact.width);
  const top = PAGE_H - MARGIN - dims.height;
  page.drawImage(ctx.logoCompact, { x: MARGIN, y: top, width: dims.width, height: dims.height });
  const ruleY = top - 8;
  page.drawLine({ start: { x: MARGIN, y: ruleY }, end: { x: PAGE_W - MARGIN, y: ruleY }, thickness: DOC_TYPE.headerRulePt, color: BRONZE });
  return ruleY - 16;
}

/** Y coordinate content must stay above so it clears the anchored footer. */
export const FOOTER_CLEARANCE = MARGIN + 34;

/**
 * Footer anchored to the BOTTOM of the sheet: 1pt bronze rule, then
 * LEFT two lines (address · then email/phone/website/EIN — no company name),
 * RIGHT "Internal document" (+ page number in the second pass).
 * Empty fields are omitted with no stranded separators.
 */
export function drawDocFooter(ctx: ReportDocContext, page: PDFPage): void {
  const c = ctx.company;
  const ruleY = MARGIN + 26;
  page.drawLine({ start: { x: MARGIN, y: ruleY }, end: { x: PAGE_W - MARGIN, y: ruleY }, thickness: DOC_TYPE.footerRulePt, color: BRONZE });

  const line1 = (c.address ?? '').trim();
  const line2 = [c.email, c.phone, c.website, c.ein ? `EIN ${c.ein}` : null]
    .map((v) => (v ?? '').toString().trim())
    .filter(Boolean)
    .join(' · ');

  if (line1) page.drawText(line1, { x: MARGIN, y: ruleY - 11, size: DOC_TYPE.footerPt, font: ctx.regular, color: FOOTER_INK });
  if (line2) page.drawText(line2, { x: MARGIN, y: ruleY - 21, size: DOC_TYPE.footerPt, font: ctx.regular, color: FOOTER_INK });

  const label = 'Internal document';
  page.drawText(label, {
    x: PAGE_W - MARGIN - ctx.regular.widthOfTextAtSize(label, DOC_TYPE.footerPt),
    y: ruleY - 11,
    size: DOC_TYPE.footerPt,
    font: ctx.regular,
    color: FOOTER_INK,
  });
}

/** Second pass: accurate "Page N of M", right-aligned in the footer. */
export function drawPageNumbers(ctx: ReportDocContext): void {
  const pages = ctx.doc.getPages();
  pages.forEach((page, i) => {
    const label = `Page ${i + 1} of ${pages.length}`;
    page.drawText(label, {
      x: PAGE_W - MARGIN - ctx.regular.widthOfTextAtSize(label, DOC_TYPE.footerPt),
      y: MARGIN + 5,
      size: DOC_TYPE.footerPt,
      font: ctx.regular,
      color: FOOTER_INK,
    });
  });
}

/**
 * KPI summary band: bronze hairline rules margin-to-margin, cells left-aligned,
 * bronze 7.5pt uppercase labels (no injected letter-spacing — pdf-lib has no
 * tracking control) over black values. Returns next y.
 */
export function drawKpiStrip(ctx: ReportDocContext, page: PDFPage, kpis: { label: string; value: string }[], y: number): number {
  const contentW = PAGE_W - MARGIN * 2;
  const cols = 3;
  const cellW = contentW / cols;
  const rowCount = Math.ceil(kpis.length / cols);
  page.drawLine({ start: { x: MARGIN, y }, end: { x: PAGE_W - MARGIN, y }, thickness: 0.75, color: BRONZE });
  kpis.forEach((kpi, i) => {
    const row = Math.floor(i / cols);
    const col = i % cols;
    const x = MARGIN + col * cellW;
    const cy = y - 14 - row * 30;
    page.drawText(kpi.label.toUpperCase(), { x, y: cy, size: DOC_TYPE.kpiLabelPt, font: ctx.bold, color: BRONZE });
    page.drawText(kpi.value, { x, y: cy - 15, size: 14, font: ctx.regular, color: INK });
  });
  const bottom = y - 14 - (rowCount - 1) * 30 - 15 - 9;
  page.drawLine({ start: { x: MARGIN, y: bottom }, end: { x: PAGE_W - MARGIN, y: bottom }, thickness: 0.75, color: BRONZE });
  return bottom - 18;
}

/** Outlined status value: 1pt coloured border, coloured text, no fill. */
export function drawStatusOutline(
  ctx: ReportDocContext,
  page: PDFPage,
  text: string,
  rightEdgeX: number,
  y: number,
  tone: keyof typeof STATUS_RGB
): void {
  const color = STATUS_RGB[tone] ?? STATUS_RGB.neutral;
  const size = 7;
  const w = ctx.regular.widthOfTextAtSize(text, size) + 8;
  const x = rightEdgeX - w;
  page.drawRectangle({ x, y: y - 4, width: w, height: 13, borderColor: color, borderWidth: 1 });
  page.drawText(text, { x: x + 4, y, size, font: ctx.regular, color });
}
