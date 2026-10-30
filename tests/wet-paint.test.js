// #194 — wet paint: the paint map as a height map, gloss, and a sky reflection.
//
// Before this issue the paint shader lit every surface with a flat diffuse:
// fresh paint and dead grey had the same sheen, there was no bump/height map
// and no reflection anywhere in the game. These tests pin the uniforms, the
// maths (ported to JS — node has no GPU), the probe's render budget and the
// dispose contract.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';

import {
  createPaintMap, createPaintMaterial, PAINT_ENV,
  paintHeight, wetSpecular, wetReflection,
} from '../src/shaders/paint-material.js';
import { SkyProbe } from '../src/shaders/sky-probe.js';
import { PaintSurface } from '../src/paint/paint-surface.js';
import { LEVELS } from '../src/levels/index.js';
import { PAINT, PAINT_WET } from '../src/config.js';

/** A renderer that only counts: enough of the API for CubeCamera.update. */
function countingRenderer() {
  return {
    renders: 0,
    coordinateSystem: THREE.WebGLCoordinateSystem,
    xr: { enabled: false },
    getRenderTarget: () => null,
    getActiveCubeFace: () => 0,
    getActiveMipmapLevel: () => 0,
    setRenderTarget() {},
    render() { this.renders += 1; },
  };
}

const norm = (v) => { const l = Math.hypot(...v); return v.map((x) => x / l); };

test('the paint material has uEnvMap and uWet, and the shader uses them', () => {
  const material = createPaintMaterial(createPaintMap(8, 8), 4);
  assert.ok('uEnvMap' in material.uniforms, 'uEnvMap missing');
  assert.ok('uWet' in material.uniforms, 'uWet missing');
  assert.equal(material.uniforms.uWet.value, 1, 'open ground is wet paint when painted');

  const src = material.fragmentShader;
  assert.match(src, /uniform samplerCube uEnvMap;/);
  assert.match(src, /uniform float\s+uWet;/);
  assert.match(src, /textureCube\(uEnvMap, reflect\(-V, n\)\)/, 'the sky is sampled along the reflected ray');
  assert.match(src, /paintHeight\(vUv\)/, 'the paint map is read as a height map');
  // Config reaches the GLSL (every number lives in config.js).
  assert.ok(src.includes(PAINT_WET.shininess.toFixed(4)));
  assert.ok(src.includes(PAINT_WET.reflectStrength.toFixed(4)));
  assert.ok(src.includes(PAINT_WET.bumpStrength.toFixed(4)));
  // The vertex half writes the tangent frame the fragment half bends.
  assert.match(material.vertexShader, /vTangent\s+=/);
  assert.match(material.vertexShader, /vBitangent\s+=/);
});

test('every paint material reads ONE shared sky uniform', () => {
  const a = createPaintMaterial(createPaintMap(4, 4), 4);
  const b = createPaintMaterial(createPaintMap(4, 4), 4);
  assert.equal(a.uniforms.uEnvMap, b.uniforms.uEnvMap);
  assert.equal(a.uniforms.uEnvMap, PAINT_ENV.uEnvMap);
  // ...while the per-surface ones stay per-surface.
  assert.notEqual(a.uniforms.uWet, b.uniforms.uWet);
});

test('a sealed face is never wet', () => {
  const sealed = new PaintSurface({ width: 4, height: 4, cells: 2, unpaintable: true });
  assert.equal(sealed.material.uniforms.uWet.value, 0);
});

test('height: 1 inside a blob, 0 on grey, sloped only at the rim', () => {
  const inside = paintHeight(1, 1, 1, 1, 0.3, 0.7);
  assert.equal(inside.h, 1);
  assert.equal(inside.du, 0);
  assert.equal(inside.dv, 0);

  const grey = paintHeight(0, 0, 0, 0, 0.5, 0.5);
  assert.equal(grey.h, 0);
  assert.equal(grey.du, 0);

  // Painted on the left (a, d), grey on the right (b, e): the height falls
  // toward +u, so dh/du is negative and steepest halfway across.
  const rim = paintHeight(1, 0, 1, 0, 0.5, 0.5);
  assert.equal(rim.h, 0.5);
  assert.ok(rim.du < 0);
  assert.equal(rim.dv, 0);
  assert.ok(Math.abs(rim.du) > Math.abs(paintHeight(1, 0, 1, 0, 0.1, 0.5).du), 'steepest mid-rim');
});

test('gloss: a painted cell facing the light shines; a grey cell never does', () => {
  const n = [0, 1, 0];
  const l = norm([0.3, 1, 0.2]);
  const v = norm([-0.3, 1, -0.2]);       // the mirror direction: peak highlight
  assert.ok(wetSpecular(n, l, v, 1) > 0, 'painted cell has a highlight');
  assert.ok(Math.abs(wetSpecular(n, l, v, 1) - PAINT_WET.specular) < 1e-9, 'full strength at the mirror angle');
  assert.equal(wetSpecular(n, l, v, 0), 0, 'grey is matte');
  // A face turned away from the sun gets no highlight however it is viewed.
  assert.equal(wetSpecular([0, -1, 0], l, [0, -1, 0], 1), 0);
});

test('reflection: Fresnel — sky at a grazing angle, paint head-on, capped for readability', () => {
  const headOn = wetReflection(1, 1);
  const grazing = wetReflection(0, 1);
  assert.ok(grazing > headOn * 5, 'grazing mirrors far more than head-on');
  assert.ok(grazing <= PAINT_WET.reflectStrength + 1e-9, 'never more than the cap');
  assert.equal(wetReflection(0, 0), 0, 'grey mirrors nothing');

  // Readability: at the worst case (grazing, sky = Corp grey) blue still reads
  // as blue — its blue channel still dominates.
  const blue = new THREE.Color(PAINT.blue.hex);
  const sky = new THREE.Color(PAINT.grey.hex);
  const seen = blue.clone().lerp(sky, grazing);
  assert.ok(seen.b > seen.r * 1.5 && seen.b > seen.g, 'blue under a grey sky is still blue');
});

test('SkyProbe renders once when built and again only on refresh()', () => {
  const renderer = countingRenderer();
  const atmosphere = new THREE.Group();
  const probe = new SkyProbe({ atmosphere, renderer });
  assert.equal(probe.renders, 1);
  assert.equal(renderer.renders, 6, 'one cube = six faces');
  assert.equal(PAINT_ENV.uEnvMap.value, probe.target.texture, 'the paint now mirrors this sky');
  assert.equal(PAINT_ENV.uEnvOn.value, 1);

  // Nothing renders by itself — there is no per-frame path at all.
  assert.equal(typeof probe.update, 'undefined');
  assert.equal(renderer.renders, 6);

  probe.refresh();
  assert.equal(probe.renders, 2);
  assert.equal(renderer.renders, 12);

  probe.dispose();
  assert.equal(PAINT_ENV.uEnvMap.value, null);
  assert.equal(PAINT_ENV.uEnvOn.value, 0, 'no probe: paint is never mixed toward black');
});

test('without a renderer (node, tests) the probe renders nothing and the paint mirrors nothing', () => {
  const probe = new SkyProbe({ atmosphere: new THREE.Group() });
  assert.equal(probe.renders, 0);
  assert.equal(PAINT_ENV.uEnvOn.value, 0);
  probe.dispose();
});

for (const entry of LEVELS) {
  test(`${entry.name}: ten reloads leak nothing — every probe target is disposed`, async () => {
    const renderer = countingRenderer();
    const disposed = new Set();
    const targets = [];
    let previous = null;
    for (let i = 0; i < 10; i++) {
      const game = { scene: new THREE.Scene(), renderer };
      const level = entry.create(game);
      await level.load();
      assert.ok(level.skyProbe, 'the level builds a sky probe');
      assert.equal(level.skyProbe.renders, 1, 'rendered once at load');
      const target = level.skyProbe.target;
      targets.push(target);
      target.addEventListener('dispose', () => disposed.add(target));
      // main.js order: the next level is built BEFORE the old one is disposed.
      // The old level's dispose must not blank the new level's shared sky.
      if (previous) {
        previous.dispose();
        assert.equal(PAINT_ENV.uEnvMap.value, target.texture, 'the loading level keeps its sky');
        assert.ok(!disposed.has(target));
      }
      previous = level;
    }
    previous.dispose();
    assert.equal(disposed.size, 10, 'every cube render target was freed');
    assert.equal(PAINT_ENV.uEnvMap.value, null);
  });
}
