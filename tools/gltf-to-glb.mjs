// OWNER: E (Levels)
//
// Pack a .gltf (+ its .bin) into a single, texture-free .glb.
//
// WHY THIS EXISTS
//
// The Quaternius packs ship glTF as `.gltf` + `.bin` + a folder of PNGs. That is
// three kinds of bad for this project:
//
//   1. Inkbound's art direction is flat toon, so every texture is discarded the
//      moment a model loads — but GLTFLoader still resolves, fetches and decodes
//      each PNG first. On lab hardware, on demo day (DESIGN.md:133).
//   2. A .gltf references its .bin and its PNGs BY PATH. Dropping the folder into
//      `public/assets/` means a request per texture per model, and a missing
//      sibling file is a silently untextured or failed model.
//   3. 116 models x one folder each is a directory tree nobody wants to maintain.
//
// So: one model in, one self-contained texture-free .glb out. That is the format
// the game's loader and `tools/strip-glb-textures.mjs` already speak.
//
// The textures are not rewritten — the `images`, `textures` and `samplers`
// arrays and every material slot pointing at them are deleted outright, and the
// leftover PNG bytes stay in the .bin doing no harm. Rewriting the buffer would
// mean renumbering every accessor for a few hundred kilobytes that are never
// decoded.
//
//   node tools/gltf-to-glb.mjs in.gltf out.glb
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, resolve } from 'node:path';

const GLB_MAGIC = 0x46546c67;
const CHUNK_JSON = 0x4e4f534a;
const CHUNK_BIN = 0x004e4942;

/** Every material slot glTF defines that can point at a texture. */
const TEXTURE_SLOTS = [
  'baseColorTexture', 'metallicRoughnessTexture', 'normalTexture', 'occlusionTexture',
  'emissiveTexture', 'specularTexture', 'specularColorTexture', 'clearcoatTexture',
  'clearcoatRoughnessTexture', 'clearcoatNormalTexture', 'sheenColorTexture',
  'sheenRoughnessTexture', 'transmissionTexture', 'thicknessTexture', 'iridescenceTexture',
  'iridescenceThicknessTexture', 'anisotropyTexture',
];

/** The one buffer a .gltf points at, whether it is a file or a data: uri. */
function resolveBuffer(gltf, gltfPath) {
  const buffers = gltf.buffers ?? [];
  if (buffers.length === 0) throw new Error('gltf declares no buffers');
  if (buffers.length > 1) {
    // Quaternius exports are single-buffer. Supporting several would mean
    // concatenating them and offsetting every bufferView, which is a real
    // change and would rather fail loudly than silently corrupt geometry.
    throw new Error(`gltf declares ${buffers.length} buffers; this tool packs one`);
  }

  const { uri } = buffers[0];
  if (!uri) throw new Error('buffer has no uri — this is already a .glb');

  if (uri.startsWith('data:')) {
    const base64 = uri.slice(uri.indexOf(',') + 1);
    return Buffer.from(base64, 'base64');
  }

  const path = isAbsolute(uri) ? uri : resolve(dirname(gltfPath), decodeURIComponent(uri));
  return readFileSync(path);
}

/** Delete the texture plumbing so nothing references the PNG bytes. */
function stripTextureReferences(gltf) {
  const dropped = {
    images: (gltf.images ?? []).length,
    textures: (gltf.textures ?? []).length,
    samplers: (gltf.samplers ?? []).length,
    slots: 0,
  };

  for (const material of gltf.materials ?? []) {
    for (const slot of TEXTURE_SLOTS) {
      if (material[slot]) { delete material[slot]; dropped.slots += 1; }
      if (material.pbrMetallicRoughness?.[slot]) {
        delete material.pbrMetallicRoughness[slot];
        dropped.slots += 1;
      }
    }
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

  // An extension that existed only to describe a texture (KHR_texture_basisu,
  // KHR_materials_pbrSpecularGlossiness, ...) is now a lie. This matters more in
  // `extensionsRequired` than in `extensionsUsed`: GLTFLoader REFUSES to load a
  // file whose required extension it cannot honour, so leaving one behind turns
  // "textures were removed" into "the model does not load at all".
  const dropExtension = (list) => {
    if (!Array.isArray(list)) return;
    for (let i = list.length - 1; i >= 0; i--) {
      if (/texture|specularglossiness/i.test(list[i])) list.splice(i, 1);
    }
    if (list.length === 0) return true;
    return false;
  };

  if (dropExtension(gltf.extensionsUsed)) delete gltf.extensionsUsed;
  if (dropExtension(gltf.extensionsRequired)) delete gltf.extensionsRequired;

  return dropped;
}

function writeGlb(path, gltf, bin) {
  // The BIN chunk must carry the buffer's own length, not the file's: the bytes
  // are identical, but a mismatch here is how a model loads as an empty scene.
  gltf.buffers = [{ byteLength: bin.length }];

  let json = Buffer.from(JSON.stringify(gltf), 'utf8');
  const jsonPad = (4 - (json.length % 4)) % 4;
  if (jsonPad) json = Buffer.concat([json, Buffer.alloc(jsonPad, 0x20)]);

  const binPad = (4 - (bin.length % 4)) % 4;
  const padded = binPad ? Buffer.concat([bin, Buffer.alloc(binPad)]) : bin;

  const total = 12 + 8 + json.length + 8 + padded.length;
  const out = Buffer.alloc(total);

  out.writeUInt32LE(GLB_MAGIC, 0);
  out.writeUInt32LE(2, 4);
  out.writeUInt32LE(total, 8);

  out.writeUInt32LE(json.length, 12);
  out.writeUInt32LE(CHUNK_JSON, 16);
  json.copy(out, 20);

  const binStart = 20 + json.length;
  out.writeUInt32LE(padded.length, binStart);
  out.writeUInt32LE(CHUNK_BIN, binStart + 4);
  padded.copy(out, binStart + 8);

  writeFileSync(path, out);
  return total;
}

function countVertices(gltf) {
  let vertices = 0;
  for (const mesh of gltf.meshes ?? []) {
    for (const primitive of mesh.primitives ?? []) {
      const accessor = gltf.accessors?.[primitive.attributes?.POSITION];
      if (accessor) vertices += accessor.count;
    }
  }
  return vertices;
}

const [input, output] = process.argv.slice(2);
if (!input || !output) {
  console.error('usage: node tools/gltf-to-glb.mjs <in.gltf> <out.glb>');
  process.exit(1);
}

const gltf = JSON.parse(readFileSync(input, 'utf8'));
const bin = resolveBuffer(gltf, input);
const before = { vertices: countVertices(gltf), meshes: (gltf.meshes ?? []).length };
const dropped = stripTextureReferences(gltf);
const bytes = writeGlb(output, gltf, bin);

// Verify by reading our own output back, rather than trusting the writer.
const written = readFileSync(output);
if (written.readUInt32LE(0) !== GLB_MAGIC) throw new Error('wrote something that is not a glb');

const jsonLength = written.readUInt32LE(12);
const roundTripped = JSON.parse(written.subarray(20, 20 + jsonLength).toString('utf8'));
const after = { vertices: countVertices(roundTripped), meshes: (roundTripped.meshes ?? []).length };

if (after.vertices !== before.vertices || after.meshes !== before.meshes) {
  throw new Error(`lost geometry: ${before.vertices}v/${before.meshes} meshes -> ${after.vertices}v/${after.meshes}`);
}

console.log(`${input} -> ${output}  ${(bytes / 1024).toFixed(0)}KB`
  + `  meshes=${after.meshes} verts=${after.vertices}`
  + `  dropped images=${dropped.images} textures=${dropped.textures} slots=${dropped.slots}`);
