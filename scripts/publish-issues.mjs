import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const DIR = 'docs/issues';
const MILESTONE = 'Spec 2026-10';
const LANES = new Set(['core', 'paint', 'shaders', 'levels', 'ui']);

const sleep = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);

const readme = readFileSync(`${DIR}/README.md`, 'utf8');
const rows = [];

for (const line of readme.split('\n')) {
  const m = line.match(/^\|\s*(\d{3})\s*\|\s*(.+?)\s*\|\s*(core|paint|shaders|levels|ui)\s*\|/);
  if (m) rows.push({ num: m[1], title: m[2].replace(/\*\*/g, '').trim(), lane: m[3] });
}

const files = readdirSync(DIR).filter((f) => /^\d{3}-.+\.md$/.test(f));
const created = [];
const skipped = [];
const failed = [];

for (const row of rows) {
  const file = files.find((f) => f.startsWith(row.num + '-'));
  if (!file) { skipped.push(`${row.num} — no file`); continue; }
  if (!LANES.has(row.lane)) { skipped.push(`${row.num} — bad lane ${row.lane}`); continue; }

  try {
    const out = execFileSync(
      'gh',
      ['issue', 'create',
        '--title', row.title,
        '--body-file', `${DIR}/${file}`,
        '--label', row.lane,
        '--milestone', MILESTONE],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
    ).trim();
    created.push(out);
    console.log('OK   ' + row.num + '  ' + out.split('\n').pop());
  } catch (err) {
    const msg = (err.stderr || err.message || '').toString().split('\n')[0];
    failed.push(`${row.num} — ${msg}`);
    console.log('FAIL ' + row.num + '  ' + msg);
  }

  sleep(1600);
}

console.log('\ndone. created=' + created.length + ' skipped=' + skipped.length + ' failed=' + failed.length);
if (skipped.length) console.log('skipped:\n  ' + skipped.join('\n  '));
if (failed.length) console.log('failed:\n  ' + failed.join('\n  '));
