import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';

import { Level01 } from '../src/levels/level-01-mission.js';
import { ENEMY } from '../src/config.js';

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

test('level spawns both enemies instead of swallowing the error', async () => {
  const { level } = await buildLevel();
  assert.equal(level.spawnPoints.length, 2);
  assert.equal(level.enemies.length, 2);   // real Enemy, no longer the throwing stub
});

/**
 * The guard at player.js:98 is `if (!enemy.position || !enemy.config) continue`.
 * An enemy missing either field is skipped SILENTLY — every enemy on screen and
 * zero contact damage, no error anywhere. These are the fields that guard reads.
 */
test('enemies expose exactly the fields player.checkEnemyContact reads', async () => {
  const { level } = await buildLevel();

  for (const enemy of level.enemies) {
    assert.ok(enemy.position instanceof THREE.Vector3, 'enemy.position must be a Vector3');
    assert.ok(enemy.config, 'enemy.config must be an ENEMY entry');
    assert.ok(typeof enemy.config.contactDamage === 'number',
      'enemy.config.contactDamage must be a number');
    assert.ok(enemy.mesh?.isObject3D, 'the paint gun raycasts against enemy.mesh');
  }
});

test('enemy.position is the same Vector3 as mesh.position, so they cannot drift', async () => {
  const { level } = await buildLevel();
  const enemy = level.enemies[0];
  assert.equal(enemy.position, enemy.mesh.position);

  enemy.mesh.position.x += 1;
  assert.equal(enemy.position.x, enemy.mesh.position.x);
});

/**
 * DESIGN.md teaching beats, locked in so a layout tweak cannot quietly delete
 * the lesson: the Charger teaches "paint blue to make it slide past" on island B,
 * and the Sprayer pressures the red pad on island C.
 */
test('the DESIGN.md teaching beats are placed on the right islands', async () => {
  const { level } = await buildLevel();
  const [a, b] = level.enemies;

  assert.equal(a.type, 'charger');
  assert.equal(b.type, 'sprayer');

  // Charger stands on island B (zMin -4, zMax 3.5)
  assert.ok(a.position.z >= -4 && a.position.z <= 3.5,
    `Charger should be on island B, got z=${a.position.z}`);
  // Sprayer stands on island C (zMin -19, zMax -11)
  assert.ok(b.position.z >= -19 && b.position.z <= -11,
    `Sprayer should be on island C, got z=${b.position.z}`);
});

test('the Charger is genuinely faster than the Sprayer, from config not a literal', async () => {
  const { level } = await buildLevel();
  const [charger, sprayer] = level.enemies;
  assert.equal(charger.config, ENEMY.charger);
  assert.equal(sprayer.config, ENEMY.sprayer);
  assert.ok(charger.config.speed > sprayer.config.speed);
});

test('enemy meshes hang off level.root, not straight on the scene', async () => {
  const { game, level } = await buildLevel();
  game.scene.add(level.root);

  for (const enemy of level.enemies) {
    assert.equal(enemy.mesh.parent, level.root);
  }
  // The actual leak vector: a mesh parented to the scene itself survives
  // `scene.remove(level.root)`, so `R` would leave it stranded on screen.
  assert.equal(game.scene.children.includes(level.enemies[0].mesh), false);
});

test('dispose() detaches enemy meshes rather than relying on the base traverse', async () => {
  const { game, level } = await buildLevel();
  game.scene.add(level.root);
  const mesh = level.enemies[0].mesh;

  level.dispose();

  assert.equal(mesh.parent, null, 'enemy mesh should be orphaned, not left under a disposed root');
  assert.equal(game.scene.children.includes(level.enemies[0].mesh), false);
});

test('a colour hit tints the body and reports that it landed', async () => {
  const { level } = await buildLevel();
  const enemy = level.enemies[0];
  const uniform = enemy.bodyMat.uniforms.uColour.value;

  const resting = uniform.getHex();
  assert.equal(enemy.takeColourHit(1), true, 'blue is paint id 1 and must be accepted');
  enemy.update(1 / 60, new THREE.Vector3(999, 999, 999));

  assert.notEqual(uniform.getHex(), resting, 'the body should visibly change colour on a hit');

  // ...and it fades back rather than staying stuck on the hit colour.
  for (let i = 0; i < 200; i++) enemy.update(1 / 60, new THREE.Vector3(999, 999, 999));
  assert.equal(uniform.getHex(), resting, 'the tint must fade back to the base colour');
});

test('an unknown colour id is rejected rather than silently ignored', async () => {
  const { level } = await buildLevel();
  assert.equal(level.enemies[0].takeColourHit(9), false);
});

test('update() with a non-Vector3 leaves the enemy finite rather than NaN', async () => {
  const { level } = await buildLevel();
  const enemy = level.enemies[0];
  const before = enemy.position.clone();

  // The old bug: copy(playerObject) produced NaN in the guard, `NaN > 0.001`
  // was false, and the enemy stood still forever with no error. Refusing to
  // move is fine; poisoning the matrix is not — NaN here would propagate into
  // the mesh world matrix and take rendering with it.
  assert.doesNotThrow(() => enemy.update(1 / 60, { position: new THREE.Vector3() }));

  for (const axis of ['x', 'y', 'z']) {
    assert.ok(Number.isFinite(enemy.position[axis]), `position.${axis} went non-finite`);
  }
  assert.deepEqual(enemy.position.toArray(), before.toArray());
});

test('update() with a real position moves the enemy toward the player', async () => {
  const { level } = await buildLevel();
  const enemy = level.enemies[0];
  const before = enemy.position.clone();

  enemy.update(1 / 60, new THREE.Vector3(0, 0, -10));

  assert.notDeepEqual(enemy.position.toArray(), before.toArray(),
    'a Vector3 argument must actually produce movement');
  assert.ok(enemy.position.z < before.z, 'the Sprayer on island C walks toward -z');
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
