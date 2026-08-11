import ExcelJS from 'exceljs';
const wb = new ExcelJS.Workbook();
await wb.xlsx.readFile('C:/Users/valen/Downloads/Buxena_Supplier_Landed_Cost_Master.xlsx');
const ws = wb.getWorksheet('Master Data');
ws.eachRow({ includeEmpty: false }, (row, n) => {
  if (n < 36 || n > 81) return;
  const v = row.values.slice(1).map((x) => (x && typeof x === 'object' ? (x.result ?? x.text ?? '') : (x ?? '')));
  // key | supplier | series | model | spec | segment | EXW base | EXW$ | landed | retail input | margin%
  console.log(`${n}: ${v[1]} | ${v[3]} | ${v[4]} | ${v[5]} | ${v[8]} | EXW€${v[12]} | landed$${Math.round(v[19] ?? 0)} | retail$${v[21] ?? '—'} | m${((v[23] ?? 0) * 100).toFixed(0)}%`);
});
