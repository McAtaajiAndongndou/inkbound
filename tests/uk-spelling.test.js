// #227: player-facing text is UK/SA English (AGENTS.md rule 10). Scans every
// string literal in the UI and audio code, and the page, for US spellings.
// Code is not text: CSS properties and `style.color` are outside string
// literals or are property names, and three.js's `Color` is not ours.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

const US = /\b(colors?|colored|coloring|grays?|grayed|centers?|centered|behaviors?|favorites?|armor|honor|defense|realiz\w*|organiz\w*|recogniz\w*|analyz\w*|traveled|traveling|canceled|labeled|meters?)\b/gi;
const STRING = /'(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*"|`(?:[^`\\]|\\.)*`/gs;

const files = [
  ...readdirSync('src/ui').filter((f) => f.endsWith('.js')).map((f) => `src/ui/${f}`),
  ...readdirSync('src/audio').filter((f) => f.endsWith('.js')).map((f) => `src/audio/${f}`),
  'src/levels/index.js',
];

test('#227: no US spellings in the UI\'s player-facing strings', () => {
  const found = [];
  for (const file of files) {
    const src = readFileSync(file, 'utf8');
    for (const s of src.matchAll(STRING)) {
      for (const w of s[0].matchAll(US)) found.push(`${file}: "${w[0]}" in ${s[0].slice(0, 60)}`);
    }
  }
  assert.deepEqual(found, []);
});

test('#227: the page text is UK/SA too', () => {
  const text = readFileSync('index.html', 'utf8').replace(/<[^>]+>/g, ' ');
  assert.deepEqual([...text.matchAll(US)].map((m) => m[0]), []);
});

test('#227: the scan does catch a US spelling (it is not vacuous)', () => {
  assert.ok([..."'Pick a color'".matchAll(STRING)].some((s) => US.test(s[0])));
  US.lastIndex = 0;
});
