// Dumps xlsx sheets to text for pricing reconciliation. Read-only.
import ExcelJS from 'exceljs';
const file = process.argv[2];
const wb = new ExcelJS.Workbook();
await wb.xlsx.readFile(file);
for (const ws of wb.worksheets) {
  console.log(`\n### SHEET: ${ws.name} (${ws.rowCount} rows)`);
  ws.eachRow({ includeEmpty: false }, (row, n) => {
    if (n > 60) return;
    const vals = row.values.slice(1).map((v) => {
      if (v == null) return '';
      if (typeof v === 'object') return v.result ?? v.text ?? v.richText?.map((r)=>r.text).join('') ?? JSON.stringify(v);
      return v;
    });
    console.log(`${n}: ${vals.join(' | ')}`);
  });
}
