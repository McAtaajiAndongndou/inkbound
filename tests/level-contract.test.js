import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';

import { Level01 } from '../src/levels/level-01-mission.js';

function makeGame() {
  return { scene: new THREE.Scene(), onWin: null };
}

async function buildLevel() {
  const game = makeGame();
  const level = new Level01(game);
  await level.load();
  return { game, level };
}

test('the level package exposes the fields main.js depends on', async () => {
  const { level } = await buildLevel();

  assert.ok(level.root instanceof THREE.Group);
  assert.ok(Array.isArray(level.surfaces));
  assert.ok(level.spawn instanceof THREE.Vector3);
  assert.ok(Array.isArray(level.spawnPoints));
  assert.ok(Array.isArray(level.enemies));
});

test('every paintable surface is reachable through root AND surfaces', async () => {
  const { level } = await buildLevel();
  const inRoot = [];
  level.root.traverse((o) => { if (o.userData?.paintSurface) inRoot.push(o.userData.paintSurface); });
  assert.equal(inRoot.length, level.surfaces.length);
});

test('spawn is placed on island A where the player starts', async () => {
  const { level } = await buildLevel();
  assert.deepEqual([level.spawn.x, level.spawn.y, level.spawn.z], [0, 2, 13]);
});

test('isFloor is set on every surface (no accidental fall-through / phase-through)', async () => {
  const { level } = await buildLevel();
  assert.equal(level.surfaces.length > 0, true);
  for (const s of level.surfaces) {
    assert.equal(typeof s.isFloor, 'boolean', 'every PaintSurface must set isFloor');
  }
  assert.equal(level.surfaces.some((s) => s.isFloor), true);
  assert.equal(level.surfaces.some((s) => !s.isFloor), true); // the climbable wall
});

test('isFloor splits surfaces the way the player controller will (floors vs walls)', async () => {
  const { level } = await buildLevel();
  const floors = level.surfaces.filter((s) => s.isFloor);
  const walls = level.surfaces.filter((s) => !s.isFloor);

  assert.equal(floors.length, 5); // islands A/B/C + platform + ledge — all walkable
  assert.equal(walls.length, 1);  // the green wall — solid, not walkable
  assert.equal(floors.every((s) => s.isFloor === true), true);
  assert.equal(walls.every((s) => s.isFloor === false), true);
});

test('extraction is a Box3 covering the ledge, reachable at standing height', async () => {
  const { level } = await buildLevel();
  assert.ok(level.extraction instanceof THREE.Box3);
  // a player standing on the ledge (y≈9) is inside the win volume
  assert.equal(level.extraction.containsPoint(new THREE.Vector3(0, 9, -22)), true);
  // the start island is not
  assert.equal(level.extraction.containsPoint(new THREE.Vector3(0, 9, 13)), false);
});

test('the extraction ledge protrudes past the wall so the climb can land on it', async () => {
  const { level } = await buildLevel();
  // the ledge is the highest walkable floor (y=9)
  const ledge = level.surfaces.find((s) => s.isFloor && s.mesh.position.y > 8);
  assert.ok(ledge, 'expected a walkable ledge above y=8');

  ledge.mesh.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(ledge.mesh);
  // the climb pushes the player to z ≈ -18.6; the ledge must extend in front of
  // the wall (z=-19) so the jump-off lands on solid ground
  assert.ok(box.max.z > -19, 'ledge must protrude in front of the wall (got max.z=' + box.max.z + ')');
});

test('dispose removes root from the scene and is repeatable (no leak on R)', async () => {
  const { game, level } = await buildLevel();
  game.scene.add(level.root);

  assert.doesNotThrow(() => level.dispose());
  assert.equal(game.scene.children.includes(level.root), false);
  assert.doesNotThrow(() => level.dispose());
});

test('enemy stub is guarded: level loads with 2 spawn points and empty enemies', async () => {
  const { level } = await buildLevel();
  assert.equal(level.spawnPoints.length, 2);   // two Sprayer points on island B
  assert.equal(level.enemies.length, 0);       // Enemy stub throws → guarded empty
});

test('win fires exactly once when the player enters the extraction volume', async () => {
  const { game, level } = await buildLevel();
  let wins = 0;
  game.onWin = () => { wins += 1; };

  const player = { position: new THREE.Vector3(0, 9, -22) };
  level.update(0.016, player);   // inside → fire
  level.update(0.016, player);   // still inside → must NOT re-fire
  assert.equal(wins, 1);
});

test('win does not fire outside the extraction volume', async () => {
  const { game, level } = await buildLevel();
  let wins = 0;
  game.onWin = () => { wins += 1; };

  const player = { position: new THREE.Vector3(0, 2, 13) };
  level.update(0.016, player);
  assert.equal(wins, 0);
});

test('dispose calls dispose on every enemy before the base traverse', async () => {
  const { level } = await buildLevel();
  let disposed = 0;
  level.enemies = [{ dispose() { disposed += 1; } }, { dispose() { disposed += 1; } }];
  level.dispose();
  assert.equal(disposed, 2);
});

test('repeated load + dispose (R x10) never throws', async () => {
  for (let i = 0; i < 10; i += 1) {
    const game = makeGame();
    const level = new Level01(game);
    await level.load();
    game.scene.add(level.root);
    assert.doesNotThrow(() => level.dispose());
  }
});
