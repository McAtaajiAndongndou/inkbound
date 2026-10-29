import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';

import { Level01 } from '../src/levels/level-01-mission.js';
import { Enemy } from '../src/enemies/enemy.js';
import { Player } from '../src/core/player.js';
import { ENEMY, HEALTH, PLAYER, SURFACE } from '../src/config.js';

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
  assert.deepEqual([level.spawn.x, level.spawn.y, level.spawn.z], [0, 2, 21]);
});

/**
 * Island A is the VANTAGE, not a fight (playtest, 24 Oct; docs/levels/01-outskirts.md).
 * It carries no enemies and no hazard, so the first fight is the first thing past
 * Gap 1 rather than something to shoot from spawn. This is deliberately a
 * "nothing is there" test: the failure mode is clutter creeping back in.
 */
test('island A has no enemies and no hazards — it is the vantage', async () => {
  const { level } = await buildLevel();

  const onIslandA = level.enemies.filter((e) => e.position.z > 8);
  assert.equal(onIslandA.length, 0,
    'an enemy on the entry island is target practice: it has no geometry to fight in');

  assert.equal(level.traps?.length ?? 0, 0,
    'a hazard on a 22 m-wide island can always be walked around');
});

/**
 * #012: B must be a ROOM, not a rectangle. One solid block that splits the floor
 * and CANNOT be climbed — height is the enemy's, not the player's. A climbable
 * deck with nothing on it was the best square in the room (playtest, 28 Oct).
 */
test("island B's deck is a solid block you cannot climb (#012)", async () => {
  const { level } = await buildLevel();
  const DECK_Y = 4.6;

  const deck = level.surfaces.find(
    (s) => s.isFloor && Math.abs(s.mesh.position.y - DECK_Y) < 1e-6,
  );
  assert.ok(deck, 'island B is missing its deck');
  const z = deck.mesh.position.z;
  assert.ok(z > -7 && z < 4.5, `the deck at z=${z} is not on island B`);

  // Above the red-bounce apex, so there is no cheap way on top of it.
  const apex = (PLAYER.minBounce * PLAYER.minBounce) / (2 * -PLAYER.gravity);
  assert.ok(DECK_Y > apex,
    `a ${DECK_Y} m deck is reachable by a ${apex.toFixed(2)} m red bounce`);

  // Solid: four closed sides, none paintable, so no green climb either.
  // Scoped to island B by z — C's block is also 4.6 m tall.
  const faces = level.surfaces.filter((s) => !s.isFloor
    && Math.abs(s.mesh.position.y - DECK_Y / 2) < 1e-6
    && s.mesh.position.z > -7 && s.mesh.position.z < 4.5);
  assert.equal(faces.length, 4, 'the deck must be closed on four sides');
  assert.ok(faces.every((f) => f.unpaintable),
    'a climbable deck is a perch again');

  // Floor either side of it, so it splits the room instead of walling it off.
  const box = new THREE.Box3().setFromObject(deck.mesh);
  assert.ok(box.min.x - -11 >= 2, 'no lane left of the deck');
  assert.ok(11 - box.max.x >= 2, 'no lane right of the deck');
});

/**
 * Walls are solid to the AI too. Until the wall probe existed, every cover block
 * in the game was player-only: Chargers walked straight through island C's block
 * and the room's shape meant nothing to them (playtest, 28 Oct).
 */
test('a wall is solid to an enemy — cover is not player-only (#014)', async () => {
  const { level } = await buildLevel();
  const charger = level.gateC.watch.find((e) => e.type === 'charger');
  charger.wake();

  // C's block: 4 x 2 at y 3.0, solid. Stand the charger behind it and make it
  // chase a target on the far side — it must stop at the face, not pass through.
  const block = level.surfaces.find(
    (s) => s.isFloor && Math.abs(s.mesh.position.y - 3.0) < 1e-6,
  );
  assert.ok(block, 'island C is missing its block');
  const backFace = block.mesh.position.z - block.height / 2;
  const bx = block.mesh.position.x;

  charger.position.set(bx, 0, backFace - 1);
  for (let i = 0; i < 180; i++) {
    charger.update(1 / 60, new THREE.Vector3(bx, 0, backFace + 3));
  }

  assert.ok(charger.position.z < backFace,
    `the charger walked through C's block: z=${charger.position.z.toFixed(2)}, face at ${backFace}`);
});

/**
 * Enemies walk from load, so without a trigger every arena's fight is already
 * standing at its lip when the player arrives. The dormant trigger is per arena:
 * they hold their spawn until the player is inside it.
 */
test('enemies hold their spawn until the player enters their arena (#012)', async () => {
  const { level } = await buildLevel();
  const b = level.gateB.watch;
  const spawn = b.map((e) => e.position.clone());

  const atA = { position: new THREE.Vector3(0, 0, 21) };
  for (let i = 0; i < 120; i++) level.update(1 / 60, atA);

  b.forEach((e, i) => {
    assert.equal(e.sleeping, true, 'B must still be asleep while the player is on A');
    assert.ok(e.position.distanceTo(spawn[i]) < 1e-9,
      'a sleeping enemy must not walk to the lip before the jump');
  });

  // Land in B: the arena wakes, and the fight starts where it was placed.
  level.update(1 / 60, { position: new THREE.Vector3(0, 0, 3) });
  assert.ok(b.every((e) => e.sleeping === false), 'landing in B must wake its arena');
});

/**
 * A wall must stop a gun as well as a body. Until line-of-sight existed, a
 * Sprayer shot through every block in the level, so no position was cover from
 * fire — which is why cover could not create a choice (playtest, 28 Oct).
 */
test("a wall blocks an enemy's line of fire (#014)", async () => {
  const { level } = await buildLevel();
  const sprayer = level.gateC.watch.find((e) => e.type === 'sprayer');

  const block = level.surfaces.find(
    (s) => s.isFloor && Math.abs(s.mesh.position.y - 3.0) < 1e-6,
  );
  const back = block.mesh.position.z - block.height / 2 - 1;
  const front = block.mesh.position.z + block.height / 2 + 1;
  const bx = block.mesh.position.x;

  sprayer.position.set(bx, 0, back);

  assert.equal(
    sprayer._canSee(new THREE.Vector3(bx, 0, front)),
    false,
    "the block must block the Sprayer's shot",
  );
  assert.equal(
    sprayer._canSee(new THREE.Vector3(bx - 10, 0, back + 2)),
    true,
    'with no wall between, the shot must be clear',
  );
});

/**
 * Decor keep-out. The block is 3 m of hard cover in a forest; without a keep-out
 * rect trees grew through it and hid the lane around it (playtest, 29 Oct). This
 * is the check I should have run before claiming the block was clear.
 */
test("nothing grows through C's block — decor keep-out is empty (#014)", async () => {
  const { level } = await buildLevel();
  level.root.updateMatrixWorld(true);

  const block = level.surfaces.find(
    (s) => s.isFloor && Math.abs(s.mesh.position.y - 3.0) < 1e-6,
  );
  const bx = block.mesh.position.x;
  const bz = block.mesh.position.z;
  const hw = block.width / 2;
  const hd = block.height / 2;

  const v = new THREE.Vector3();
  let offenders = 0;
  level.root.traverse((o) => {
    if (!o.isMesh || o.userData?.paintSurface) return;
    const g = o.geometry?.type ?? '';
    if (!['CylinderGeometry', 'ConeGeometry', 'IcosahedronGeometry', 'BufferGeometry'].includes(g)) return;
    o.getWorldPosition(v);
    if (Math.abs(v.x - bx) <= hw + 1 && Math.abs(v.z - bz) <= hd + 1) offenders++;
  });

  assert.equal(offenders, 0, 'props are standing inside the block’s keep-out rect');
});

/**
 * Red knockback must not push an enemy THROUGH a wall. It still ignores the
 * ground probe on purpose (that is the environmental kill); walls are different.
 */
test('red knockback stops at a wall instead of pushing through it (#014)', async () => {
  const { level } = await buildLevel();
  const charger = level.gateC.watch.find((e) => e.type === 'charger');
  charger.wake();

  const block = level.surfaces.find(
    (s) => s.isFloor && Math.abs(s.mesh.position.y - 3.0) < 1e-6,
  );
  const bx = block.mesh.position.x;
  const bz = block.mesh.position.z;

  // Stand it on the floor beside C's block and hit it so the knockback drives it
  // straight at the block face.
  charger.position.set(bx, 0, bz + 3);
  charger.takeColourHit(2, 1, new THREE.Vector3(bx, 0, bz + 6));
  for (let i = 0; i < 60; i++) charger.update(1 / 60, new THREE.Vector3(bx, 0, bz + 6));

  const p = charger.position;
  const inside = Math.abs(p.x - bx) <= block.width / 2
    && Math.abs(p.z - bz) <= block.height / 2;
  assert.equal(inside, false,
    `the charger was pushed into the block at (${p.x.toFixed(2)}, ${p.z.toFixed(2)})`);
});

/**
 * An enemy carried off a ledge (knockback, blue slip) must FALL to the floor, not
 * hover at deck height. On screen the hover read as "drops through the deck".
 */
test('an enemy pushed off the deck falls to the floor instead of hovering (#012)', async () => {
  const { level } = await buildLevel();
  const sprayer = level.gateB.watch.find((e) => e.type === 'sprayer');
  sprayer.wake();

  const deck = level.surfaces.find(
    (s) => s.isFloor && Math.abs(s.mesh.position.y - 4.6) < 1e-6,
  );
  // A full metre past the deck's front edge — clearly off the body's footprint.
  sprayer.position.set(deck.mesh.position.x, 4.6, deck.mesh.position.z + deck.height / 2 + 1.0);

  for (let i = 0; i < 60; i++) sprayer.update(1 / 60, new THREE.Vector3(0, 0, 3));

  assert.ok(sprayer.position.y < 0.5,
    `the sprayer should be on the floor, y=${sprayer.position.y.toFixed(2)}`);
});

test('a dormant enemy is inert until woken, and any hit wakes it', () => {
  const enemy = new Enemy({
    position: new THREE.Vector3(0, 0, 0),
    config: ENEMY.charger,
    parent: new THREE.Group(),
    floors: [],
    sleeping: true,
  });

  assert.equal(enemy.sleeping, true);
  enemy.update(1 / 60, new THREE.Vector3(0, 0, 2));
  assert.equal(enemy.telegraphing, false, 'a dormant enemy must not wind up an attack');

  enemy.wake();
  assert.equal(enemy.sleeping, false);

  // A paint hit on a dormant enemy also wakes it — no free kills.
  const other = new Enemy({
    position: new THREE.Vector3(0, 0, 0),
    config: ENEMY.charger,
    parent: new THREE.Group(),
    floors: [],
    sleeping: true,
  });
  other.takeColourHit(1, 1);
  assert.equal(other.sleeping, false);
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

  // islands A/B/C + the ascent's ground floor, lower deck, side platform and
  // extraction ledge + the two forest shelves + B's deck top + C's block top
  // (#39 #6, #10, #012, #014)
  assert.equal(floors.length, 11);
  // 2 gates + 6 pillar sides + the rock band + the rock base + the rock wall base
  // + B's deck (3 + 1 closed) + C's block (3 + 1)
  assert.equal(walls.length, 19);
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

  const top = level.surfaces.find((s) => s.isFloor && s.tower && s.mesh.position.y > 9);
  assert.ok(top, 'expected the tower to have a top deck');

  // a player standing on the top deck, inside the win zone
  assert.equal(level.extraction.containsPoint(new THREE.Vector3(6, top.mesh.position.y, -43.5)), true);
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
test('every green climb has a floor overhanging it by enough to land on (#39 #4, #6)', async () => {
  const { level } = await buildLevel();
  level.root.updateMatrixWorld(true);

  const apex = (PLAYER.jumpSpeed * PLAYER.jumpSpeed) / (2 * -PLAYER.gravity);

  // HOW MUCH CORNICE A CLIMB NEEDS: 0.3 m, MEASURED.
  //
  // The obvious derivation — `PLAYER.radius + wallJumpPush * time-to-apex` = 1.54 m
  // — is wrong by a factor of five, and wrong in a way that would have kept a fat
  // floor slab on top of every pillar. Two things it misses:
  //
  //   - the ground probe reaches 0.5 m BELOW the player's feet, so it finds the
  //     deck and snaps them up on the way PAST it, not at the apex;
  //   - holding forward pins them against the face (the push-off and the wish
  //     cancel), so they barely leave the wall at all.
  //
  // So the number is measured instead: a sweep of a bare pillar face lands the
  // climb at 0.3 m and fails at 0. This asserts the level gives it twice that.
  const MEASURED_MIN_CORNICE = 0.3;
  const needed = MEASURED_MIN_CORNICE * 2;
  const axis = new THREE.Vector3();

  // Every climbable face: paintable, vertical. The gates and the rock are
  // unpaintable, which is the whole of `unpaintable`. There are four: three on
  // the LEFT pillar and the band at the top of the back wall. B's deck, C's block
  // and the RIGHT pillar are unpaintable: cover that can be climbed is a route.
  const climbs = level.surfaces.filter((s) => !s.isFloor && !s.unpaintable);
  assert.equal(climbs.length, 4,
    `expected four green climbs — three on the LEFT pillar and the band at the top of
    the back wall — got ${climbs.length}`);

  for (const face of climbs) {
    assert.ok(face.height > apex,
      `the ${face.height} m face at z=${face.mesh.position.z} is shorter than a `
      + `${apex.toFixed(2)} m jump, so the paint is optional and it teaches nothing`);

    // WHICH WAY the face points, read off the mesh rather than assumed. Side faces
    // are the same primitive rotated a quarter turn, so the overhang is in x for
    // those and in z for the ones facing down the corridor — a z-only test would
    // silently pass every pillar side, which is exactly the thing being checked.
    const faceBox = new THREE.Box3().setFromObject(face.mesh);
    const centre = faceBox.getCenter(new THREE.Vector3());
    axis.set(0, 0, 1).applyQuaternion(face.mesh.quaternion).normalize();

    const top = face.mesh.position.y + face.height / 2;
    const deck = level.surfaces.find((s) => s.isFloor && Math.abs(s.mesh.position.y - top) < 1e-6);
    assert.ok(deck, `nothing walkable at the top of the climb at (${centre.x}, ${centre.z})`);

    const deckBox = new THREE.Box3().setFromObject(deck.mesh);
    // how far the deck reaches past the face, in the direction the face points
    const overhang = axis.z > 0.5 ? deckBox.max.z - centre.z
      : axis.z < -0.5 ? centre.z - deckBox.min.z
        : axis.x > 0.5 ? deckBox.max.x - centre.x
          : centre.x - deckBox.min.x;

    assert.ok(overhang >= needed - 1e-6,
      `the climb at (${centre.x.toFixed(1)}, ${centre.z.toFixed(1)}) overhangs only `
      + `${overhang.toFixed(2)} m along its own normal, and a climb needs at least `
      + `${MEASURED_MIN_CORNICE} m (measured) or it cannot land`);
  }
});

/**
 * #39 #6, Renda's pillars — THE TEST THAT MATTERS FOR ISLAND C.
 *
 * The route is a chain where each step is the only way past the last:
 *
 *   green up the LEFT pillar -> paint its ROOF red yourself -> BOUNCE across the
 *   gap -> land on the RIGHT pillar (two shooters) -> green up the back wall -> win
 *
 * Every link is load-bearing and none of it is covered by anything else. A gap a
 * hand's width too wide, a capital a hand's width too thin, or a rock band in the
 * wrong place all produce a level that is simply impossible, silently. So this
 * plays it — and it also asserts the things that make the route FORCED, because a
 * route that merely works is a route the player can skip.
 *
 * Each stage re-seats the player before retrying, so what this pins is that each
 * TRANSITION is possible from a legal standing position rather than that one exact
 * script of keypresses works.
 */
test('island C is completable: green, bounce, green, extract — and no shortcuts (#39 #6)', async () => {
  const { level, game } = await buildLevel();
  let wins = 0;
  game.onWin = () => { wins += 1; };

  // Clear the arena so the door opens (that is the gate's job, tested separately).
  for (const gate of level.gates) {
    for (const enemy of gate.watch) enemy.takeColourHit(1, 999);
  }
  level.update(1 / 60, { position: new THREE.Vector3(0, 0, 20) });
  assert.equal(level.gateC.open, true, 'the door must open before the pillars can be reached');

  const topAt = (y) => level.surfaces.find((s) => s.isFloor && s.tower && Math.abs(s.mesh.position.y - y) < 1e-6);
  const wallAt = (z, y) => level.surfaces.find((s) => !s.isFloor
    && Math.abs(s.mesh.position.z - z) < 1e-6
    && Math.abs(s.mesh.position.y - y) < 1e-6);

  const left = topAt(5);
  const right = topAt(7);
  const ledge = topAt(12);
  for (const [name, s] of [['left pillar top', left], ['right pillar top', right], ['ledge', ledge]]) {
    assert.ok(s, `island C is missing its ${name}`);
  }

  // --- the pillars are PILLARS: three independent climbable sides -----------
  // The point of the shape (Renda: "so that you can shoot the paint on their sides
  // from multiple angles") is that each side is its own surface. If they shared a
  // paint grid, painting one would light up all three and there would be one angle,
  // not three.
  {
    // The three sides of the LEFT pillar: paintable, and starting at the ground.
    // `mesh.position.y - height / 2 === 0` is what separates them from the band on the
    // back wall, which also happens to be 5 m tall.
    const sides = level.surfaces.filter((s) => !s.isFloor && !s.unpaintable
      && Math.abs(s.mesh.position.y - s.height / 2) < 1e-6 && Math.abs(s.height - 5) < 1e-6);
    assert.equal(sides.length, 3, `the left pillar should have three climbable sides, found ${sides.length}`);

    const front = sides.find((s) => Math.abs(s.mesh.position.z + 34) < 1e-6);
    const inner = sides.find((s) => Math.abs(s.mesh.position.x + 2.5) < 1e-6);
    assert.ok(front && inner, 'expected a front face and an inner side face');

    front.splat(new THREE.Vector3(-7, 2.5, -34), 'green', 30);
    assert.equal(front.surfaceAtWorld(new THREE.Vector3(-7, 2.5, -34)).climbable, true);
    assert.equal(inner.surfaceAtWorld(new THREE.Vector3(-2.5, 2.5, -37)).climbable, false,
      'painting one side must not make another side climbable — they are separate surfaces');
  }

  const input = { isDown: (k) => k === 'KeyW' };   // forward is -z
  const player = new Player(level.surfaces, new THREE.Vector3(-7, 0, -32));
  player.onGround = true;
  const on = (deck) => player.onGround && Math.abs(player.position.y - deck.mesh.position.y) < 0.05;

  /** Paint a face green and climb it, jumping at the top where a climb always ends. */
  const climb = (face, deck, standY, standZ, label) => {
    const top = deck.mesh.position.y;
    let climbed = false;
    for (let i = 0; i < 1200 && !climbed; i++) {
      if (player.position.y < standY - 1 || player.position.z > face.mesh.position.z + 2.5) {
        player.position.set(face.mesh.position.x, standY, standZ);
        player.velocity.set(0, 0, -1);
      }
      face.splat(new THREE.Vector3(face.mesh.position.x, face.mesh.position.y, face.mesh.position.z), 'green', 30);
      const jump = player.climbing && player.position.y > top - 1.2;
      player.update(1 / 60, input, { jump });
      climbed = on(deck);
    }
    assert.ok(climbed,
      `never reached the ${label} at y=${top} — the climb at z=${face.mesh.position.z} is not landable `
      + `(ended at y=${player.position.y.toFixed(2)}, z=${player.position.z.toFixed(2)})`);
  };

  // --- 1: GREEN up the LEFT pillar's front ---------------------------------
  climb(wallAt(-34, 2.5), left, 0, -33.4, 'left pillar top');
  assert.ok(left.mesh.position.x < 0, 'the first pillar is the LEFT one');

  // --- 2: the player paints the ROOF red, then bounces across --------------
  // Renda: "don't add the red pad yourself, the player is meant to shoot red".
  // So the test shoots red, the way a player would: near the inner edge, because
  // the bounce starts at the near edge of the splat, not its middle.
  const gapFrom = left.mesh.position.x + left.width / 2;   // the left roof's inner edge
  const gapTo = right.mesh.position.x - right.width / 2;   // the right roof's inner edge
  assert.ok(gapFrom < gapTo, 'the two pillars must not overlap');
  const gap = gapTo - gapFrom;
  assert.ok(gap > 0 && gap < 5, `a ${gap.toFixed(1)} m gap is outside what a bounce can carry`);

  const runRight = { isDown: (k) => k === 'KeyD' };   // +x, towards the right pillar
  let bounced = false;
  for (let attempt = 0; attempt < 6 && !bounced; attempt++) {
    // shoot red onto the roof, 1.5 m in from the inner edge
    left.splat(new THREE.Vector3(gapFrom - 1.5, left.mesh.position.y, -36), 'red', 1.4);
    assert.ok(left.surfaceAtWorld(new THREE.Vector3(gapFrom - 1.5, left.mesh.position.y, -36)).restitution > 0,
      'the roof must accept red paint, or there is no bounce at all');

    player.position.set(left.mesh.position.x - left.width / 2 + 1, left.mesh.position.y, -36);
    player.velocity.set(0, 0, 0);
    player.onGround = true;

    // a bounce leaves the ground for a second: retried whole, never re-seated mid-flight
    for (let i = 0; i < 200 && !bounced; i++) {
      player.update(1 / 60, runRight, { jump: false });
      bounced = on(right);
      if (player.position.y < left.mesh.position.y - 1) break;
    }
  }
  assert.ok(bounced,
    `the red roof did not deliver the player across the ${gap.toFixed(1)} m gap `
    + `(ended at y=${player.position.y.toFixed(2)}, x=${player.position.x.toFixed(2)})`);

  // --- 3: it is bounce-only, and it is bounce-only because of HEIGHT --------
  // A jump reaches 1.39 m and the right pillar's roof is 2 m up, so no width of
  // gap would make a jump work. That is what stops the bounce being optional.
  const rise = right.mesh.position.y - left.mesh.position.y;
  const apex = (PLAYER.jumpSpeed * PLAYER.jumpSpeed) / (2 * -PLAYER.gravity);
  assert.ok(rise > apex,
    `the right pillar is only ${rise.toFixed(2)} m up and a jump reaches ${apex.toFixed(2)} m, `
    + 'so the bounce can be skipped');

  // --- 4: the back wall is closed except one way up ------------------------
  {
    const base = wallAt(-40, 3.5);
    const rock = wallAt(-40, 9.5);
    assert.ok(base && rock, 'the back wall should be a rock base with a band above it');
    assert.equal(base.unpaintable, true, 'the wall bases must not be climbable');
    assert.equal(rock.unpaintable, true, 'the rock band must be the unpaintable one');

    // the ground floor cannot be climbed at all — no pillar can be skipped
    for (const face of level.surfaces.filter((s) => !s.isFloor && !s.unpaintable
      && s.mesh.position.y - s.height / 2 === 0 && s.height > apex)) {
      assert.ok(face.splat(new THREE.Vector3(face.mesh.position.x, face.mesh.position.y, face.mesh.position.z), 'green', 30),
        'a pillar side must accept paint');
    }

    // ...and the rock refuses it
    for (const colour of ['green', 'blue', 'red']) {
      assert.equal(rock.splat(new THREE.Vector3(-4, 8.5, -40), colour, 30), false,
        `a ${colour} splat was accepted by the rock — the way past it is no longer forced`);
    }

    // walking the left of the wall runs into it rather than through it
    const blocked = new Player(level.surfaces, new THREE.Vector3(3, 7, -37));
    blocked.onGround = true;
    let furthest = blocked.position.z;
    for (let i = 0; i < 240; i++) {
      blocked.update(1 / 60, input, { jump: false });
      furthest = Math.min(furthest, blocked.position.z);
    }
    assert.ok(furthest > rock.mesh.position.z,
      `the player walked through the rock: reached z=${furthest}, it faces z=${rock.mesh.position.z}`);
    // compare by IDENTITY, not with assert.equal: on failure, node inspects both
    // values, and a PaintSurface reaches the whole level through its mesh's parent —
    // which is hundreds of megabytes of diff and half a minute of formatting.
    assert.ok(blocked.touchingWall?.surface === rock,
      `the left of the wall must run into the rock; hit `
      + `${blocked.touchingWall ? 'z=' + blocked.touchingWall.surface.mesh.position.z : 'nothing'}`);
  }

  // --- 5: GREEN up the last stretch, then win ------------------------------
  // The green band is the right-hand end of the wall — which is the end standing
  // in front of the pillar you land on.
  const greenBand = level.surfaces.find((s) => !s.isFloor && !s.unpaintable
    && Math.abs(s.mesh.position.z + 40) < 1e-6 && s.mesh.position.y > 7);
  assert.ok(greenBand, 'expected a paintable band at the top of the back wall');
  climb(greenBand, ledge, right.mesh.position.y, -39.6, 'extraction ledge');

  for (let i = 0; i < 400 && wins === 0; i++) {
    player.update(1 / 60, input, { jump: false });
    level.update(1 / 60, player);
  }
  assert.equal(wins, 1,
    `walking the ledge did not reach the extraction `
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
  // An AWAKE Charger — island B's. Island A's is dormant by design (#011).
  const enemy = level.gateB.watch.find((e) => e.type === 'charger');
  enemy.wake();     // dormant until the player enters island B
  const before = enemy.position.clone();

  // In front of B's back wall (z = -7): behind it the Charger cannot see you (#109).
  enemy.update(1 / 60, new THREE.Vector3(-3, 0, -6));

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
  const charger = level.gateB.watch.find((e) => e.type === 'charger');
  charger.wake();   // B's enemies are dormant until the player enters the arena
  const islandB = level.surfaces.find((s) => s.isFloor
    && s.mesh.position.z < 0 && s.mesh.position.z > -5);

  // These two tests are about steering on paint, not the attack, so the attack is
  // held off. The Charger has no `attackRange` today and so never winds up at all
  // (see the note in config.js — a range made it plant at 8 m and stop charging),
  // which makes this a no-op guard. Kept deliberately: it costs nothing, and if a
  // windup is ever given back to the Charger it plants the enemy and these fail in a
  // misleading way — they read as "paint stopped working" rather than "it stopped".
  charger._attackCooldown = Infinity;

  // Get it moving and committed on grey, then sidestep to +x.
  //
  // Started 6 m out, not 3 m (#76): a Charger that ARRIVES now spends 1.2 s
  // winded, and this test is about steering, not about the opening. At 6 m the
  // first second of travel still leaves it short of `stopDistance`.
  charger.position.set(0, islandB.mesh.position.y, islandB.mesh.position.z + 4);
  for (let i = 0; i < 30; i++) charger.update(1 / 60, new THREE.Vector3(0, islandB.mesh.position.y, islandB.mesh.position.z - 2));

  const before = charger._vel.clone().setY(0).normalize();
  for (let i = 0; i < 30; i++) charger.update(1 / 60, new THREE.Vector3(4, islandB.mesh.position.y, islandB.mesh.position.z - 2));
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
  // Island B's Charger, not island A's: A's is dormant by design (#011).
  const charger = level.gateB.watch.find((e) => e.type === 'charger');
  charger.wake();   // B's enemies are dormant until the player enters the arena

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
  const charger = level.gateB.watch.find((e) => e.type === 'charger');
  charger.wake();   // B's enemies are dormant until the player enters the arena
  const islandB = level.surfaces.find((s) => s.isFloor
    && s.mesh.position.z < 0 && s.mesh.position.z > -5);
  const midZ = islandB.mesh.position.z;
  const midY = islandB.mesh.position.y;

  // Same setup as above — aimed down -z at the player, committed and moving —
  // but with MORE RUNWAY, and that is a consequence of the stop below: a melee
  // enemy now brakes as it arrives (see `stopDistance`), so charging from 3 m away
  // never reaches full speed. 5 m of island B, and the charge is up to its
  // terminal ~4.17 m/s (accel against grey's 10/s friction) before the paint lands.
  //
  // `_attackCooldown` is held off as well, carried over from the fix that added it.
  // It is a NO-OP today — the Charger has no `attackRange` (see the long note in
  // config.js: a range made it plant at 8 m and never charge at all), so it never
  // winds up. Kept because the guard costs nothing and the day someone gives the
  // Charger a windup again, a planted Charger fails this test in a confusing way:
  // it looks like "ice stopped working" rather than "the enemy stopped moving".
  charger._attackCooldown = Infinity;
  charger.position.set(0, midY, midZ + 5);
  for (let i = 0; i < 50; i++) charger.update(1 / 60, new THREE.Vector3(0, midY, midZ));

  const speedBefore = charger._vel.length();

  // The player paints the floor under it, then sidesteps to +x.
  islandB.splat(new THREE.Vector3(0, midY, midZ + 5), 'blue', 80);
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
  // Island B's Charger specifically: `level.enemies[0]` is island A's now (#011).
  const charger = level.gateB.watch.find((e) => e.type === 'charger');
  charger.wake();   // B's enemies are dormant until the player enters the arena
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
  const player = { position: new THREE.Vector3(6, 12, -43.5) };
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
