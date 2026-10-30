import { beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';

import { Enemy } from '../src/enemies/enemy.js';
// Namespace import for the signal, not a named one: on the commit before #109
// those exports do not exist, and a named import of a missing binding is a
// module-level crash — every test would die with the same error, which says
// nothing about behaviour. Reading them off the namespace lets each test fail on
// its own merits on the code this was written against.
import * as enemyModule from '../src/enemies/enemy.js';
import { PaintSurface } from '../src/paint/paint-surface.js';
import { ENEMY } from '../src/config.js';
import { Level01 } from '../src/levels/level-01-mission.js';

const PLAYER_SIGNAL = enemyModule.PLAYER_SIGNAL ?? { submerged: false, shots: 0 };
const resetPlayerSignal = enemyModule.resetPlayerSignal ?? (() => {});

/**
 * #109 — partial stealth.
 *
 * The three states from `docs/enemies/algorithms.md` § Awareness: Dormant, Alert,
 * Search. What these tests fix in place, in the issue's own words:
 *
 *   - detection is ~16 m standing, ~7 m submerged
 *   - firing reveals you for ~3 s regardless of submerge
 *   - breaking line of sight drops you into a search that walks to the last
 *     known position
 *   - the search gives up after ~6 s
 *   - a searching enemy does NOT home in on where you actually are
 *   - the turret ignores stealth entirely
 *
 * Everything here drives `Enemy.update()` directly. No browsers, no models: the
 * state machine's job is deciding what the enemy KNOWS, which is decidable from
 * positions and a wall.
 */

beforeEach(() => resetPlayerSignal());

/** A flat walkable surface on the XZ plane, big enough to not be the point. */
function makeFloor({ size = 120 } = {}) {
  const s = new PaintSurface({ width: size, height: size, cells: 4 });
  s.mesh.rotation.x = -Math.PI / 2;
  s.mesh.position.set(0, 0, 0);
  s.mesh.updateMatrixWorld(true);
  s.isFloor = true;
  return s;
}

/**
 * An upright wall.
 *
 *  `axis: 'z'` stands it across the world X axis at `at` (a wall in front of a
 *  shooter who is at larger z). `axis: 'x'` stands it across the world Z axis at
 *  `at`, which is the one that keeps working as an enemy walks PAST it — a wall
 *  a searcher can walk through is not cover, it is scenery.
 *
 *  One-sided on purpose: every surface in this game is a `FrontSide` plane, and
 *  the raycast honours that. The default normal is +Z, which is the side a
 *  shooter standing at positive z is on.
 */
function makeWall({ at = 0, axis = 'z', width = 40, height = 6 } = {}) {
  const s = new PaintSurface({ width, height, cells: 2 });
  if (axis === 'x') {
    // MINUS a quarter turn. The plane's front is local +Z, and a +90 degree turn
    // maps that to world +X — which is the side AWAY from an enemy standing at
    // negative x, so the ray would hit the back face and pass straight through.
    // The sign of this rotation is the whole difference between a wall and a
    // window, and it was wrong here first.
    s.mesh.rotation.y = -Math.PI / 2;
    s.mesh.position.set(at, height / 2, 0);
  } else {
    s.mesh.position.set(0, height / 2, at);
  }
  s.mesh.updateMatrixWorld(true);
  return s;
}

function makeEnemy({ config = ENEMY.charger, at = [0, 0, 10], floors = [], blockers, sleeping } = {}) {
  const opts = {
    position: new THREE.Vector3(...at),
    config,
    parent: new THREE.Group(),
    floors,
  };
  if (blockers !== undefined) opts.blockers = blockers;
  if (sleeping !== undefined) opts.sleeping = sleeping;
  return new Enemy(opts);
}

/** Tick `frames` times at 60 Hz with the player standing still at `at`. */
function tick(enemy, at, frames = 1) {
  const p = new THREE.Vector3(...at);
  for (let i = 0; i < frames; i++) enemy.update(1 / 60, p);
  return enemy;
}

// --- detection radius --------------------------------------------------------

test('a standing player is seen at 15 m and not at 17 m', () => {
  const near = makeEnemy({ at: [0, 0, 15] });
  tick(near, [0, 0, 0]);
  assert.equal(near.awareness, 'alert', '15 m is inside the 16 m detection radius');

  const far = makeEnemy({ at: [0, 0, 17] });
  tick(far, [0, 0, 0]);
  assert.equal(far.awareness, 'dormant', '17 m is outside it');
});

test('a submerged player is seen at 6 m and not at 9 m', () => {
  PLAYER_SIGNAL.submerged = true;

  const near = makeEnemy({ at: [0, 0, 6] });
  tick(near, [0, 0, 0]);
  assert.equal(near.awareness, 'alert', 'partial stealth is halved, not zero');

  const far = makeEnemy({ at: [0, 0, 9] });
  tick(far, [0, 0, 0]);
  assert.equal(far.awareness, 'dormant', '9 m is past the 7 m submerged radius');
});

test('submerging is what changes the answer, not the distance', () => {
  // Same enemy, same spot, same frame count: only the flag differs. Without
  // this pair, either result alone could be produced by the other rule.
  const dry = makeEnemy({ at: [0, 0, 10] });
  tick(dry, [0, 0, 0]);
  assert.equal(dry.awareness, 'alert');

  PLAYER_SIGNAL.submerged = true;
  const wet = makeEnemy({ at: [0, 0, 10] });
  tick(wet, [0, 0, 0]);
  assert.equal(wet.awareness, 'dormant');
});

// --- firing reveals you ------------------------------------------------------

test('firing reveals a submerged player, and the reveal outlasts the shot', () => {
  PLAYER_SIGNAL.submerged = true;
  const enemy = makeEnemy({ at: [0, 0, 12] });

  tick(enemy, [0, 0, 0]);
  assert.equal(enemy.awareness, 'dormant', '12 m is silent while submerged');

  PLAYER_SIGNAL.shots += 1;      // the gun fires
  tick(enemy, [0, 0, 0]);
  assert.equal(enemy.awareness, 'alert', 'a shot gives you away regardless of submerge');

  tick(enemy, [0, 0, 0], 150);   // 2.5 s
  assert.equal(enemy.awareness, 'alert', 'the reveal lasts ~3 s, not one frame');

  tick(enemy, [0, 0, 0], 60);    // 3.5 s total
  assert.equal(enemy.awareness, 'search',
    'once the reveal expires with nothing in sight, it looks where you were');
});

test('firing does not reveal a player outside the standing radius', () => {
  PLAYER_SIGNAL.submerged = true;
  const enemy = makeEnemy({ at: [0, 0, 18] });

  PLAYER_SIGNAL.shots += 1;
  tick(enemy, [0, 0, 0]);

  // A gunshot is loud, not a map marker: 18 m is past even the standing radius.
  assert.equal(enemy.awareness, 'dormant');
});

// --- line of sight -----------------------------------------------------------

test('a wall blocks detection that the same distance does not block in the open', () => {
  const blocked = makeEnemy({ at: [0, 0, 10], blockers: [makeWall({ at: 4 })] });
  tick(blocked, [0, 0, 0]);
  assert.equal(blocked.awareness, 'dormant', 'you are 10 m away and behind a wall');

  const open = makeEnemy({ at: [0, 0, 10] });
  tick(open, [0, 0, 0]);
  assert.equal(open.awareness, 'alert', 'the same 10 m with nothing in the way is seen');
});

test('a wall that is not between the two of you blocks nothing', () => {
  const wall = makeWall({ at: 4, width: 20 });
  wall.mesh.position.x = 40;          // well off the sight line
  wall.mesh.updateMatrixWorld(true);

  const enemy = makeEnemy({ at: [0, 0, 10], blockers: [wall] });
  tick(enemy, [0, 0, 0]);

  assert.equal(enemy.awareness, 'alert',
    'a wall beside the line is scenery, not cover — over-blocking is a bug too');
});

test('losing sight drops Alert to Search and keeps the position it saw', () => {
  const enemy = makeEnemy({ at: [0, 0, 10] });
  tick(enemy, [0, 0, 0]);
  assert.equal(enemy.awareness, 'alert');

  // Cover goes up between them.
  const wall = makeWall({ at: 4 });
  enemy._blockers.push(wall.mesh);

  tick(enemy, [0, 0, 0]);
  assert.equal(enemy.awareness, 'search', 'line of sight is required to GAIN alert, not to keep it');
  assert.deepEqual(enemy.lastKnown.toArray(), [0, 0, 0],
    'it remembers where it last saw you, not where you are');
});

// --- the search walks to a memory -------------------------------------------

test('a searching enemy walks to the last known position, not to the player', () => {
  const floor = makeFloor();
  // The wall stands ACROSS x, so it keeps blocking as the enemy walks down -z.
  const wall = makeWall({ at: 4, axis: 'x' });

  const enemy = makeEnemy({ at: [0, 0, 10], floors: [floor] });
  tick(enemy, [0, 0, 0], 10);
  assert.equal(enemy.awareness, 'alert');

  enemy._blockers.push(wall.mesh);
  const moved = [8, 0, 0];                 // you break cover and run sideways
  tick(enemy, moved, 5);
  assert.equal(enemy.awareness, 'search');
  assert.deepEqual(enemy.lastKnown.toArray(), [0, 0, 0]);

  tick(enemy, moved, 60);                  // one second of hunting

  assert.ok(enemy.position.z < 9, `it should be walking toward where you were, z=${enemy.position.z}`);
  assert.ok(Math.abs(enemy.position.x) < 1.5,
    `it must not home in on where you are now, x=${enemy.position.x}`);
});

test('the search gives up after ~6 s and the enemy stops moving', () => {
  const floor = makeFloor();
  const wall = makeWall({ at: 4, axis: 'x' });

  const enemy = makeEnemy({ at: [0, 0, 10], floors: [floor] });
  tick(enemy, [0, 0, 0], 10);
  enemy._blockers.push(wall.mesh);

  const moved = [8, 0, 0];
  tick(enemy, moved, 5);
  assert.equal(enemy.awareness, 'search');

  tick(enemy, moved, 5 * 60);              // five seconds: still looking
  assert.equal(enemy.awareness, 'search', 'six seconds is the dial; five is not enough');

  tick(enemy, moved, 70);                  // 6.2 s total
  assert.equal(enemy.awareness, 'dormant', 'it gives up rather than searching forever');

  const stopped = enemy.position.clone();
  tick(enemy, moved, 120);
  assert.deepEqual(enemy.position.toArray(), stopped.toArray(),
    'a dormant enemy stands still instead of drifting home');
});

test('a dormant enemy that never saw you does not walk at you', () => {
  const floor = makeFloor();
  const enemy = makeEnemy({ at: [0, 0, 30], floors: [floor] });
  const start = enemy.position.clone();

  tick(enemy, [0, 0, 0], 120);             // two seconds with the player 30 m away

  assert.equal(enemy.awareness, 'dormant');
  assert.deepEqual(enemy.position.toArray(), start.toArray(),
    'out of detection range it has no target, so it has nowhere to be');
});

// --- the turret is a machine -------------------------------------------------

test('the turret sees a submerged player at 8 m', () => {
  PLAYER_SIGNAL.submerged = true;
  const turret = makeEnemy({ config: ENEMY.turret, at: [0, 0, 8] });

  tick(turret, [0, 0, 0]);
  assert.equal(turret.awareness, 'alert', 'machines are not fooled by paint');
});

test('the turret never enters Search, not even with a wall in the way', () => {
  const turret = makeEnemy({ config: ENEMY.turret, at: [0, 0, 8], blockers: [makeWall({ at: 4 })] });

  tick(turret, [0, 0, 0], 1);
  tick(turret, [0, 0, 0], 60);
  tick(turret, [0, 0, 0], 120);

  assert.equal(turret.awareness, 'alert', 'it has no memory to lose and no forgetting to do');
});

test('the exemption is data on the turret, not a name check in the code', () => {
  assert.equal(ENEMY.turret.ignoresStealth, true);
  for (const type of ['sprayer', 'charger', 'wallCrawler', 'drainer']) {
    assert.ok(!ENEMY[type].ignoresStealth, `${type} must be fooled by stealth`);
  }
});

// --- dormancy, both kinds ----------------------------------------------------

test('an enemy behind cover will not fire even with you inside its attack range', () => {
  const sprayer = makeEnemy({
    config: ENEMY.sprayer,
    at: [0, 0, 8],
    blockers: [makeWall({ at: 4 })],
  });

  tick(sprayer, [0, 0, 0], 180);           // three seconds, well inside its 12 m range

  assert.equal(sprayer.awareness, 'dormant');
  assert.equal(sprayer.telegraphing, false, 'it cannot shoot at something it cannot see');
});

test('a sleeping enemy does not hear a shot fired while it was asleep', () => {
  PLAYER_SIGNAL.submerged = true;
  const enemy = makeEnemy({ at: [0, 0, 12], sleeping: true });

  PLAYER_SIGNAL.shots += 1;                // fired while it was dormant
  tick(enemy, [0, 0, 0], 10);              // it is asleep; the shots go by unheard

  // Un-slept without a level wake: since #216 a wake() deliberately alerts
  // (tests/hit-alerts.test.js). The rule here is only about the slept-through
  // shot, which must not come back as a memory.
  enemy.sleeping = false;
  tick(enemy, [0, 0, 0]);

  assert.equal(enemy.awareness, 'dormant',
    'waking up must not hand it a three-second memory of a shot it slept through');
});

// --- against the real level --------------------------------------------------

test('in Level 1 an enemy finds the level walls without being handed them', async () => {
  const level = new Level01({ scene: new THREE.Scene(), onWin: null });
  await level.load();

  assert.ok(level.enemies.length > 0, 'the level must spawn enemies for this to mean anything');

  // Island B's Charger: awake by design (#011), standing on a floor, with the
  // level's own geometry around it.
  const charger = level.gateB.watch.find((e) => e.config === ENEMY.charger);
  assert.ok(charger, 'no Charger on island B to test with');
  assert.ok(charger._blockers.length > 0,
    'the level already puts its walls under root, so the enemy should have found them');

  // Walk it into range of a player standing on the same island.
  const islandB = level.surfaces.find((s) => s.isFloor
    && s.mesh.position.z < 0 && s.mesh.position.z > -5);
  const y = islandB.mesh.position.y;
  charger.position.set(0, y, islandB.mesh.position.z + 3);
  charger.wake();   // island B's arena sleeps until the player lands in it (#012)

  tick(charger, [0, y, islandB.mesh.position.z], 5);

  assert.equal(charger.awareness, 'alert', 'three metres away on open ground must be seen');
  assert.ok(charger._vel.length() > 1, 'and it must act on it');
});
