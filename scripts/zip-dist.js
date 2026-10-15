// Packs dist/ into inkbound.zip for the Moodle upload to the department LAMP
// server (CGV brief, section 5). Run via `npm run deploy:zip`, which builds first.
//
// The archive holds the CONTENTS of dist/, so index.html sits at its top level.
// Before zipping it checks the brief's checklist items a machine can check:
//   - no absolute "/..." URLs in the built HTML/JS/CSS (blank screen on the server)
//   - every "./assets/..." reference matches a shipped file exactly (Linux is
//     case-sensitive), and no filename has spaces
//
// No dependencies: Node's zlib does the deflate and the CRC.
import { readdirSync, readFileSync, statSync, writeFileSync, existsSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { deflateRawSync, crc32 } from 'node:zlib';

const DIST = 'dist';
const OUT = 'inkbound.zip';

if (!existsSync(join(DIST, 'index.html'))) {
  console.error(`No ${DIST}/index.html — run \`npm run build\` first.`);
  process.exit(1);
}

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

const files = walk(DIST)
  .map((full) => ({
    full,
    name: relative(DIST, full).split(sep).join('/'), // zip paths always use "/"
  }))
  .filter(({ name }) => !name.split('/').some((part) => part.startsWith('.'))); // .gitkeep etc.

// --- checks -----------------------------------------------------------------
const problems = [];
const names = new Set(files.map((f) => f.name));

for (const { name } of files) {
  if (/\s/.test(name)) problems.push(`filename has spaces: ${name}`);
}

// Every "./assets/..." reference must match a shipped file EXACTLY. Windows
// forgives "Soldier.glb" vs "soldier.glb"; the Linux server 404s on it.
const ASSET_REF = /(?:\.\/)?assets\/[\w.\-/]+\.\w+/g;
for (const { full, name } of files) {
  if (!/\.(html|js|css)$/.test(name)) continue;
  for (const ref of readFileSync(full, 'utf8').match(ASSET_REF) ?? []) {
    const path = ref.replace(/^\.\//, '');
    if (!names.has(path)) problems.push(`${name} references missing file (check case): ${ref}`);
  }
}

// src="/x", href="/x", url(/x), and "/assets/..." string literals in JS.
// "//cdn..." (protocol-relative) is fine, so a second slash is excluded.
const ABSOLUTE = /(?:src|href)\s*=\s*["']\/(?!\/)|url\(\s*["']?\/(?!\/)|["'`]\/(?:assets|src)\//g;
for (const { full, name } of files) {
  if (!/\.(html|js|css)$/.test(name)) continue;
  const text = readFileSync(full, 'utf8');
  const hits = text.match(ABSOLUTE);
  if (hits) problems.push(`absolute path in ${name}: ${[...new Set(hits)].join(', ')}`);
}

if (problems.length) {
  console.error('Not zipping — these break on the LAMP server:\n  ' + problems.join('\n  '));
  process.exit(1);
}

// --- zip --------------------------------------------------------------------
// Minimal PKZIP writer: one local header + data per file, then the central
// directory, then the end record. Deflate (method 8) for everything.
const now = new Date();
const dosTime = (now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1);
const dosDate = ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();

const chunks = [];
const central = [];
let offset = 0;

for (const { full, name } of files) {
  const data = readFileSync(full);
  const packed = deflateRawSync(data, { level: 9 });
  const crc = crc32(data);
  const nameBuf = Buffer.from(name, 'utf8');

  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50, 0);
  local.writeUInt16LE(20, 4);           // version needed
  local.writeUInt16LE(0x0800, 6);       // flags: UTF-8 names
  local.writeUInt16LE(8, 8);            // deflate
  local.writeUInt16LE(dosTime, 10);
  local.writeUInt16LE(dosDate, 12);
  local.writeUInt32LE(crc, 14);
  local.writeUInt32LE(packed.length, 18);
  local.writeUInt32LE(data.length, 22);
  local.writeUInt16LE(nameBuf.length, 26);
  local.writeUInt16LE(0, 28);

  const entry = Buffer.alloc(46);
  entry.writeUInt32LE(0x02014b50, 0);
  entry.writeUInt16LE(20, 4);           // version made by
  entry.writeUInt16LE(20, 6);           // version needed
  entry.writeUInt16LE(0x0800, 8);
  entry.writeUInt16LE(8, 10);
  entry.writeUInt16LE(dosTime, 12);
  entry.writeUInt16LE(dosDate, 14);
  entry.writeUInt32LE(crc, 16);
  entry.writeUInt32LE(packed.length, 20);
  entry.writeUInt32LE(data.length, 24);
  entry.writeUInt16LE(nameBuf.length, 28);
  entry.writeUInt32LE(offset, 42);      // where the local header starts

  chunks.push(local, nameBuf, packed);
  central.push(entry, nameBuf);
  offset += local.length + nameBuf.length + packed.length;
}

const centralBuf = Buffer.concat(central);
const end = Buffer.alloc(22);
end.writeUInt32LE(0x06054b50, 0);
end.writeUInt16LE(files.length, 8);
end.writeUInt16LE(files.length, 10);
end.writeUInt32LE(centralBuf.length, 12);
end.writeUInt32LE(offset, 16);

const zip = Buffer.concat([...chunks, centralBuf, end]);
writeFileSync(OUT, zip);

const total = files.reduce((n, f) => n + statSync(f.full).size, 0);
console.log(`${OUT}: ${files.length} files, ${(total / 1024).toFixed(0)} KB -> ${(zip.length / 1024).toFixed(0)} KB`);
for (const { name } of files) console.log(`  ${name}`);
console.log('\nNext: test it (npm run serve:dist), then upload inkbound.zip to the Moodle submission.');
