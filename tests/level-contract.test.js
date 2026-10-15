import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';

import { Level01 } from '../src/levels/level-01-mission.js';
import { Player } from '../src/core/player.js';
import { ENEMY, SURFACE } from '../src/config.js';

function makeGame() {
  return { scene: new THREE.Scene(), onWin: null };
}

async function buildLevel() {
  const game = makeGame();
  const level = new Level01(game);
  await level.load();
  return { game, level };
}

/** World-space z extent of a floor surface. */
function edgeOf(surface) {
  return {
    zMin: surface.mesh.position.z - surface.height / 2,
    zMax: surface.mesh.position.z + surface.height / 2,
  };
}

/**
 * Play a real gap on the real level: stand on `from`, hold forward, jump at the
 * lip, and report whether the player ends up standing on `to`.
 */
function playGap(level, { from, to, paintBlue = false, pad = false }) {
  const fromEdge = edgeOf(from);
  const toEdge = edgeOf(to);

  if (paintBlue) from.splat(new THREE.Vector3(0, 0, from.mesh.position.z), 'blue', 40);
  if (pad) from.splat(new THREE.Vector3(0, 0, fromEdge.zMin + 0.5), 'red', 1);

  const player = new Player(level.surfaces, new THREE.Vector3(0, 0, fromEdge.zMax - 1));
  player.onGround = true;

  const input = { isDown: (k) => k === 'KeyW' };
  let airborneOverGap = false;

  for (let i = 0; i < 900; i++) {
    // one jump at the lip — the plain route. On a red pad the bounce launches
    // the player before the lip, so this never fires and must not be required.
    const jump = !airborneOverGap && player.onGround && player.position.z <= fromEdge.zMin;
    player.update(1 / 60, input, { jump });

    if (player.position.z <= fromEdge.zMin - 0.3 && !player.onGround) airborneOverGap = true;
    if (player.position.y < -6) return { landed: false, z: player.position.z, y: player.position.y };
    if (airborneOverGap && player.onGround) {
      const { z, y } = player.position;
      // y matters: island C and the platform above it overlap in z, so a landing
      // on the platform would otherwise masquerade as a landing on the island.
      return { landed: z <= toEdge.zMax && z >= toEdge.zMin, z, y };
    }
  }
  return { landed: false, z: player.position.z, y: player.position.y };
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

/**
 * Gap widths are DESIGN numbers, not incidental spacing: Gap 1 is sized to the
 * jump, and Gap 2 is sized to be too wide for blue alone, so the red pad is the
 * only answer. Pinned so a blockout tweak cannot quietly delete the lesson.
 */
test('the gaps keep the widths the design depends on', async () => {
  const { level } = await buildLevel();
  const [a, b, c] = level.surfaces
    .filter((s) => s.isFloor && s.mesh.position.y === 0)
    .sort((s1, s2) => s2.mesh.position.z - s1.mesh.position.z);

  const gap1 = (a.mesh.position.z - a.height / 2) - (b.mesh.position.z + b.height / 2);
  const gap2 = (b.mesh.position.z - b.height / 2) - (c.mesh.position.z + c.height / 2);

  assert.ok(Math.abs(gap1 - 3.5) < 1e-6, `Gap 1 should be 3.5m, got ${gap1}`);
  assert.ok(Math.abs(gap2 - 9) < 1e-6, `Gap 2 should be 9m, got ${gap2}`);
});

/**
 * The widths above are only right if the physics actually agrees. This plays the
 * route on the real geometry: a plain jump must clear Gap 1, blue alone must NOT
 * clear Gap 2, and blue + a red pad at the lip must.
 */
test('L1 is completable: Gap 1 on a jump, Gap 2 only with blue AND red (#53)', async () => {
  const { level } = await buildLevel();
  const [a, b, c] = level.surfaces
    .filter((s) => s.isFloor && s.mesh.position.y === 0)
    .sort((s1, s2) => s2.mesh.position.z - s1.mesh.position.z);

  const g1 = playGap(level, { from: a, to: b });
  assert.equal(g1.landed, true, `Gap 1 must be jumpable on grey, fell at z=${g1.z}`);

  const blueOnly = playGap(level, { from: b, to: c, paintBlue: true });
  assert.equal(blueOnly.landed, false,
    'blue alone must not cross Gap 2, or the red pad is decoration');

  const withPad = playGap(level, { from: b, to: c, paintBlue: true, pad: true });
  assert.equal(withPad.landed, true, `blue + red must clear Gap 2, fell at z=${withPad.z}`);
  // and it must land on the island itself, not skip the Sprayer by landing on
  // the platform above it (the platform is y=4, the island is y=0)
  assert.ok(Math.abs(withPad.y) < 0.5,
    `the super jump should land on island C (y=0), not the platform (y=4): y=${withPad.y}`);
});

test('extraction is a Box3 covering the ledge, reachable at standing height', async () => {
  const { level } = await buildLevel();
  assert.ok(level.extraction instanceof THREE.Box3);
  // a player standing on the ledge (y≈9) is inside the win volume
  assert.equal(level.extraction.containsPoint(new THREE.Vector3(0, 9, -27)), true);
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
  // the climb pushes the player out in front of the wall; the ledge must extend
  // past it (z=-24) so the jump-off lands on solid ground
  assert.ok(box.max.z > -24, 'ledge must protrude in front of the wall (got max.z=' + box.max.z + ')');
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

  // Charger stands on island B (zMin -7, zMax 4.5)
  assert.ok(a.position.z >= -7 && a.position.z <= 4.5,
    `Charger should be on island B, got z=${a.position.z}`);
  // Sprayer stands on island C (zMin -24, zMax -16)
  assert.ok(b.position.z >= -24 && b.position.z <= -16,
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
  // Tolerance, not exact equality: y is recomputed as `origin.y - dist`, so
  // floating-point rounding leaves an ~1e-16 wobble that is not a regression.
  for (const axis of ['x', 'y', 'z']) {
    assert.ok(Math.abs(enemy.position[axis] - before[axis]) < 1e-9,
      `position.${axis} drifted from ${before[axis]} to ${enemy.position[axis]}`);
  }
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

// --- ground probe: the fix for enemies gliding across the void ---------------

test('an enemy stops at the island edge instead of walking into the gap', async () => {
  const { level } = await buildLevel();
  const charger = level.enemies[0];          // island B, zMin -4
  const islandB = level.surfaces.find((s) => s.isFloor
    && s.mesh.position.z < 0 && s.mesh.position.z > -5);

  // Put it hard against the front lip of island B and aim it straight off the
  // edge, at a player standing on island A across Gap 1.
  charger.position.set(0, islandB.mesh.position.y, islandB.mesh.position.z
    + islandB.height / 2 - 0.3);

  for (let i = 0; i < 600; i++) charger.update(1 / 60, new THREE.Vector3(0, 2, 13));

  assert.ok(Number.isFinite(charger.position.y), 'never go NaN or fall');
  assert.ok(charger.position.z <= islandB.mesh.position.z + islandB.height / 2 + 1e-6,
    `charger walked off island B: z=${charger.position.z}`);

  // and it must still be standing on something real
  const ground = charger._probe.down(charger.position);
  assert.ok(ground, 'charger should still be over a floor, not hanging in the air');
});

test('an enemy on a floor it has left stops moving rather than drifting', async () => {
  const { level } = await buildLevel();
  const enemy = level.enemies[0];

  // Park it in the middle of Gap 1, where there is no floor at all.
  enemy.position.set(0, 0, 6);
  const before = enemy.position.clone();

  for (let i = 0; i < 60; i++) enemy.update(1 / 60, new THREE.Vector3(0, 2, 13));

  assert.ok(Math.abs(enemy.position.z - before.z) < 1e-9,
    'no floor means no path, so it should hold position');
});

// --- the DESIGN.md Charger lesson: paint blue, it slides past ---------------

test('paint rules reach the enemy: blue means less traction, more speed, less braking', async () => {
  const { level } = await buildLevel();
  const [charger] = level.enemies;

  const blue = SURFACE.blue;
  const grey = SURFACE.grey;

  assert.ok(blue.traction < grey.traction, 'blue must weaken grip');
  assert.ok(blue.friction < grey.friction, 'blue must weaken braking');
  assert.ok(blue.speedScale > grey.speedScale, 'blue must raise the speed cap');
});

test('on grey a Charger keeps re-aiming at a sidestepping player', async () => {
  const { level } = await buildLevel();
  const [charger] = level.enemies;
  const islandB = level.surfaces.find((s) => s.isFloor
    && s.mesh.position.z < 0 && s.mesh.position.z > -5);

  // Get it moving and committed on grey, then sidestep to +x.
  charger.position.set(0, islandB.mesh.position.y, islandB.mesh.position.z + 3);
  for (let i = 0; i < 30; i++) charger.update(1 / 60, new THREE.Vector3(0, islandB.mesh.position.y, islandB.mesh.position.z));

  const before = charger._vel.clone().setY(0).normalize();
  for (let i = 0; i < 30; i++) charger.update(1 / 60, new THREE.Vector3(4, islandB.mesh.position.y, islandB.mesh.position.z));
  const after = charger._vel.clone().setY(0).normalize();

  assert.ok(before.distanceTo(after) > 0.1,
    'on grippy ground the Charger must visibly turn to follow a sidestep');
});

test('on blue a Charger commits to its heading and slides past a sidestep', async () => {
  const { level } = await buildLevel();
  const [charger] = level.enemies;
  const islandB = level.surfaces.find((s) => s.isFloor
    && s.mesh.position.z < 0 && s.mesh.position.z > -5);
  const midZ = islandB.mesh.position.z;
  const midY = islandB.mesh.position.y;

  // Same setup as above: committed, moving, aimed down -z at the player.
  charger.position.set(0, midY, midZ + 3);
  for (let i = 0; i < 30; i++) charger.update(1 / 60, new THREE.Vector3(0, midY, midZ));

  const speedBefore = charger._vel.length();

  // The player paints the floor under it, then sidesteps to +x.
  islandB.splat(new THREE.Vector3(0, midY, midZ + 3), 'blue', 60);
  const heading = charger._vel.clone().setY(0).normalize();
  for (let i = 0; i < 30; i++) charger.update(1 / 60, new THREE.Vector3(4, midY, midZ));
  const drifted = charger._vel.clone().setY(0).normalize();

  assert.ok(heading.distanceTo(drifted) < 1e-6,
    `heading should be frozen on ice, but it swung to ${drifted.toArray()}`);
  assert.ok(charger._vel.length() > speedBefore * 0.8,
    `momentum should carry across the ice, speed fell ${speedBefore} -> ${charger._vel.length()}`);

  // It carried on past where the player had been standing...
  assert.ok(charger.position.z < midZ,
    `charger should have slid past, ended at z=${charger.position.z} (player was at ${midZ})`);
  // ...without taking the bait. It never turned toward the +x sidestep, which
  // is the whole difference from the grey case above.
  assert.ok(Math.abs(charger.position.x) < 0.01,
    `charger should not have chased the sidestep, x=${charger.position.x}`);
});

test('the enemy reads the paint grid through the same API the player does', async () => {
  const { level } = await buildLevel();
  const [charger] = level.enemies;
  const islandB = charger._probe.floors.find((s) => s.isFloor
    && s.mesh.position.z < 0 && s.mesh.position.z > -5);

  const spot = new THREE.Vector3(0, charger.position.y, charger.position.z);

  assert.equal(charger._probe.down(spot).surface.surfaceAtWorld(spot), SURFACE.grey);

  islandB.splat(spot, 'blue', 3);
  assert.equal(charger._probe.down(spot).surface.surfaceAtWorld(spot), SURFACE.blue,
    'painting the floor must change the rules the enemy reads');
});

test('win fires exactly once when the player enters the extraction volume', async () => {
  const { game, level } = await buildLevel();
  let wins = 0;
  game.onWin = () => { wins += 1; };

  const player = { position: new THREE.Vector3(0, 9, -27) };
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
