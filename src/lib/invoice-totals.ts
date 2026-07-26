/**
 * THE single calculation path for invoice line items and totals — consumed by
 * both /admin/invoices/new and /admin/invoices/[id]/edit. Money is
 * numeric(12,2) dollars with round-half-up to cents, matching quotes.
 */

export const INVOICE_LINE_TYPES = [
  'product', 'freight', 'crating', 'liftgate', 'delivery_surcharge',
  'installation', 'warranty', 'discount', 'other',
] as const;

export const r2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;

export interface InvoiceItemInput {
  line_type: string;
  model_code: string | null;
  description: string;
  spec_detail: string | null;
  quantity: number;
  unit_price: number;
  line_discount: number;
  line_total: number;
  is_taxable: boolean;
  sort_order: number;
}

/** Parse the form's item_* arrays into items, dropping empty rows. */
export function parseInvoiceItems(form: FormData): InvoiceItemInput[] {
  const lineTypes = form.getAll('item_line_type[]').map(String);
  const modelCodes = form.getAll('item_model_code[]').map(String);
  const descriptions = form.getAll('item_description[]').map(String);
  const specDetails = form.getAll('item_spec_detail[]').map(String);
  const quantities = form.getAll('item_quantity[]').map(Number);
  const unitPrices = form.getAll('item_unit_price[]').map(Number);
  const lineDiscounts = form.getAll('item_line_discount[]').map(Number);
  const taxables = form.getAll('item_taxable[]').map((v) => String(v) === '1');

  return descriptions
    .map((description, i) => ({
      line_type: (INVOICE_LINE_TYPES as readonly string[]).includes(lineTypes[i]) ? lineTypes[i] : 'other',
      model_code: modelCodes[i]?.trim() || null,
      description: description.trim(),
      spec_detail: specDetails[i]?.trim() || null,
      quantity: quantities[i] || 0,
      unit_price: r2(unitPrices[i] || 0),
      line_discount: r2(lineDiscounts[i] || 0),
      line_total: r2((quantities[i] || 0) * (unitPrices[i] || 0) - (lineDiscounts[i] || 0)),
      is_taxable: taxables[i] ?? true,
      sort_order: i,
    }))
    .filter((item) => item.description);
}

export interface InvoiceTotals {
  subtotal: number;
  discount_total: number;
  freight_total: number;
  taxable_subtotal: number;
  non_taxable_subtotal: number;
  tax_rate: number;
  tax_total: number;
  grand_total: number;
}

export function computeInvoiceTotals(
  items: InvoiceItemInput[],
  opts: { taxExempt: boolean; taxRate: number }
): InvoiceTotals {
  const isDiscount = (it: InvoiceItemInput) => it.line_type === 'discount';
  const subtotal = r2(items.filter((it) => !isDiscount(it)).reduce((s, it) => s + it.quantity * it.unit_price, 0));
  const discount_total = r2(
    items.filter((it) => !isDiscount(it)).reduce((s, it) => s + it.line_discount, 0) +
    items.filter(isDiscount).reduce((s, it) => s + it.line_total, 0)
  );
  const freight_total = r2(items.filter((it) => it.line_type === 'freight').reduce((s, it) => s + it.line_total, 0));
  const signed = (it: InvoiceItemInput) => (isDiscount(it) ? -it.line_total : it.line_total);
  const taxable_subtotal = r2(items.filter((it) => it.is_taxable).reduce((s, it) => s + signed(it), 0));
  const non_taxable_subtotal = r2(items.filter((it) => !it.is_taxable).reduce((s, it) => s + signed(it), 0));
  const tax_rate = opts.taxExempt ? 0 : r2(opts.taxRate || 0);
  const tax_total = opts.taxExempt ? 0 : r2(taxable_subtotal * (tax_rate / 100));
  const grand_total = r2(taxable_subtotal + non_taxable_subtotal + tax_total);
  return { subtotal, discount_total, freight_total, taxable_subtotal, non_taxable_subtotal, tax_rate, tax_total, grand_total };
}
