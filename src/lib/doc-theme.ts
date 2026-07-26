/**
 * THE single source of truth for document design — consumed by BOTH output
 * paths: the PDF report kit (src/lib/pdf/report-kit.ts) imports these
 * constants directly; browser printing consumes them as CSS custom
 * properties injected by AdminLayout (admin-print.css references var(--doc-*)).
 *
 * White paper only. Colour exists solely as bronze rules, black rules,
 * black/#444/#333 text, status text colours, and the logo image.
 */

export const DOC_MARGIN_IN = 0.6; // identical top/right/bottom/left, print + PDF
export const DOC_MARGIN_PT = DOC_MARGIN_IN * 72; // 43.2pt

export const DOC_COLORS = {
  bronze: '#9C7A4A',
  ink: '#000000',
  secondary: '#444444',
  footer: '#333333',
  hairline: '#DDDDDD',
} as const;

export const DOC_LOGO = {
  printPx: 160, // compact lockup width in print CSS
  pdfPt: 120,   // equivalent width in PDFs (scaled by width only)
  compactPt: 100, // continuation pages
} as const;

export const DOC_TYPE = {
  titlePt: 21,
  subPt: 8.5,
  bodyPt: 8.5,
  kpiLabelPt: 7.5,
  tableHeaderPt: 7,
  footerPt: 7.5,
  headerRulePt: 1.5,
  footerRulePt: 1,
  tableHeaderRulePt: 2,
} as const;

/** Status text/border colours — shared by PDF tables and print-CSS pills. */
export const DOC_STATUS_COLORS = {
  red: '#A32D2D',   // zero stock / overdue
  amber: '#854F0B', // low stock / warning
  green: '#3B6D11', // healthy / active
  neutral: '#444444',
} as const;

/** CSS custom properties block for injection into the admin layout head. */
export function docThemeCssVars(): string {
  return [
    ':root{',
    `--doc-margin:${DOC_MARGIN_IN}in;`,
    `--doc-bronze:${DOC_COLORS.bronze};`,
    `--doc-ink:${DOC_COLORS.ink};`,
    `--doc-secondary:${DOC_COLORS.secondary};`,
    `--doc-footer:${DOC_COLORS.footer};`,
    `--doc-hairline:${DOC_COLORS.hairline};`,
    `--doc-logo-w:${DOC_LOGO.printPx}px;`,
    `--doc-title-size:${DOC_TYPE.titlePt}pt;`,
    `--doc-sub-size:${DOC_TYPE.subPt}pt;`,
    `--doc-footer-size:${DOC_TYPE.footerPt}pt;`,
    '}',
  ].join('');
}
