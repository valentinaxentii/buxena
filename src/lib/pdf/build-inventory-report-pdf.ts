import type { PDFPage } from 'pdf-lib';
import {
  PAGE_W, PAGE_H, MARGIN, FOOTER_CLEARANCE,
  INK, HAIRLINE,
  wrapText, moneyFmt,
  createReportDoc, newReportPage, drawDocHeader, drawCompactLetterhead,
  drawDocFooter, drawPageNumbers, drawKpiStrip, drawStatusOutline,
  type ReportCompany,
} from './report-kit.ts';
import { DOC_TYPE } from '../doc-theme.ts';

export interface InventoryReportRow {
  model_name: string;
  in_stock: number;
  reserved: number;
  available: number;
  incoming: number;
  cost_value: number;
  retail_value: number;
  status: string;
}

export interface InventoryReportData {
  subtitle: string;
  note: string;
  generatedAt: Date;
  kpis: { label: string; value: string }[];
  rows: InventoryReportRow[];
  totals: { units: number; reserved: number; available: number; incoming: number; cost: number; retail: number };
  company: ReportCompany;
}

const STATUS_TONES: Record<string, 'red' | 'amber' | 'green' | 'neutral'> = {
  'Zero stock': 'red',
  'Low stock': 'amber',
  'Healthy': 'green',
  'Preorder only': 'neutral',
};

// Column layout spans the full 525.6pt content width exactly, so the last
// column's right edge lands ON the right margin.
const CONTENT_W = PAGE_W - MARGIN * 2;
const COLS = [
  { key: 'model', label: 'MODEL', w: 150, align: 'left' as const },
  { key: 'in_stock', label: 'IN STOCK', w: 44, align: 'right' as const },
  { key: 'reserved', label: 'RESERVED', w: 46, align: 'right' as const },
  { key: 'available', label: 'AVAILABLE', w: 48, align: 'right' as const },
  { key: 'incoming', label: 'INCOMING', w: 46, align: 'right' as const },
  { key: 'cost_value', label: 'COST VALUE', w: 68, align: 'right' as const },
  { key: 'retail_value', label: 'RETAIL VALUE', w: 70, align: 'right' as const },
  { key: 'status', label: 'STATUS', w: CONTENT_W - (150 + 44 + 46 + 48 + 46 + 68 + 70), align: 'right' as const },
];
const BODY_SIZE = DOC_TYPE.bodyPt;
const LINE_H = 11;

export async function buildInventoryReportPdf(data: InventoryReportData): Promise<Uint8Array> {
  const ctx = await createReportDoc(data.company, 'Inventory Report');
  const { regular, bold } = ctx;

  const colX: number[] = [];
  let acc = MARGIN;
  for (const c of COLS) { colX.push(acc); acc += c.w; }

  function cellText(page: PDFPage, text: string, col: number, y: number, opts: { bold?: boolean; color?: any; size?: number } = {}) {
    const c = COLS[col];
    const font = opts.bold ? bold : regular;
    const size = opts.size ?? BODY_SIZE;
    const isLast = col === COLS.length - 1;
    let x = colX[col];
    if (c.align === 'right') x = colX[col] + c.w - font.widthOfTextAtSize(text, size) - (isLast ? 0 : 4);
    page.drawText(text, { x, y, size, font, color: opts.color ?? INK });
  }

  // Header row: bold black ~7pt, 2pt black rule beneath, NO fill.
  function drawTableHeader(page: PDFPage, y: number): number {
    COLS.forEach((c, i) => cellText(page, c.label, i, y, { bold: true, size: DOC_TYPE.tableHeaderPt }));
    const ruleY = y - 5;
    page.drawLine({ start: { x: MARGIN, y: ruleY }, end: { x: PAGE_W - MARGIN, y: ruleY }, thickness: DOC_TYPE.tableHeaderRulePt, color: INK });
    return ruleY - 14;
  }

  // ------------------------------------------------------------ page 1
  let page = newReportPage(ctx);
  let y = drawDocHeader(ctx, page, 'Inventory Report', [
    data.subtitle,
    `Generated ${data.generatedAt.toISOString().slice(0, 10)} ${data.generatedAt.toTimeString().slice(0, 5)}`,
  ]);
  y = drawKpiStrip(ctx, page, data.kpis.slice(0, 6), y);
  y = drawTableHeader(page, y);

  const finishPage = (p: PDFPage) => drawDocFooter(ctx, p);

  data.rows.forEach((r) => {
    const modelLines = wrapText(r.model_name, regular, BODY_SIZE, COLS[0].w - 8);
    const rowH = Math.max(17, modelLines.length * LINE_H + 6);

    // never split a row: break first — compact header, table header repeat
    if (y - rowH < FOOTER_CLEARANCE) {
      finishPage(page);
      page = newReportPage(ctx);
      y = drawCompactLetterhead(ctx, page);
      y = drawTableHeader(page, y);
    }

    modelLines.forEach((line, li) => {
      page.drawText(line, { x: colX[0], y: y - li * LINE_H, size: BODY_SIZE, font: regular, color: INK });
    });
    cellText(page, String(r.in_stock), 1, y);
    cellText(page, String(r.reserved), 2, y);
    cellText(page, String(r.available), 3, y);
    cellText(page, String(r.incoming), 4, y);
    cellText(page, moneyFmt(r.cost_value), 5, y);
    cellText(page, moneyFmt(r.retail_value), 6, y);
    drawStatusOutline(ctx, page, r.status, PAGE_W - MARGIN, y, STATUS_TONES[r.status] ?? 'neutral');

    page.drawLine({
      start: { x: MARGIN, y: y - rowH + 10 },
      end: { x: PAGE_W - MARGIN, y: y - rowH + 10 },
      thickness: 0.5,
      color: HAIRLINE,
    });
    y -= rowH;
  });

  // totals: bold, 1pt black rule above
  if (y - 24 < FOOTER_CLEARANCE) {
    finishPage(page);
    page = newReportPage(ctx);
    y = drawCompactLetterhead(ctx, page);
    y = drawTableHeader(page, y);
  }
  page.drawLine({ start: { x: MARGIN, y: y + 12 }, end: { x: PAGE_W - MARGIN, y: y + 12 }, thickness: 1, color: INK });
  y -= 4;
  cellText(page, 'TOTAL', 0, y, { bold: true });
  cellText(page, String(data.totals.units), 1, y, { bold: true });
  cellText(page, String(data.totals.reserved), 2, y, { bold: true });
  cellText(page, String(data.totals.available), 3, y, { bold: true });
  cellText(page, String(data.totals.incoming), 4, y, { bold: true });
  cellText(page, moneyFmt(data.totals.cost), 5, y, { bold: true });
  cellText(page, moneyFmt(data.totals.retail), 6, y, { bold: true });
  y -= 24;

  // footnote
  for (const line of wrapText(data.note, regular, 8, PAGE_W - MARGIN * 2)) {
    if (y < FOOTER_CLEARANCE) break;
    page.drawText(line, { x: MARGIN, y, size: 8, font: regular, color: INK });
    y -= 11;
  }

  finishPage(page);
  drawPageNumbers(ctx);
  return ctx.doc.save();
}
