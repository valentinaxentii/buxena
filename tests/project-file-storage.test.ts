/**
 * Object naming for customer project files. Run with:  npm test
 *
 * The customer's filename is untrusted input. It can contain path separators,
 * unicode direction marks, or somebody's home address. Using it as the storage
 * key would put all of that into a URL and, worse, let a crafted name escape
 * the prefix the files are supposed to live under.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { PROJECT_FILE_PREFIX, projectFileObjectPath } from '../src/lib/project-file-storage.ts';

test('the customer filename never becomes the object key', () => {
  const path = projectFileObjectPath('my back garden, 14 Elm Street.jpg');
  assert.equal(path.includes('Elm'), false, 'the address must not reach the storage key');
  assert.equal(path.includes(' '), false);
  assert.match(path, /^project-files\/[0-9a-f-]{36}\.jpg$/);
});

test('every name stays inside the project-files prefix', () => {
  for (const hostile of [
    '../../secret.pdf',
    '/etc/passwd.png',
    '..\\..\\windows\\system32.jpg',
    'a/b/c.png',
  ]) {
    const path = projectFileObjectPath(hostile);
    assert.ok(path.startsWith(`${PROJECT_FILE_PREFIX}/`), hostile);
    // Exactly one separator: the one in the prefix. Nothing traverses.
    assert.equal(path.split('/').length, 2, hostile);
    assert.equal(path.includes('..'), false, hostile);
  }
});

test('two uploads of the same filename never collide', () => {
  const a = projectFileObjectPath('plan.pdf');
  const b = projectFileObjectPath('plan.pdf');
  assert.notEqual(a, b, 'a collision would silently overwrite a customer file');
});

test('the extension survives so the browser opens it correctly', () => {
  assert.match(projectFileObjectPath('a.PDF'), /\.pdf$/, 'lowercased');
  assert.match(projectFileObjectPath('a.jpeg'), /\.jpeg$/);
  assert.match(projectFileObjectPath('a.webp'), /\.webp$/);
});

test('a hostile or absent extension degrades to none rather than passing through', () => {
  assert.match(projectFileObjectPath('noextension'), /^project-files\/[0-9a-f-]{36}$/);
  // A very long "extension" is dropped rather than used as a key fragment.
  assert.match(projectFileObjectPath('a.' + 'x'.repeat(50)), /^project-files\/[0-9a-f-]{36}$/);
  // Separators and control characters are stripped from what remains.
  assert.equal(projectFileObjectPath('a.j/pg').includes('/pg'), false);
});
