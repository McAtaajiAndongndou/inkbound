import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';

import {
  FOG_FLOOR,
  FOG_CEIL,
  createFogHeightUniforms,
  FOG_HEIGHT_PARS,
  FOG_HEIGHT_FRAGMENT,
} from '../src/shaders/fog-height.js';
import { createPaintMap, createPaintMaterial } from '../src/shaders/paint-material.js';
import { createToonMaterial, createOutlineMesh } from '../src/shaders/toon/toon-material.js';

/**
 * Height fog wiring.
 *
 * Why these tests exist at all: every failure mode here is SILENT. A missing
 * `fog: true` makes the #includes compile to nothing. A missing uniform makes
 * three.js either throw (its own fog uniforms) or quietly read 0 (ours). A
 * copy-paste that shares one uniform object between two materials shows up
 * much later as one surface mysteriously changing. None of that is visible in
 * the browser until it looks subtly wrong, so it is pinned here instead.
 */

/** Every construction path a fogged material can take. */
function everyFoggedMaterial() {
  const paintMap = createPaintMap(4, 4);
  const source = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));

  return [
    { name: 'paint', material: createPaintMaterial(paintMap) },
    { name: 'toon', material: createToonMaterial(0x4ee08a) },
    { name: 'outline', material: createOutlineMesh(source).material },
  ];
}

test('the fog-height chunks are consistent with each other', () => {
  assert.match(FOG_HEIGHT_PARS, /uniform float uFogFloor;/);
  assert.match(FOG_HEIGHT_PARS, /uniform float uFogCeil;/);

  // the fragment half must read everything the head declares, plus world height
  assert.match(FOG_HEIGHT_FRAGMENT, /uFogFloor/);
  assert.match(FOG_HEIGHT_FRAGMENT, /uFogCeil/);
  assert.match(FOG_HEIGHT_FRAGMENT, /vWorldPos\.y/);
  assert.match(FOG_HEIGHT_FRAGMENT, /fogFactor/);

  // both halves must be inert without fog, or an unfogged scene still pays
  assert.match(FOG_HEIGHT_PARS, /#ifdef USE_FOG/);
  assert.match(FOG_HEIGHT_FRAGMENT, /#ifdef USE_FOG/);

  assert.ok(FOG_FLOOR < FOG_CEIL, 'the fade must have a direction');
});

test('createFogHeightUniforms hands out fresh objects, never a shared one', () => {
  const a = createFogHeightUniforms();
  const b = createFogHeightUniforms();

  assert.equal(a.uFogFloor.value, FOG_FLOOR);
  assert.equal(a.uFogCeil.value, FOG_CEIL);

  // two materials sharing one uniform object only shows up as a mystery later
  assert.notEqual(a.uFogFloor, b.uFogFloor);
  assert.notEqual(a.uFogCeil, b.uFogCeil);

  // and it must accept overrides, which is the seam a level would use
  assert.equal(createFogHeightUniforms(1, 9).uFogCeil.value, 9);
});

test('every fogged material gets the full set of fog uniforms', () => {
  // three.js writes these four every frame from scene.fog; a missing one throws
  const threeOwned = ['fogColor', 'fogNear', 'fogFar', 'fogDensity'];

  for (const { name, material } of everyFoggedMaterial()) {
    assert.equal(material.fog, true, `${name}: without fog:true every #include compiles to nothing`);

    for (const key of threeOwned) {
      assert.ok(material.uniforms[key], `${name}: missing ${key}`);
    }
    assert.ok(material.uniforms.uFogFloor, `${name}: missing uFogFloor`);
    assert.ok(material.uniforms.uFogCeil, `${name}: missing uFogCeil`);
  }
});

test('every fogged material actually applies the height term', () => {
  for (const { name, material } of everyFoggedMaterial()) {
    assert.match(material.fragmentShader, /heightFalloff/, `${name}: height term never applied`);

    // step 1 of the three-step contract: the vertex shader must provide the
    // varying the fragment half reads, or this is a GLSL compile error.
    // \s+ because the existing shaders align their declarations with extra
    // spaces, and this test is about wiring, not formatting.
    assert.match(material.vertexShader, /varying\s+vec3\s+vWorldPos\s*;/, `${name}: no vWorldPos varying`);
    assert.match(material.vertexShader, /vWorldPos\s*=/, `${name}: vWorldPos declared but never filled`);
    assert.match(material.fragmentShader, /varying\s+vec3\s+vWorldPos\s*;/, `${name}: fragment half cannot see vWorldPos`);

    // the built-in chunk must be gone, not merely followed by ours
    assert.doesNotMatch(material.fragmentShader, /#include <fog_fragment>/, `${name}: still uses the built-in fog`);
  }
});

test('no two materials share a uniform object', () => {
  // Regression guard for UniformsUtils.merge()-style mistakes, which clone
  // values and would leave the paint texture stale.
  const mats = everyFoggedMaterial();
  const seen = new Set();

  for (const { name, material } of mats) {
    for (const key of ['uFogFloor', 'uFogCeil', 'fogColor']) {
      const uniform = material.uniforms[key];
      assert.ok(uniform, `${name}: missing ${key}`);
      assert.ok(!seen.has(uniform), `${name}: ${key} is shared with another material`);
      seen.add(uniform);
    }
  }
});

/**
 * three.js hands the shader fogColor in OUTPUT colour space, so the fog mix is
 * only correct if the colour has already been converted. #41 did that for the
 * toon material and missed the paint material; this pins both.
 *
 * The ORDER matters as much as the include: three.js's own materials run
 * colorspace_fragment and only then fog_fragment.
 */
test('every material converts colour space before it fogs', () => {
  for (const { name, material } of everyFoggedMaterial()) {
    const fragment = material.fragmentShader;
    const colorspace = fragment.indexOf('#include <colorspace_fragment>');
    const fog = fragment.indexOf('heightFalloff');

    // the outline writes pure black, and black is black in any colour space, so
    // it legitimately has no conversion to do
    if (name === 'outline') {
      assert.equal(colorspace, -1, 'outline needs no conversion: it writes 0,0,0');
      continue;
    }

    assert.ok(fog !== -1, `${name}: expected the fog chunk to be inlined`);
    assert.ok(colorspace !== -1, `${name}: missing colorspace_fragment`);
    assert.ok(colorspace < fog, `${name}: fog must run AFTER the colour space conversion`);
  }
});

test('the paint texture stays the real one, not a cloned copy', () => {
  // UniformsUtils.merge() would clone uPaintMap; PaintSurface would then flip
  // needsUpdate on a texture the GPU is no longer reading and paint would
  // silently stop appearing.
  const paintMap = createPaintMap(4, 4);
  const material = createPaintMaterial(paintMap);

  assert.equal(material.uniforms.uPaintMap.value, paintMap.texture);
  assert.equal(material.uniforms.uColours.value.length, 4);
  assert.ok(material.uniforms.uLightDir);
});
