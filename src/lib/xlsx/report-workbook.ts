import ExcelJS from 'exceljs';

/**
 * Generic report → formatted XLSX workbook. Shared by every report page —
 * callers supply column definitions and rows; no report-specific logic here.
 *
 * Column types: text | integer | money | percent | date | status.
 * `percent` expects a FRACTION (0.153 -> "15.3%"). `date` expects an ISO
 * string or Date; null/undefined renders an empty cell, never a zero date.
 */

export type ColumnType = 'text' | 'integer' | 'money' | 'percent' | 'date' | 'status';

export interface ReportColumn {
  header: string;
  key: string;
  type: ColumnType;
}

export type StatusTone = 'red' | 'amber' | 'green' | 'grey';

export interface ReportWorkbookOptions {
  sheetName: string;
  title: string;
  subtitle?: string;
  generatedAt?: Date;
  columns: ReportColumn[];
  rows: Record<string, unknown>[];
  /** map of status cell value -> tint tone; unmapped values render untinted */
  statusTints?: Record<string, StatusTone>;
  /** totals row: numeric values per column key; first column gets the label */
  totals?: { label?: string; values: Record<string, number> };
  footnote?: string;
}

const INK = 'FF241F1A';
const GREY = 'FF6B655A';
const BRONZE = 'FF9C7A4A';
const WHITE = 'FFFFFFFF';
const RULE = 'FFD8D2C6';
// muted, print-friendly status fills
const TINTS: Record<StatusTone, string> = {
  red: 'FFE8D2CC',
  amber: 'FFEFE3C8',
  green: 'FFDCE8D8',
  grey: 'FFE7E2D8',
};

const NUM_FMT: Partial<Record<ColumnType, string>> = {
  integer: '0',
  money: '$#,##0.00',
  percent: '0.0%',
  date: 'yyyy-mm-dd',
};
const ALIGN: Record<ColumnType, 'left' | 'right' | 'center'> = {
  text: 'left', integer: 'right', money: 'right', percent: 'right', date: 'center', status: 'center',
};

export async function buildReportWorkbook(opts: ReportWorkbookOptions): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'BUXENA Admin';
  wb.created = opts.generatedAt ?? new Date();
  const ws = wb.addWorksheet(opts.sheetName);
  const colCount = opts.columns.length;

  // --- title block ---
  const titleRow = ws.addRow([opts.title]);
  titleRow.getCell(1).font = { bold: true, size: 14, color: { argb: INK } };
  ws.mergeCells(titleRow.number, 1, titleRow.number, colCount);

  const gen = opts.generatedAt ?? new Date();
  const genText = `generated ${gen.toISOString().slice(0, 10)} ${gen.toTimeString().slice(0, 5)}`;
  const subRow = ws.addRow([[opts.subtitle, genText].filter(Boolean).join(' — ')]);
  subRow.getCell(1).font = { size: 9, color: { argb: GREY } };
  ws.mergeCells(subRow.number, 1, subRow.number, colCount);
  ws.addRow([]); // spacer

  // --- header row ---
  const headerRow = ws.addRow(opts.columns.map((c) => c.header));
  headerRow.height = 18;
  headerRow.eachCell((cell) => {
    cell.font = { bold: true, size: 10, color: { argb: WHITE } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BRONZE } };
    cell.alignment = { vertical: 'middle' };
  });
  ws.views = [{ state: 'frozen', ySplit: headerRow.number }];
  ws.autoFilter = {
    from: { row: headerRow.number, column: 1 },
    to: { row: headerRow.number, column: colCount },
  };

  // --- data rows ---
  for (const rowData of opts.rows) {
    const values = opts.columns.map((c) => {
      const v = rowData[c.key];
      if (c.type === 'date') return v ? new Date(String(v)) : null; // blank stays blank
      if (c.type === 'integer' || c.type === 'money' || c.type === 'percent') return Number(v ?? 0);
      return v == null ? '' : String(v);
    });
    const row = ws.addRow(values);
    row.height = 18;
    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      const col = opts.columns[colNumber - 1];
      if (!col) return;
      cell.alignment = { vertical: 'middle', horizontal: ALIGN[col.type] };
      const fmt = NUM_FMT[col.type];
      if (fmt) cell.numFmt = fmt;
      cell.border = { bottom: { style: 'thin', color: { argb: RULE } } };
      if (col.type === 'status') {
        const tone = opts.statusTints?.[String(cell.value ?? '')];
        if (tone) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: TINTS[tone] } };
      }
    });
  }

  // --- totals row ---
  if (opts.totals) {
    const values = opts.columns.map((c, i) => {
      if (i === 0) return opts.totals!.label ?? 'TOTAL';
      const v = opts.totals!.values[c.key];
      return (c.type === 'integer' || c.type === 'money') && v != null ? v : '';
    });
    const row = ws.addRow(values);
    row.height = 18;
    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      const col = opts.columns[colNumber - 1];
      if (!col) return;
      cell.font = { bold: true, color: { argb: INK } };
      cell.alignment = { vertical: 'middle', horizontal: colNumber === 1 ? 'left' : ALIGN[col.type] };
      const fmt = NUM_FMT[col.type];
      if (fmt && colNumber !== 1 && cell.value !== '') cell.numFmt = fmt;
      cell.border = { top: { style: 'thin', color: { argb: INK } } };
    });
  }

  // --- footnote ---
  if (opts.footnote) {
    ws.addRow([]);
    const noteRow = ws.addRow([opts.footnote]);
    noteRow.getCell(1).font = { size: 8, color: { argb: GREY } };
    noteRow.getCell(1).alignment = { wrapText: true, vertical: 'top' };
    ws.mergeCells(noteRow.number, 1, noteRow.number, colCount);
  }

  // --- column widths: text sized to longest value, never truncated ---
  opts.columns.forEach((c, i) => {
    const col = ws.getColumn(i + 1);
    if (c.type === 'text' || c.type === 'status') {
      const longest = Math.max(
        c.header.length,
        ...opts.rows.map((r) => String(r[c.key] ?? '').length)
      );
      col.width = Math.max(10, longest + 2);
    } else if (c.type === 'money') {
      col.width = 14;
    } else if (c.type === 'date') {
      col.width = 12;
    } else {
      col.width = Math.max(10, c.header.length + 2);
    }
  });

  return Buffer.from(await wb.xlsx.writeBuffer());
}
