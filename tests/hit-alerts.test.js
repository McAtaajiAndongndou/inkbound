// #216 (also quality-plan B6): a hit, or a level wake, alerts the enemy at any
// range. Both used to clear `sleeping` and leave awareness dormant, so an
// enemy shot from 25 m — or woken 20 m from the door — just stood there.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';

import { Enemy, resetPlayerSignal } from '../src/enemies/enemy.js';
import { PaintSurface } from '../src/paint/paint-surface.js';
import { ENEMY, PAINT_IDS } from '../src/config.js';

const FRAME = 1 / 60;

function ground() {
  const s = new PaintSurface({ width: 80, height: 80, cells: 1 });
  s.mesh.rotation.x = -Math.PI / 2;
  s.mesh.updateMatrixWorld(true);
  s.isFloor = true;
  return s;
}

function charger({ sleeping = true } = {}) {
  resetPlayerSignal?.();
  const floor = ground();
  return new Enemy({
    position: new THREE.Vector3(0, 0, 0), config: ENEMY.charger, parent: new THREE.Group(),
    floors: [floor], surfaces: [floor], blockers: [], sleeping,
  });
}

test('#216: a dormant enemy hit from 25 m is alert on the next update, toward the player', () => {
  const e = charger();
  const player = new THREE.Vector3(0, 0, 25);
  e.update(FRAME, player);
  assert.equal(e.awareness, 'dormant', 'asleep and out of range');
  e.takeColourHit(PAINT_IDS.blue, 1, new THREE.Vector3(0, 1, 0));
  e.update(FRAME, player);
  assert.equal(e.awareness, 'alert');
  assert.ok(e._lastKnown.distanceTo(player) < 1e-6, 'it knows where the shot came from');
});

test('#216: a trap that hurts an enemy alerts it too', () => {
  const e = charger();
  e.takeDamage(1);
  e.update(FRAME, new THREE.Vector3(0, 0, 30));
  assert.equal(e.awareness, 'alert');
});

test('#216: a level-woken enemy is alert toward the player on the frame it wakes', () => {
  const e = charger();
  const player = new THREE.Vector3(0, 0, 20);
  e.update(FRAME, player);
  e.wake();
  e.update(FRAME, player);
  assert.equal(e.awareness, 'alert');
});

test('#216: stealth is unchanged for an enemy nobody touched', () => {
  const e = charger({ sleeping: false });
  for (let i = 0; i < 60; i++) e.update(FRAME, new THREE.Vector3(0, 0, 20));
  assert.equal(e.awareness, 'dormant', '20 m out of its 16 m radius, never hit: still dormant');
});

test('#216: a level calling wake() every frame does not keep an enemy alert forever', () => {
  const e = charger();
  e.wake();
  const far = new THREE.Vector3(0, 0, 60);
  for (let i = 0; i < 60 * 30; i++) { e.wake(); e.update(FRAME, far); }
  assert.notEqual(e.awareness, 'alert', 'only the first wake provokes; then it searches and gives up');
});

test('#216: a turret (ignoresStealth) is unaffected — always alert', () => {
  resetPlayerSignal?.();
  const floor = ground();
  const t = new Enemy({ position: new THREE.Vector3(), config: ENEMY.turret, parent: new THREE.Group(),
    floors: [floor], surfaces: [floor], blockers: [] });
  t.update(FRAME, new THREE.Vector3(0, 0, 40));
  assert.equal(t.awareness, 'alert');
});

test('#216 / B6: an Ascent trailhead Wall-crawler, shot from the spawn, leaves its post within 3 s', async () => {
  const { Level02 } = await import('../src/levels/level-02-ascent.js');
  const level = new Level02({ scene: new THREE.Scene(), onWin: null });
  await level.load();
  const crawler = level.roster.find((r) => r.data.id === 'e1-w2-a').enemy;
  const player = { position: new THREE.Vector3(...level.layout.routes.main[0]), health: 100 };
  const post = crawler.position.clone();
  assert.ok(post.distanceTo(player.position) > 16, 'it waits beyond the awareness radius');
  level.update(FRAME, player);
  crawler.takeColourHit(PAINT_IDS.blue, 1, crawler.position.clone());
  for (let t = 0; t < 3; t += FRAME) level.update(FRAME, player);
  assert.ok(crawler.position.distanceTo(post) > 1, `moved ${crawler.position.distanceTo(post).toFixed(2)} m`);
  level.dispose();
});
