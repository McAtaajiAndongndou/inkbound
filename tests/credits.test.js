import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const { CREDITS } = await import('../src/ui/credits.js');

const PUBLIC = 'public';

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

// Everything we ship from public/, except placeholders like .gitkeep.
const shipped = walk(PUBLIC)
  .map((full) => relative(PUBLIC, full).split(sep).join('/'))
  .filter((path) => !path.split('/').some((part) => part.startsWith('.')));

const isUrl = (s) => typeof s === 'string' && /^https:\/\//.test(s);

test('every shipped asset is covered by a credits entry', () => {
  const covered = CREDITS.flatMap((c) => c.files ?? []);
  const missing = shipped.filter((path) =>
    !covered.some((f) => (f.endsWith('/') ? path.startsWith(f) : path === f)));
  assert.deepEqual(missing, [], `add these to src/ui/credits.js: ${missing.join(', ')}`);
});

test('every credits entry points at files that exist (no stale entries)', () => {
  for (const c of CREDITS) {
    for (const f of c.files ?? []) {
      const hit = f.endsWith('/') ? shipped.some((p) => p.startsWith(f)) : shipped.includes(f);
      assert.ok(hit, `${c.what}: ${f} is not in public/`);
    }
  }
});

test('every entry has what, author, licence and an https source', () => {
  for (const c of CREDITS) {
    assert.ok(c.what, 'missing what');
    assert.ok(c.author, `${c.what}: missing author`);
    assert.ok(c.licence, `${c.what}: missing licence`);
    const sources = [].concat(c.source);
    assert.ok(sources.length && sources.every(isUrl), `${c.what}: source must be https link(s)`);
  }
});

test('CC-BY entries carry author, licence link, source and what we changed', () => {
  const ccBy = CREDITS.filter((c) => /CC BY/i.test(c.licence));
  assert.ok(ccBy.length > 0, 'expected at least one CC-BY asset (KolosStudios soldier)');
  for (const c of ccBy) {
    assert.ok(isUrl(c.licenceUrl), `${c.what}: CC-BY needs a licence link`);
    assert.ok(c.changes, `${c.what}: CC-BY needs a note of changes (or "unmodified")`);
  }
});
