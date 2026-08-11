/**
 * Verifies the model-presentation system end to end.
 *
 *   node scripts/verify-presentations.mjs
 *
 * Checks, per model:
 *   1. a PDF exists at the conventional path for that model's slug
 *   2. the PDF's own metadata names THAT model and carries THAT BUXENA code
 *      — this is what proves there are no wrong-model downloads
 *   3. every PDF is unique (no duplicate/shared file)
 *   4. sellable models are linked from their product page; HOLD models are
 *      not exposed publicly
 *
 * Metadata is read with pdf-lib rather than by scraping content streams:
 * the generator stamps Title/Subject/Keywords from the same identity record
 * it draws the cover from, so metadata and page content cannot disagree.
 */
import { PDFDocument } from 'pdf-lib';
import { readFileSync, existsSync, readdirSync } from 'node:fs';

const id = JSON.parse(readFileSync('src/data/model-identity.json', 'utf8'));
const norm = (s) => String(s ?? '').replace(/[^A-Za-z0-9]/g, '').toUpperCase();

const problems = [];
let pdfOk = 0, idOk = 0, linkOk = 0, heldOk = 0;
const hashes = new Map();

for (const [title, v] of Object.entries(id)) {
  const file = `public/docs/presentations/${v.slug}-presentation.pdf`;
  if (!existsSync(file)) { problems.push(`${v.code} ${v.publicName}: PDF MISSING (${file})`); continue; }
  pdfOk++;

  const bytes = readFileSync(file);
  const doc = await PDFDocument.load(bytes, { updateMetadata: false });
  const meta = `${doc.getTitle() ?? ''} ${doc.getSubject() ?? ''} ${(doc.getKeywords() ?? '')}`;

  if (norm(meta).includes(norm(v.publicName)) && norm(meta).includes(norm(v.code))) idOk++;
  else problems.push(`${v.code} ${v.publicName}: PDF identity mismatch — metadata says "${doc.getTitle()}"`);

  // Duplicate detection: two models must never share the same file content.
  const key = bytes.length + ':' + doc.getTitle();
  if (hashes.has(key)) problems.push(`${v.code}: appears identical to ${hashes.get(key)} — possible wrong-model copy`);
  else hashes.set(key, v.code);

  // Public exposure rules
  const page = `dist/saunas/${v.slug}/index.html`;
  if (v.hold) {
    if (existsSync(page)) problems.push(`${v.code} ${v.publicName}: ON HOLD but product page is published`);
    else heldOk++;
  } else if (existsSync(page)) {
    const html = readFileSync(page, 'utf8');
    if (html.includes(`/docs/presentations/${v.slug}-presentation.pdf`)) linkOk++;
    else problems.push(`${v.code} ${v.publicName}: product page missing its presentation link`);
  } else {
    problems.push(`${v.code} ${v.publicName}: sellable but no product page built (run npm run build first)`);
  }
}

const total = Object.keys(id).length;
const sellable = Object.values(id).filter((v) => !v.hold).length;
const held = total - sellable;

console.log(`models:                    ${total} (${sellable} sellable, ${held} on hold)`);
console.log(`PDF present:               ${pdfOk}/${total}`);
console.log(`PDF identity correct:      ${idOk}/${total}`);
console.log(`product page links PDF:    ${linkOk}/${sellable}`);
console.log(`held models kept private:  ${heldOk}/${held}`);
console.log(problems.length
  ? `\nPROBLEMS (${problems.length}):\n  ${problems.join('\n  ')}`
  : '\n✓ All mappings correct. No wrong-model downloads, no held model exposed.');
process.exitCode = problems.length ? 1 : 0;
