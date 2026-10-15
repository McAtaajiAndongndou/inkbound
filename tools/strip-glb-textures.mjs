// OWNER: E (Levels)
//
// Strip textures out of a .glb, keeping the geometry.
//
// Why this exists rather than "just leave the textures in":
//
//   1. Inkbound's art direction is flat toon. Model textures are thrown away the
//      moment the model loads — every mesh that comes off the GLB pipeline is
//      given a plain colour material (see `shaders/avatar.js` for the character
//      version of the same move). Shipping them is shipping megabytes that are
//      never drawn.
//   2. They are not free even though they are unused. GLTFLoader still builds
//      the image and the texture object for every material slot that points at
//      one, and it decodes the PNG to do it. That is load time on lab hardware,
//      on the day of the demo (DESIGN.md:133).
//
// Run it once when a model lands. It rewrites the file in place:
//
//   node tools/strip-glb-textures.mjs public/assets/trees/*.glb
//
// A .glb is a JSON chunk plus a binary chunk. "Stripping" is two steps:
//   a. delete the texture plumbing (images, textures, samplers) and every
//      material slot that pointed at one, so nothing references the bytes;
//   b. repack the binary chunk, keeping only the bufferViews an accessor still
//      uses, so the dead PNG bytes actually leave the file.
import { readFileSync, writeFileSync } from 'node:fs';

const GLB_MAGIC = 0x46546c67;
const CHUNK_JSON = 0x4e4f534a;
const CHUNK_BIN = 0x004e4942;

/** Every material slot glTF defines that can point at a texture. */
const TEXTURE_SLOTS = [
  'baseColorTexture',
  'metallicRoughnessTexture',
  'normalTexture',
  'occlusionTexture',
  'emissiveTexture',
  'specularTexture',
  'specularColorTexture',
  'clearcoatTexture',
  'clearcoatRoughnessTexture',
  'clearcoatNormalTexture',
  'sheenColorTexture',
  'sheenRoughnessTexture',
  'transmissionTexture',
  'thicknessTexture',
  'iridescenceTexture',
  'iridescenceThicknessTexture',
  'anisotropyTexture',
];

function readGlb(path) {
  const buf = readFileSync(path);
  if (buf.readUInt32LE(0) !== GLB_MAGIC) throw new Error(`${path}: not a glb`);

  const json = { chunk: null, bin: null };
  let offset = 12;

  while (offset < buf.length) {
    const length = buf.readUInt32LE(offset);
    const type = buf.readUInt32LE(offset + 4);
    const data = buf.subarray(offset + 8, offset + 8 + length);

    if (type === CHUNK_JSON) json.chunk = JSON.parse(data.toString('utf8'));
    if (type === CHUNK_BIN) json.bin = Buffer.from(data);

    offset += 8 + length;
  }

  if (!json.chunk) throw new Error(`${path}: no JSON chunk`);
  return json;
}

/** Strip every texture reference so no accessor-less byte is still reachable. */
function stripTextureReferences(gltf) {
  const dropped = {
    materials: 0,
    images: (gltf.images ?? []).length,
    textures: (gltf.textures ?? []).length,
    samplers: (gltf.samplers ?? []).length,
  };

  for (const material of gltf.materials ?? []) {
    for (const slot of TEXTURE_SLOTS) {
      if (material[slot]) {
        delete material[slot];
        dropped.materials += 1;
      }
      if (material.pbrMetallicRoughness?.[slot]) {
        delete material.pbrMetallicRoughness[slot];
        dropped.materials += 1;
      }
    }

    // an extension that only exists to describe a texture is now dead weight
    for (const [name, value] of Object.entries(material.extensions ?? {})) {
      if (name.endsWith('Texture') || name === 'KHR_materials_pbrSpecularGlossiness') {
        delete material.extensions[name];
      } else if (value && typeof value === 'object') {
        for (const slot of TEXTURE_SLOTS) delete value[slot];
      }
    }
  }

  delete gltf.images;
  delete gltf.textures;
  delete gltf.samplers;
  for (const key of Object.keys(gltf.extensionsUsed ?? [])) {
    if (gltf.extensionsUsed[key]?.includes('texture')) gltf.extensionsUsed.splice(key, 1);
  }

  return dropped;
}

/**
 * Rebuild the BIN chunk from just the bufferViews the file still uses, and
 * renumber every reference to them. Without this the PNG bytes stay in the file
 * and the "strip" saves nothing.
 */
function repackBin(gltf, bin) {
  const used = new Set();

  for (const accessor of gltf.accessors ?? []) {
    if (accessor.bufferView !== undefined) used.add(accessor.bufferView);
    // sparse accessors carry their own bufferView pointers
    if (accessor.sparse?.indices?.bufferView !== undefined) used.add(accessor.sparse.indices.bufferView);
    if (accessor.sparse?.values?.bufferView !== undefined) used.add(accessor.sparse.values.bufferView);
  }
  // images are gone, so nothing else can reference a bufferView

  const kept = [...used].sort((a, b) => a - b);
  const renumber = new Map();
  const moved = [];
  let total = 0;

  for (const index of kept) {
    const view = gltf.bufferViews[index];
    const start = view.byteOffset ?? 0;
    const bytes = bin.subarray(start, start + view.byteLength);

    // glTF requires each bufferView to start on a 4-byte boundary
    const padding = (4 - (total % 4)) % 4;
    if (padding) total += padding;

    renumber.set(index, moved.length);
    moved.push({ bytes, byteOffset: total, byteLength: view.byteLength, byteStride: view.byteStride });
    total += view.byteLength;
  }

  const nextBin = Buffer.alloc(total);
  for (const view of moved) view.bytes.copy(nextBin, view.byteOffset);

  gltf.bufferViews = moved.map((view) => {
    const out = { buffer: 0, byteOffset: view.byteOffset, byteLength: view.byteLength };
    if (view.byteStride !== undefined) out.byteStride = view.byteStride;
    return out;
  });

  for (const accessor of gltf.accessors ?? []) {
    if (accessor.bufferView !== undefined) {
      accessor.bufferView = renumber.get(accessor.bufferView);
    }
    if (accessor.sparse?.indices?.bufferView !== undefined) {
      accessor.sparse.indices.bufferView = renumber.get(accessor.sparse.indices.bufferView);
    }
    if (accessor.sparse?.values?.bufferView !== undefined) {
      accessor.sparse.values.bufferView = renumber.get(accessor.sparse.values.bufferView);
    }
  }

  gltf.buffers = [{ byteLength: nextBin.length }];
  return nextBin;
}

function writeGlb(path, gltf, bin) {
  let json = Buffer.from(JSON.stringify(gltf), 'utf8');
  const jsonPadding = (4 - (json.length % 4)) % 4;
  if (jsonPadding) json = Buffer.concat([json, Buffer.alloc(jsonPadding, 0x20)]);

  const binPadding = (4 - (bin.length % 4)) % 4;
  const binPadded = binPadding ? Buffer.concat([bin, Buffer.alloc(binPadding)]) : bin;

  const total = 12 + 8 + json.length + 8 + binPadded.length;
  const out = Buffer.alloc(total);

  out.writeUInt32LE(GLB_MAGIC, 0);
  out.writeUInt32LE(2, 4);
  out.writeUInt32LE(total, 8);

  out.writeUInt32LE(json.length, 12);
  out.writeUInt32LE(CHUNK_JSON, 16);
  json.copy(out, 20);

  const binStart = 20 + json.length;
  out.writeUInt32LE(binPadded.length, binStart);
  out.writeUInt32LE(CHUNK_BIN, binStart + 4);
  binPadded.copy(out, binStart + 8);

  writeFileSync(path, out);
}

for (const path of process.argv.slice(2)) {
  const before = readFileSync(path).length;
  const { chunk, bin } = readGlb(path);
  const dropped = stripTextureReferences(chunk);
  const nextBin = repackBin(chunk, bin);
  writeGlb(path, chunk, nextBin);
  const after = readFileSync(path).length;

  const pct = ((1 - after / before) * 100).toFixed(0);
  console.log(
    `${path}: ${(before / 1024).toFixed(0)}KB -> ${(after / 1024).toFixed(0)}KB (-${pct}%)`
    + `  images=${dropped.images} textures=${dropped.textures} material slots=${dropped.materials}`,
  );
}
