import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';

import { Level01 } from '../src/levels/level-01-mission.js';
import { Player } from '../src/core/player.js';
import { ENEMY, PLAYER, SURFACE } from '../src/config.js';

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

/**
 * Fog is geometry, not just scene.fog, so main.js needs one handle to switch the
 * whole lot off for the minimap. Without it the mist sheets render as a grey
 * wash straight over the top-down map — switching off scene.fog does not touch
 * them, because they are real meshes.
 */
test('the level groups its atmosphere so a top-down view can drop it', async () => {
  const { level } = await buildLevel();

  assert.ok(level.atmosphere instanceof THREE.Group,
    'main.js hides level.atmosphere for the minimap pass');
  assert.equal(level.atmosphere.parent, level.root,
    'it must hang off root, or dispose() would never free the sky and mist');

  // one sky dome + one sheet per mist layer
  assert.equal(level.atmosphere.children.length, 4);
  // decoration, not something you can paint or stand on
  assert.equal(level.atmosphere.children.every((o) => !o.userData.paintSurface), true);
});

/**
 * The mist must not reach the spawn island, and this is easy to undo by shifting
 * the sheets with no visible error. Island A is where the player learns jump
 * distance, and Gap 1 is the weakest jump in the level — mist there is
 * difficulty, not atmosphere.
 */
test('the mist stops before the spawn island', async () => {
  const { level } = await buildLevel();
  const [islandA] = level.surfaces
    .filter((s) => s.isFloor && s.mesh.position.y === 0)
    .sort((s1, s2) => s2.mesh.position.z - s1.mesh.position.z);

  // the lip the player jumps Gap 1 from
  const islandAFarEdge = islandA.mesh.position.z - islandA.height / 2;

  const mist = level.atmosphere.children.filter((o) => o.material.transparent);
  assert.ok(mist.length > 0, 'expected the mist sheets to be in the atmosphere group');

  for (const sheet of mist) {
    // the texture bakes alpha down to zero over the outer fifth of each end, so
    // the sheet's own +Z edge is already invisible: reaching exactly the lip is
    // the furthest it may go
    const sheetFarEdge = sheet.position.z + sheet.geometry.parameters.height / 2;
    assert.ok(sheetFarEdge <= islandAFarEdge + 1e-6,
      `mist reaches z=${sheetFarEdge}, past island A's lip at z=${islandAFarEdge}`);
  }
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

  // islands A/B/C + the tower's vestibule + deck 1/2/3 (#39 #6)
  assert.equal(floors.length, 7);
  // 2 gates + 3 climb faces + the block you walk around on deck 1
  assert.equal(walls.length, 6);
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

  // Island B is an encounter arena (#37): its exit stays sealed until the
  // Charger is down, so the route only reaches Gap 2 once the fight is won.
  for (const enemy of level.enemies) enemy.takeColourHit(1, 999);
  level.update(1 / 60, { position: new THREE.Vector3(0, 0, 0) });
  assert.equal(level.gateB.open, true, 'clearing island B must open the way to Gap 2');

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

test('extraction is a Box3 on the tower top, reachable at standing height', async () => {
  const { level } = await buildLevel();
  assert.ok(level.extraction instanceof THREE.Box3);

  const top = level.surfaces.find((s) => s.isFloor && s.tower && s.mesh.position.y > 6);
  assert.ok(top, 'expected the tower to have a top deck');

  // a player standing on the top deck, inside the win zone
  assert.equal(level.extraction.containsPoint(new THREE.Vector3(6, top.mesh.position.y, -35.5)), true);
  // the start island is not
  assert.equal(level.extraction.containsPoint(new THREE.Vector3(0, 2, 13)), false);
});

/**
 * THE INVARIANT THAT REPLACED #4, and the reason #4 could not just be deleted.
 *
 * Renda reported the extraction "has things extending from it, like a mini
 * platform with trees on it". It did — a ledge that hung five metres out over the
 * arena. It was load-bearing, not decoration: a green climb cannot top out on its
 * own, because wall contact is tested at chest height, so the climber always
 * loses the wall with their feet below the deck they were heading for and has to
 * jump the last bit. Whatever they jump onto must be UNDER them, and the jump-off
 * always pushes them away from the face — so the deck has to overhang the face by
 * at least that drift.
 *
 * This pins the arithmetic from config, so a future layout cannot quietly delete
 * the overhang and make a climb unlandable. It also pins the converse, which is
 * the subtler half: a lip on a face SHORTER than a jump would clip through the
 * player at chest height, because the head clearance under an overhang is
 * `rise - PLAYER.height`.
 */
test('every green climb has a deck overhanging it by enough to land on (#39 #4, #6)', async () => {
  const { level } = await buildLevel();

  const apex = (PLAYER.jumpSpeed * PLAYER.jumpSpeed) / (2 * -PLAYER.gravity);
  const ableToJump = apex;                      // 1.39 m
  const drift = PLAYER.wallJumpPush * (PLAYER.jumpSpeed / -PLAYER.gravity);

  // the tower's climb faces: paintable, vertical, and taller than a jump. The
  // gates and the block are unpaintable; deck 1's face is only 1.2 m.
  const climbs = level.surfaces.filter((s) => !s.isFloor && !s.unpaintable && s.height > ableToJump);
  assert.equal(climbs.length, 2, 'expected exactly two green climbs (decks 2 and 3)');

  for (const face of climbs) {
    const top = face.mesh.position.y + face.height / 2;
    const deck = level.surfaces.find((s) => s.isFloor && Math.abs(s.mesh.position.y - top) < 1e-6);
    assert.ok(deck, `nothing walkable at the top of the face at z=${face.mesh.position.z}`);

    // how far the deck reaches forward of the face, towards the approaching player
    const overhang = (deck.mesh.position.z + deck.height / 2) - face.mesh.position.z;
    assert.ok(overhang >= PLAYER.radius + drift - 1e-6,
      `the climb at z=${face.mesh.position.z} overhangs only ${overhang.toFixed(2)} m; the `
      + `jump-off drifts ${drift.toFixed(2)} m plus the ${PLAYER.radius} m the collider pushes you out, `
      + 'so the climb cannot land');
  }

  // ...and the jumpable face must NOT have a lip
  const low = level.surfaces.find((s) => !s.isFloor && !s.unpaintable && s.height <= ableToJump);
  assert.ok(low, 'expected deck 1 to be reachable by a plain jump');
  const top = low.mesh.position.y + low.height / 2;
  const deck = level.surfaces.find((s) => s.isFloor && Math.abs(s.mesh.position.y - top) < 1e-6);
  const lowOverhang = (deck.mesh.position.z + deck.height / 2) - low.mesh.position.z;
  assert.ok(lowOverhang <= 0,
    `deck 1 overhangs its face by ${lowOverhang.toFixed(2)} m, but the clearance under a lip is only `
    + `${(low.height - PLAYER.height).toFixed(2)} m — it would cut through the player at chest height`);
});

test('dispose removes root from the scene and is repeatable (no leak on R)', async () => {
  const { game, level } = await buildLevel();
  game.scene.add(level.root);

  assert.doesNotThrow(() => level.dispose());
  assert.equal(game.scene.children.includes(level.root), false);
  assert.doesNotThrow(() => level.dispose());
});

test('level spawns every enemy instead of swallowing the error', async () => {
  const { level } = await buildLevel();
  assert.equal(level.spawnPoints.length, 5);
  assert.equal(level.enemies.length, 5);   // real Enemy, no longer the throwing stub
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

  // island B — the Charger lesson, and only the Charger: a second enemy on the
  // island the player learns ice on is noise.
  const onB = level.enemies.filter((e) => e.position.z >= -7 && e.position.z <= 4.5);
  assert.deepEqual(onB.map((e) => e.type), ['charger'],
    `island B should hold the Charger alone, got ${onB.map((e) => e.type)}`);

  // island C's arena floor — the fight that has to be won before the door opens
  const onC = level.enemies.filter((e) => e.position.z >= -24 && e.position.z <= -16);
  assert.deepEqual(onC.map((e) => e.type).sort(), ['charger', 'sprayer'],
    `island C should hold a Charger and a Sprayer, got ${onC.map((e) => e.type)}`);

  // ...and the two shooters Renda asked for (#39 #6) stand on deck 1
  const onTower = level.enemies.filter((e) => e.position.y > 1);
  assert.deepEqual(onTower.map((e) => e.type), ['sprayer', 'sprayer'],
    `deck 1 should hold two shooters, got ${onTower.map((e) => e.type + '@' + e.position.y)}`);
});

test('the Charger is genuinely faster than the Sprayer, from config not a literal', async () => {
  const { level } = await buildLevel();
  const charger = level.enemies.find((e) => e.type === 'charger');
  const sprayer = level.enemies.find((e) => e.type === 'sprayer');

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

/**
 * #39 #6 — THE TEST THAT MATTERS FOR THE TOWER.
 *
 * The old route's hardest step was a green wall climb, and the only thing that
 * proved it worked was `playGap` landing on island C. The tower is a longer
 * sequence — a jump, then two climbs — and none of it is covered by anything else
 * in this suite. Getting the arithmetic subtly wrong produces a tower that is
 * simply impossible, silently, and nobody would find out until a playtest.
 *
 * So this plays it: walk in through the door, jump onto deck 1, green-climb to
 * deck 2, green-climb to deck 3, and stand in the extraction.
 *
 * Each climb re-seats the player on the deck below before trying again, so what
 * this pins is that the TRANSITION is possible from a legal standing position
 * rather than that one exact script of keypresses works. That is the property the
 * level has to have; a perfect playthrough is a human's job.
 */
test('island C is completable: the door opens, the decks are reachable, the extraction fires (#39 #6)', async () => {
  const { level, game } = await buildLevel();
  let wins = 0;
  game.onWin = () => { wins += 1; };

  // Clear the arena so the door opens (that is the arena gate's job, tested above).
  for (const gate of level.gates) {
    for (const enemy of gate.watch) enemy.takeColourHit(1, 999);
  }
  level.update(1 / 60, { position: new THREE.Vector3(0, 0, 20) });
  assert.equal(level.gateC.open, true, 'the door must open before the tower can be entered');

  const deckAt = (y) => level.surfaces.find((s) => s.isFloor && s.tower && Math.abs(s.mesh.position.y - y) < 1e-6);
  const faceAt = (z) => level.surfaces.find((s) => !s.isFloor && Math.abs(s.mesh.position.z - z) < 1e-6);

  const deck1 = deckAt(1.2);
  const deck2 = deckAt(3.7);
  const deck3 = deckAt(6.2);
  const face2 = faceAt(-31);
  const face3 = faceAt(-34);
  for (const [name, s] of [['deck 1', deck1], ['deck 2', deck2], ['deck 3', deck3],
    ['face 2', face2], ['face 3', face3]]) {
    assert.ok(s, `the tower is missing its ${name}`);
  }

  const input = { isDown: (k) => k === 'KeyW' };   // forward is -z, down the corridor
  const player = new Player(level.surfaces, new THREE.Vector3(4, 0, -21));
  player.onGround = true;

  const standingOn = (deck) => player.onGround
    && Math.abs(player.position.y - deck.mesh.position.y) < 0.05;

  // --- step 1: the JUMP onto deck 1 -----------------------------------------
  const jumpable = deck1.mesh.position.y;
  let reached = false;
  for (let i = 0; i < 400 && !reached; i++) {
    // press at the last moment: the deck's own face blocks you at z = -26.6
    const jump = player.onGround && player.position.z <= -26.2;
    player.update(1 / 60, input, { jump });
    reached = standingOn(deck1);
  }
  assert.ok(reached,
    `never got onto deck 1 by jumping — a ${jumpable} m lip must be a plain jump `
    + `(ended at y=${player.position.y.toFixed(2)}, z=${player.position.z.toFixed(2)})`);

  // --- steps 2 and 3: the GREEN CLIMBS -------------------------------------
  for (const [face, deck, standZ] of [[face2, deck2, -30.6], [face3, deck3, -33.6]]) {
    const top = deck.mesh.position.y;
    assert.equal(face.height > 1.39, true,
      `the face at z=${face.mesh.position.z} is jumpable, so the climb is optional`);

    // paint it every attempt: the green is the route, not a decoration
    face.splat(new THREE.Vector3(6.75, face.mesh.position.y, face.mesh.position.z), 'green', 30);
    assert.equal(face.surfaceAtWorld(new THREE.Vector3(6.75, face.mesh.position.y, face.mesh.position.z)).climbable,
      true, 'the face must be green to be climbable');

    let climbed = false;
    for (let i = 0; i < 900 && !climbed; i++) {
      // Re-seat on the deck below, facing the face, whenever the last attempt fell
      // short. See the note above: this tests the transition, not the playthrough.
      if (player.position.y < top - 2.6 || player.position.z > face.mesh.position.z + 2) {
        player.position.set(6.75, face.mesh.position.y - face.height / 2, standZ);
        player.velocity.set(0, 0, -1);
      }
      // The climb always ends in a jump: wall contact is tested at chest height,
      // so the top ~0.85 m of a face is unreachable and you have to jump the rest.
      const jump = player.climbing && player.position.y > top - 1.2;
      player.update(1 / 60, input, { jump });
      climbed = standingOn(deck);
    }
    assert.ok(climbed,
      `never reached the deck at y=${top} — the face at z=${face.mesh.position.z} is not climbable `
      + `(ended at y=${player.position.y.toFixed(2)}, z=${player.position.z.toFixed(2)})`);
  }

  // --- step 4: walk into the extraction and win ----------------------------
  // `level.update` is what fires the win, not `player.update` — the extraction
  // check is the level's.
  for (let i = 0; i < 400 && wins === 0; i++) {
    player.update(1 / 60, input, { jump: false });
    level.update(1 / 60, player);
  }
  assert.equal(wins, 1,
    `walking the top deck did not reach the extraction `
    + `(y=${player.position.y.toFixed(2)}, z=${player.position.z.toFixed(2)})`);
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
  assert.ok(enemy.position.z < before.z, 'the Charger walks toward the player at -z');
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

/**
 * THE CHARGER HAS TO ACTUALLY CHARGE.
 *
 * This is not a style test. #40 gave every enemy an `attackRange`, and the
 * telegraph PLANTS the enemy while it winds up (`_vel.set(0, 0, 0)` in
 * `startTelegraph`). For the Charger — `canShoot: false`, damage on CONTACT, and
 * the whole of island B's teaching beat resting on a committed straight-line
 * charge — a range meant it started winding up the instant the player was within
 * 8m and stood there instead. It never charged.
 *
 * The failure was invisible in every other way: no error, the enemy still
 * rendered, still faced the player, still dealt damage if you walked into it.
 * It was caught only because the ice test below reads the Charger's heading
 * after driving it, and got the zero vector.
 *
 * Behavioural on purpose: asserting `config.attackRange === undefined` alone
 * would pass again the moment someone moved the plant somewhere else.
 */
test('the Charger charges — nothing plants it before it gets to you', async () => {
  const { level } = await buildLevel();
  const [charger] = level.enemies;                    // island B, the teaching beat

  const islandB = level.surfaces.find((s) => s.isFloor
    && s.mesh.position.z < 0 && s.mesh.position.z > -5);
  const midY = islandB.mesh.position.y;

  // stand it well outside contact range and let it come
  charger.position.set(0, midY, islandB.mesh.position.z + 3);
  const target = new THREE.Vector3(0, midY, islandB.mesh.position.z);

  let peak = 0;
  for (let i = 0; i < 30; i++) {
    charger.update(1 / 60, target);
    peak = Math.max(peak, charger._vel.length());
  }

  assert.ok(peak > 1,
    `the Charger built ${peak.toFixed(2)} m/s in half a second — it is being planted, not charging`);
  assert.equal(charger.telegraphing, false,
    'a windup on the Charger must not stop the charge; a plant discards the momentum the charge IS');
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

  // Island C must be clear before the extraction will fire (#56) — the win
  // condition is the enforcement, independent of the door's collision.
  for (const gate of level.gates) {
    for (const enemy of gate.watch) enemy.takeColourHit(1, 999);
  }

  // standing on the tower's top deck, inside the win zone (#39 #6)
  const player = { position: new THREE.Vector3(7, 6.2, -35.5) };
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
