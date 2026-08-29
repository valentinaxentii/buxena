import ExcelJS from 'exceljs';

export type SupplierPriceScope = 'accessories' | 'sauna_rooms';

export type ImportedSupplierPriceItem = {
  source_row: number;
  section: string | null;
  item_name: string | null;
  source_item: string;
  supplier_sku: string | null;
  ean: string | null;
  dimensions: string | null;
  material: string | null;
  pack_length: number | null;
  pack_width: number | null;
  pack_height: number | null;
  pack_unit: 'mm' | 'm';
  weight_kg: number | null;
  package_m3: number | null;
  master_box_qty: number | null;
  inner_box_qty: number | null;
  unit_cost: number;
  raw_cells: Record<string, string>;
};

export type ParsedSupplierPriceList = {
  detectedSupplier: 'SAWO';
  catalogScope: SupplierPriceScope;
  listName: string;
  priceListDate: string | null;
  currency: 'USD';
  incoterm: 'FCA';
  priceColumnLabel: string;
  sourceFilename: string;
  items: ImportedSupplierPriceItem[];
};

function clean(value: unknown): string {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function cellText(cell: ExcelJS.Cell): string {
  const value = cell.value as any;
  if (value == null) return '';
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return clean(value);
  }
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'object') {
    if ('result' in value && value.result != null) return clean(value.result);
    if (Array.isArray(value.richText)) return clean(value.richText.map((part: any) => part.text ?? '').join(''));
    if ('text' in value && value.text != null) return clean(value.text);
    if ('hyperlink' in value && value.hyperlink != null) return clean(value.text ?? value.hyperlink);
  }
  return clean(cell.text);
}

function cellNumber(cell: ExcelJS.Cell): number | null {
  const value = cell.value as any;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (value && typeof value === 'object' && typeof value.result === 'number' && Number.isFinite(value.result)) {
    return value.result;
  }
  const text = cellText(cell).replace(/[$,]/g, '');
  if (!text) return null;
  const n = Number(text);
  return Number.isFinite(n) ? n : null;
}

function nullableText(cell: ExcelJS.Cell): string | null {
  const value = cellText(cell);
  return value || null;
}

function nullableNumber(cell: ExcelJS.Cell): number | null {
  const value = cellNumber(cell);
  return value == null ? null : value;
}

function nullableInteger(cell: ExcelJS.Cell): number | null {
  const value = cellNumber(cell);
  if (value == null || !Number.isFinite(value)) return null;
  return Math.trunc(value);
}

/**
 * Excel displays these supplier price columns with two decimals. Normalise
 * tiny binary-float tails first (Excel itself is a 15-significant-digit
 * system), then round the displayed supplier price to cents.
 */
function displayedMoney(value: number): number {
  const fifteenDigits = Number.parseFloat(value.toPrecision(15));
  return Math.round((fifteenDigits + Number.EPSILON) * 100) / 100;
}

function looksLikeSku(text: string): boolean {
  const value = clean(text);
  if (!value || value.length > 100) return false;
  const low = value.toLowerCase();
  if (
    low.startsWith('if ') ||
    low.startsWith('price ') ||
    low.startsWith('supplied ') ||
    low.startsWith('the ') ||
    low.startsWith('all ') ||
    low.startsWith('right / left door w/') ||
    /^\d+-person\b/.test(low)
  ) return false;

  const letters = [...value].filter((char) => /[a-z]/i.test(char));
  const uppercase = letters.filter((char) => char === char.toUpperCase()).length;
  const uppercaseRatio = uppercase / Math.max(letters.length, 1);
  return /\d|[-/]/.test(value) && uppercaseRatio >= 0.55;
}

function parseDateFromFilename(filename: string): string | null {
  // SAWO filenames supplied to BUXENA contain ddmmyy, e.g. 200826 / 140826.
  const match = filename.match(/(?:^|\s)(\d{2})(\d{2})(\d{2})(?:\s|\.|$)/);
  if (!match) return null;
  const [, dd, mm, yy] = match;
  const yyyy = 2000 + Number(yy);
  const date = new Date(Date.UTC(yyyy, Number(mm) - 1, Number(dd)));
  if (
    date.getUTCFullYear() !== yyyy ||
    date.getUTCMonth() !== Number(mm) - 1 ||
    date.getUTCDate() !== Number(dd)
  ) return null;
  return `${yyyy}-${mm}-${dd}`;
}

function rawRow(row: ExcelJS.Row, maxColumn: number): Record<string, string> {
  const out: Record<string, string> = {};
  for (let column = 1; column <= maxColumn; column += 1) {
    const value = cellText(row.getCell(column));
    if (!value) continue;
    out[row.getCell(column).address.replace(/\d+$/, '')] = value;
  }
  return out;
}

function parseSawoSheet(
  sheet: ExcelJS.Worksheet,
  sourceFilename: string,
  scope: SupplierPriceScope,
  priceColumn: number,
): ParsedSupplierPriceList {
  let currentSection = '';
  let lastDescription = '';
  const items: ImportedSupplierPriceItem[] = [];

  sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    const a = cellText(row.getCell(1));
    const b = cellText(row.getCell(2));

    if (rowNumber >= 4 && a) {
      currentSection = a;
      lastDescription = '';
    }

    const rawPrice = cellNumber(row.getCell(priceColumn));
    if (rawPrice != null && rawPrice > 0) {
      const isSku = looksLikeSku(b);
      const itemName = isSku ? (lastDescription || currentSection || b) : b;
      const price = displayedMoney(rawPrice);
      items.push({
        source_row: rowNumber,
        section: currentSection || null,
        item_name: itemName || currentSection || b || `Row ${rowNumber}`,
        source_item: b || `Row ${rowNumber}`,
        supplier_sku: isSku ? b : null,
        ean: scope === 'accessories' ? nullableText(row.getCell(3)) : null,
        dimensions: scope === 'sauna_rooms' ? nullableText(row.getCell(3)) : null,
        material: nullableText(row.getCell(4)),
        pack_length: nullableNumber(row.getCell(5)),
        pack_width: nullableNumber(row.getCell(6)),
        pack_height: nullableNumber(row.getCell(7)),
        pack_unit: scope === 'accessories' ? 'mm' : 'm',
        weight_kg: nullableNumber(row.getCell(8)),
        package_m3: nullableNumber(row.getCell(9)),
        master_box_qty: scope === 'accessories' ? nullableInteger(row.getCell(10)) : null,
        inner_box_qty: scope === 'accessories' ? nullableInteger(row.getCell(11)) : null,
        unit_cost: price,
        raw_cells: rawRow(row, priceColumn),
      });
      return;
    }

    if (b && !b.startsWith('- ') && !looksLikeSku(b)) lastDescription = b;
  });

  if (items.length === 0) throw new Error(`No positive supplier prices were found in ${sheet.name}.`);

  const priceListDate = parseDateFromFilename(sourceFilename);
  const readableScope = scope === 'accessories' ? 'Accessories' : 'Sauna Rooms';
  return {
    detectedSupplier: 'SAWO',
    catalogScope: scope,
    listName: `SAWO ${readableScope}${priceListDate ? ` — ${priceListDate}` : ''}`,
    priceListDate,
    currency: 'USD',
    incoterm: 'FCA',
    priceColumnLabel: cellText(sheet.getCell(2, priceColumn)) || 'OLEG BUJOR FCA SAWO',
    sourceFilename,
    items,
  };
}

/**
 * Supplier-specific parser dispatcher. V3 starts with the two verified SAWO
 * workbook layouts. New suppliers get their own adapter here instead of a
 * generic "guess columns" parser that could silently assign the wrong cost.
 */
export async function parseSupplierPriceWorkbook(
  bytes: ArrayBuffer | Uint8Array,
  sourceFilename: string,
): Promise<ParsedSupplierPriceList> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(bytes as any);

  const accessories = workbook.worksheets.find((sheet) => sheet.name.trim().toUpperCase() === 'ACCESSORIES');
  if (accessories) return parseSawoSheet(accessories, sourceFilename, 'accessories', 12);

  const rooms = workbook.worksheets.find((sheet) => sheet.name.trim().toUpperCase() === 'SAUNA ROOMS');
  if (rooms) return parseSawoSheet(rooms, sourceFilename, 'sauna_rooms', 10);

  throw new Error(
    'This workbook format is not mapped yet. The original file can be retained, but V3 will not guess supplier price columns. Add a supplier-specific parser first.',
  );
}
