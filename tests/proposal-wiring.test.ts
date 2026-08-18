import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path: string) => readFile(new URL(path, import.meta.url), 'utf8');

test('proposal-only admin actions cannot fall through and overwrite quote totals', async () => {
  const source = await read('../src/pages/admin/quotes/[id].astro');
  assert.match(source, /intent === 'send_proposal'/);
  assert.match(source, /intent === 'share_quote' \|\| intent === 'rotate_token'/);
  assert.match(source, /\['update', 'add_item', 'delete_item'\]\.includes\(intent\)/);
  assert.doesNotMatch(source, /outcome\.kind === 'none'\)\s*\{\s*const deliveryCost/);
});

test('proposal sending is safe-mode protected and recorded only after delivery', async () => {
  const source = await read('../src/pages/admin/quotes/[id].astro');
  const action = source.slice(source.indexOf("if (intent === 'send_proposal')"), source.indexOf("if (intent === 'delete_item')"));
  assert.match(action, /isLeadSafeMode\(\)/);
  assert.ok(action.indexOf('const delivery = await sendProposalEmail') < action.indexOf('const sentAt = new Date'));
  assert.match(action, /statusAfterProposalSent/);
  assert.match(action, /Proposal emailed to/);
});

test('proposal acceptance notifies people only after the one-time update succeeds', async () => {
  const source = await read('../src/pages/api/proposal-accept.ts');
  const updatedGuard = source.indexOf('if (updated)');
  assert.ok(updatedGuard > 0);
  assert.ok(source.indexOf('sendProposalAcceptanceEmails', updatedGuard) > updatedGuard);
  assert.match(source, /\.is\('accepted_at', null\)/);
  assert.match(source, /Nothing has been charged|WHAT THIS DELIBERATELY IS NOT/);
});

test('migration contains every field required by proposal delivery and acceptance', async () => {
  const migration = await read('../supabase/migrations/2026-08-13-personalized-quotes.sql');
  for (const column of [
    'share_token', 'viewed_at', 'accepted_at', 'accepted_name',
    'proposal_sent_at', 'proposal_sent_to', 'owner_staff_id',
    'customer_notes', 'internal_notes',
  ]) {
    assert.match(migration, new RegExp(`add column if not exists ${column}\\b`));
  }
});

test('customer proposal receives and renders actionable acceptance errors', async () => {
  const route = await read('../src/pages/proposal/[token].astro');
  const document = await read('../src/components/proposal/CustomerProposalDocument.astro');
  assert.match(route, /searchParams\.get\('error'\)/);
  assert.match(route, /acceptError=\{acceptError\}/);
  assert.match(document, /role="alert"/);
  assert.match(document, /Too many attempts were made/);
});

test('customer proposal PDF is a real token-scoped download, not only window.print', async () => {
  const document = await read('../src/components/proposal/CustomerProposalDocument.astro');
  const route = await read('../src/pages/proposal/[token]/pdf.ts');

  assert.match(document, /href=\{`\/proposal\/\$\{token\}\/pdf`\}/);
  assert.match(document, />Download proposal PDF<\/a>/);
  assert.match(document, /href=\{`\/proposal\/\$\{token\}\/pdf\?view=1`\}/);
  assert.match(document, />Open PDF<\/a>/);
  assert.doesNotMatch(document, /window\.print\(\)/);
  assert.match(route, /isValidShareToken\(token\)/);
  assert.match(route, /\.eq\('share_token', token\)/);
  assert.match(route, /buildQuotePdf/);
  assert.match(route, /Content-Disposition/);
  assert.match(route, /inline \? 'inline' : 'attachment'/);
  assert.match(route, /private, no-store/);
});
