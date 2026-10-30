// #196 — frost shell refraction.
//
// Before: the shell was an additive rim; nothing behind it bent. Now FrostPass
// renders the scene without the shells into a small target, only while a shell
// is on screen, and the shell samples it offset by its normal. These tests pin
// the "costs nothing when nothing is frozen" rule, the one extra render, the
// shader's inputs and the target's dispose/resize contract.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';

import { FrostPass, frostShells } from '../src/shaders/frost/frost-pass.js';
import { createFrostMaterial, FROST_SCENE } from '../src/shaders/frost/frost-material.js';
import { Enemy } from '../src/enemies/enemy.js';
import { BLUE_FREEZE, ENEMY, FROST, PAINT_IDS } from '../src/config.js';

function countingRenderer(width = 800, height = 600) {
  return {
    renders: 0,
    shellsVisibleDuringCopy: null,
    target: null,
    getDrawingBufferSize(v) { return v.set(width, height); },
    getRenderTarget() { return this.target; },
    setRenderTarget(t) { this.target = t; },
    render() {
      this.renders += 1;
      this.shellsVisibleDuringCopy = frostShells.some((m) => m.visible);
    },
    resize(w, h) { width = w; height = h; },
  };
}

function setup() {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(70, 4 / 3, 0.1, 200);
  camera.position.set(0, 1.6, 6);
  camera.lookAt(0, 1, 0);
  camera.updateMatrixWorld();
  const enemy = new Enemy({ position: new THREE.Vector3(0, 0, 0), config: ENEMY.charger, parent: scene, floors: [] });
  scene.updateMatrixWorld(true);
  return { scene, camera, enemy };
}

const freeze = (enemy) => {
  for (let i = 0; i < BLUE_FREEZE.hitsToFreeze; i++) enemy.takeColourHit(PAINT_IDS.blue, 1);
};

test('no frozen enemy on screen: the pass renders nothing', () => {
  const { scene, camera, enemy } = setup();
  const renderer = countingRenderer();
  const pass = new FrostPass();
  assert.equal(pass.render(renderer, scene, camera), false);
  assert.equal(renderer.renders, 0, 'an unfrozen enemy costs nothing');
  assert.equal(pass.target, null, 'not even a target is built');
  assert.equal(FROST_SCENE.uRefract.value, 0);

  // Frozen, but behind the camera: still nothing.
  freeze(enemy);
  assert.equal(enemy._frostShell.visible, true);
  camera.lookAt(0, 1.6, 20);
  camera.updateMatrixWorld();
  assert.equal(pass.render(renderer, scene, camera), false);
  assert.equal(renderer.renders, 0, 'off screen costs nothing');
  enemy.dispose();
});

test('one frozen enemy on screen: exactly one extra render, at the configured scale', () => {
  const { scene, camera, enemy } = setup();
  const renderer = countingRenderer(800, 600);
  const pass = new FrostPass();
  freeze(enemy);
  assert.equal(pass.render(renderer, scene, camera), true);
  assert.equal(renderer.renders, 1);
  assert.equal(pass.target.width, Math.floor(800 * FROST.sceneScale));
  assert.equal(pass.target.height, Math.floor(600 * FROST.sceneScale));
  assert.equal(renderer.shellsVisibleDuringCopy, false, 'the shells are not in their own copy');
  assert.equal(enemy._frostShell.visible, true, 'and are shown again for the main pass');
  assert.equal(renderer.target, null, 'the main render target is restored');
  assert.equal(FROST_SCENE.uSceneTex.value, pass.target.texture);
  assert.equal(FROST_SCENE.uRefract.value, 1);
  assert.deepEqual(FROST_SCENE.uResolution.value.toArray(), [800, 600]);

  // A dead enemy's shell is not "on screen".
  enemy.takeColourHit(PAINT_IDS.red, 9999);
  enemy.mesh.visible = false;
  pass.render(renderer, scene, camera);
  assert.equal(renderer.renders, 1);
  enemy.dispose();
  assert.equal(frostShells.includes(enemy._frostShell), false, 'disposed shells are untracked');
  pass.dispose();
});

test('the shell material has uSceneTex and uResolution, and the shader refracts with them', () => {
  const material = createFrostMaterial(0x3aa7ff);
  assert.ok('uSceneTex' in material.uniforms);
  assert.ok('uResolution' in material.uniforms);
  assert.equal(material.uniforms.uSceneTex, FROST_SCENE.uSceneTex, 'shared by reference with the pass');
  const src = material.fragmentShader;
  assert.match(src, /uniform sampler2D uSceneTex;/);
  assert.match(src, /gl_FragCoord\.xy \/ uResolution/);
  assert.match(src, /texture2D\(uSceneTex, clamp\(screenUV \+ bend/);
  assert.ok(src.includes(FROST.refractStrength.toFixed(4)), 'refractStrength comes from config');
  assert.match(src, /\(1\.0 - fresnel\)/, 'bends most head-on');
  assert.match(src, /cracks\);/, 'the crack bands kink the offset');
  material.dispose();
});

test('the target is resized with the window and disposed on level unload', () => {
  const { scene, camera, enemy } = setup();
  const renderer = countingRenderer(800, 600);
  const pass = new FrostPass();
  freeze(enemy);
  pass.render(renderer, scene, camera);
  const target = pass.target;

  pass.setSize(1000, 500);   // main.js's resize handler
  assert.equal(target.width, Math.floor(1000 * FROST.sceneScale));
  assert.equal(target.height, Math.floor(500 * FROST.sceneScale));

  renderer.resize(640, 480);  // a resize render() notices by itself
  pass.render(renderer, scene, camera);
  assert.equal(target.width, Math.floor(640 * FROST.sceneScale));

  let disposed = false;
  target.addEventListener('dispose', () => { disposed = true; });
  pass.dispose();
  assert.equal(disposed, true);
  assert.equal(pass.target, null);
  assert.equal(FROST_SCENE.uSceneTex.value, null);
  assert.equal(FROST_SCENE.uRefract.value, 0, 'no copy: the shell is its old additive glow');
  enemy.dispose();
});

test('the copy leaves out unfrozen enemies — except one standing behind the ice', () => {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(70, 4 / 3, 0.1, 200);
  camera.position.set(0, 1.6, 6);
  camera.lookAt(0, 1, 0);
  camera.updateMatrixWorld();
  const make = (x, z) => new Enemy({ position: new THREE.Vector3(x, 0, z), config: ENEMY.charger, parent: scene, floors: [] });
  const frozen = make(0, 0);
  const behind = make(0.3, -4);     // straight behind the ice from this camera
  const aside = make(12, -4);       // nowhere near it on screen
  scene.updateMatrixWorld(true);
  freeze(frozen);

  const seen = {};
  const renderer = countingRenderer();
  renderer.render = function render() {
    this.renders += 1;
    seen.frozen = frozen.mesh.visible && !frozen._frostShell.visible;
    seen.behind = behind.mesh.visible;
    seen.aside = aside.mesh.visible;
  };
  const pass = new FrostPass();
  pass.render(renderer, scene, camera);
  assert.equal(renderer.renders, 1);
  assert.equal(seen.frozen, true, 'the frozen body is in the copy, its shell is not');
  assert.equal(seen.behind, true, 'an enemy behind the ice must stay visible through it');
  assert.equal(seen.aside, false, 'an enemy elsewhere is left out — skinned bodies were most of the cost');
  assert.ok(aside.mesh.visible && behind.mesh.visible, 'everything is shown again for the main pass');
  for (const e of [frozen, behind, aside]) e.dispose();
  pass.dispose();
});
