/**
 * Which stored values are OUR files (and must be signed) versus external
 * links (which pass through untouched). Run with:  npm test
 *
 * This is the decision that makes private storage work. Get it wrong in one
 * direction and a commercially sensitive file renders as an unsigned URL that
 * no longer resolves; get it wrong in the other and an external link gets
 * mangled. Neither failure is loud, so both are pinned here.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { documentStoragePath, isStoredDocument } from '../src/lib/document-access.ts';

const PROJECT = 'https://abcdefgh.supabase.co';

test('recognises the public-URL form every existing row uses', () => {
  // Rows written while the bucket was public, and what uploads still record.
  assert.equal(
    documentStoragePath(`${PROJECT}/storage/v1/object/public/documents/9f8e-4c2a.pdf`),
    '9f8e-4c2a.pdf'
  );
});

test('recognises an already-signed URL that found its way into the column', () => {
  assert.equal(
    documentStoragePath(`${PROJECT}/storage/v1/object/sign/documents/9f8e-4c2a.pdf?token=xyz`),
    '9f8e-4c2a.pdf'
  );
});

test('drops the query string, keeping the object path only', () => {
  assert.equal(
    documentStoragePath(`${PROJECT}/storage/v1/object/public/documents/a.pdf?download=1`),
    'a.pdf'
  );
});

test('decodes a percent-encoded path', () => {
  // A signed URL must be requested with the real object key, not the encoded one.
  assert.equal(
    documentStoragePath(`${PROJECT}/storage/v1/object/public/documents/price%20list.pdf`),
    'price list.pdf'
  );
});

test('external links are not ours and are never rewritten', () => {
  for (const external of [
    'https://capra.ee/downloads/manual.pdf',
    'https://buxena.com/specs/aura.pdf',
    'https://drive.google.com/file/d/123/view',
  ]) {
    assert.equal(documentStoragePath(external), null, external);
    assert.equal(isStoredDocument(external), false, external);
  }
});

test('a different bucket on the same project is not ours', () => {
  // Only the documents bucket is handled here; another bucket would need its
  // own access rules rather than silently inheriting these.
  assert.equal(
    documentStoragePath(`${PROJECT}/storage/v1/object/public/avatars/me.png`),
    null
  );
});

test('empty and missing values are handled, not thrown on', () => {
  assert.equal(documentStoragePath(null), null);
  assert.equal(documentStoragePath(undefined), null);
  assert.equal(documentStoragePath(''), null);
  assert.equal(documentStoragePath('   '), null);
  assert.equal(isStoredDocument(null), false);
});

test('a bucket-shaped URL with no object path is not treated as a file', () => {
  assert.equal(documentStoragePath(`${PROJECT}/storage/v1/object/public/documents/`), null);
});
