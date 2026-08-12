/**
 * File-acceptance rules for the project-upload control. Run with:  npm test
 *
 * The drag-and-drop DOM wiring needs a real browser to confirm. These rules do
 * not, and they are where the mistakes actually live: a MIME type the OS never
 * set, a size limit off by a factor of 1024, a duplicate drop silently
 * doubling an attachment, a picked file quietly replacing a dropped one.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildUploadMeta,
  formatFileSize,
  isAllowedProjectFile,
  mergeProjectFiles,
  MAX_FILES,
  type UploadCandidate,
} from '../src/lib/project-upload-files.ts';

const file = (over: Partial<UploadCandidate> = {}): UploadCandidate => ({
  name: 'photo.jpg',
  size: 200 * 1024,
  type: 'image/jpeg',
  lastModified: 1_700_000_000_000,
  ...over,
});

test('accepts every advertised format', () => {
  const accepted: [string, string][] = [
    ['garden.jpg', 'image/jpeg'],
    ['garden.jpeg', 'image/jpeg'],
    ['plan.png', 'image/png'],
    ['render.webp', 'image/webp'],
    ['drawings.pdf', 'application/pdf'],
  ];
  for (const [name, type] of accepted) {
    assert.ok(isAllowedProjectFile({ name, type }), `${name} (${type}) should be accepted`);
  }
});

test('accepts by extension when the OS reports no MIME type', () => {
  // Windows Explorer leaves `type` empty for some files depending on the
  // registry. Refusing a perfectly good PDF then reads as the feature being
  // broken, not as the file being wrong.
  for (const name of ['plan.PDF', 'garden.JPG', 'shot.jpeg', 'render.WebP']) {
    assert.ok(isAllowedProjectFile({ name, type: '' }), `${name} with empty type`);
  }
});

test('refuses formats we do not advertise', () => {
  assert.equal(isAllowedProjectFile({ name: 'clip.mp4', type: 'video/mp4' }), false);
  assert.equal(isAllowedProjectFile({ name: 'sheet.xlsx', type: 'application/vnd.ms-excel' }), false);
  assert.equal(isAllowedProjectFile({ name: 'notes.txt', type: 'text/plain' }), false);
  assert.equal(isAllowedProjectFile({ name: 'setup.exe', type: '' }), false);
  // A misleading name must not get past the MIME check.
  assert.equal(isAllowedProjectFile({ name: 'invoice.pdf.exe', type: '' }), false);
});

test('a dropped file and a picked file land in the same state', () => {
  const dropped = mergeProjectFiles<UploadCandidate>([], [file({ name: 'a.jpg' })]);
  const picked = mergeProjectFiles<UploadCandidate>([], [file({ name: 'a.jpg' })]);
  assert.deepEqual(dropped.files, picked.files);
  assert.equal(dropped.added, 1);
});

test('a second batch adds to the first instead of replacing it', () => {
  const first = mergeProjectFiles<UploadCandidate>([], [file({ name: 'a.jpg' })]);
  const second = mergeProjectFiles(first.files, [file({ name: 'b.png', type: 'image/png' })]);
  assert.deepEqual(second.files.map((f) => f.name), ['a.jpg', 'b.png']);
  assert.equal(second.added, 1);
});

test('the same file dropped twice attaches once', () => {
  const one = mergeProjectFiles<UploadCandidate>([], [file()]);
  const two = mergeProjectFiles(one.files, [file()]);
  assert.equal(two.files.length, 1);
  assert.equal(two.added, 0, 'a duplicate is a slip, not an instruction');
  assert.deepEqual(two.rejected, [], 'and it is not an error worth shouting about');
});

test('files that differ only by timestamp are treated as different', () => {
  const a = file({ lastModified: 1 });
  const b = file({ lastModified: 2 });
  const result = mergeProjectFiles<UploadCandidate>([a], [b]);
  assert.equal(result.files.length, 2, 'a re-exported photo is a genuinely new file');
});

test('oversize and empty files are refused, with a reason', () => {
  const tooBig = mergeProjectFiles<UploadCandidate>([], [file({ name: 'huge.png', type: 'image/png', size: 11 * 1024 * 1024 })]);
  assert.equal(tooBig.files.length, 0);
  assert.match(tooBig.rejected[0], /huge\.png .*over 10 MB/);

  const empty = mergeProjectFiles<UploadCandidate>([], [file({ name: 'blank.pdf', type: 'application/pdf', size: 0 })]);
  assert.equal(empty.files.length, 0);
  assert.match(empty.rejected[0], /blank\.pdf .*empty/);
});

test('a rejected file never blocks a good one in the same drop', () => {
  const result = mergeProjectFiles<UploadCandidate>(
    [],
    [file({ name: 'clip.mp4', type: 'video/mp4' }), file({ name: 'good.jpg' })]
  );
  assert.deepEqual(result.files.map((f) => f.name), ['good.jpg']);
  assert.equal(result.rejected.length, 1);
  assert.equal(result.added, 1);
});

test('the file count is capped, and says so', () => {
  const many = Array.from({ length: MAX_FILES + 3 }, (_, i) =>
    file({ name: `p${i}.jpg`, lastModified: i })
  );
  const result = mergeProjectFiles<UploadCandidate>([], many);
  assert.equal(result.files.length, MAX_FILES);
  assert.equal(result.rejected.length, 3);
  assert.match(result.rejected[0], new RegExp(`limit is ${MAX_FILES} files`));
});

test('sizes read the way a person expects', () => {
  assert.equal(formatFileSize(1024), '1 KB');
  assert.equal(formatFileSize(1536), '2 KB');
  assert.equal(formatFileSize(2 * 1024 * 1024), '2.0 MB');
});

test('the enquiry metadata is honest about the files not being sent', () => {
  assert.equal(buildUploadMeta([]), '', 'no files means no note at all');
  const meta = buildUploadMeta([file({ name: 'garden.jpg', size: 1024 })]);
  assert.match(meta, /garden\.jpg \(1 KB\)/);
  assert.match(meta, /were not transmitted/);
  assert.match(meta, /request by email reply/);
});
