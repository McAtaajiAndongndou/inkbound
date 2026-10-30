// Polish audit (30 Oct), the shaders + enemies lane: attack tokens (Enemies 2),
// the telegraph by distance (Enemies 3), the death burst (P1-4), the combo's
// sounds (P1-5), Big Arm's hooks, and the submerged avatar (Q1).
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';

import { audio } from '../src/audio/audio-manager.js';
import { Enemy } from '../src/enemies/enemy.js';
import { BigArm } from '../src/enemies/boss.js';
import { Avatar } from '../src/shaders/avatar.js';
import { PaintSurface } from '../src/paint/paint-surface.js';
import { ENEMY, ENEMY_ATTACK, BLUE_FREEZE, PAINT, PAINT_IDS, SWIM, PLAYER } from '../src/config.js';

const DT = 1 / 60;

async function listen(fn) {
  const heard = [];
  const real = audio.play;
  audio.play = (name, opts) => heard.push({ name, gain: opts?.gain ?? 1 });
  try { await fn(); } finally { audio.play = real; }
  return heard;
}

function floor(size = 60) {
  const s = new PaintSurface({ width: size, height: size, cells: 4 });
  s.mesh.rotation.x = -Math.PI / 2;
  s.mesh.updateMatrixWorld(true);
  s.isFloor = true;
  return s;
}
/** `n` awake enemies of `type` round the origin, all under one level root. */
function squad(type, n, { radius = 6 } = {}) {
  const parent = new THREE.Group();
  const ground = floor();
  parent.add(ground.mesh);
  const enemies = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const e = new Enemy({
      position: new THREE.Vector3(Math.cos(a) * radius, 0, Math.sin(a) * radius),
      config: ENEMY[type], parent, floors: [ground], surfaces: [ground], blockers: [],
    });
    e.type = type;
    e.wake();
    e._awareness = 'alert';
    enemies.push(e);
  }
  return { parent, ground, enemies };
}

// --- Enemies 2: attack tokens -------------------------------------------------

test('no more than two ranged enemies wind up or fire at once, and the tokens go round', () => {
  const { enemies } = squad('sprayer', 6);
  const player = new THREE.Vector3(0, 0, 0);
  let most = 0;
  const everAttacked = new Set();
  for (let t = 0; t < 12; t += DT) {
    for (const e of enemies) {
      e._awareness = 'alert';
      e.update(DT, player);
    }
    const busy = enemies.filter((e) => e.telegraphing || e._burstLeft > 0);
    most = Math.max(most, busy.length);
    for (const e of busy) everAttacked.add(e);
    assert.ok(enemies.filter((e) => e.holdsToken).length <= ENEMY_ATTACK.tokens);
  }
  assert.equal(most, ENEMY_ATTACK.tokens, 'two at a time, and two do attack together');
  assert.ok(everAttacked.size >= 4, `the tokens are handed round: ${everAttacked.size} of 6 attacked`);
});

test('a frozen, stunned or dead holder gives its token back', () => {
  const { enemies } = squad('sprayer', 3);
  const [a, b, c] = enemies;
  assert.ok(a.startTelegraph() && b.startTelegraph());
  assert.equal(c.startTelegraph(), false, 'the third waits');
  a.stun(1);
  a.update(DT, new THREE.Vector3());
  assert.equal(a.holdsToken, false, 'stunned: token back');
  assert.ok(c.startTelegraph(), 'and the waiting one takes it');
  b.takeColourHit(PAINT_IDS.red, 999);
  assert.equal(b.holdsToken, false, 'dead: token back');
});

test('melee enemies never queue for a token', () => {
  const { enemies } = squad('drainer', 4, { radius: 1 });
  const started = enemies.filter((e) => e.startTelegraph()).length;
  assert.equal(started, 4);
  assert.ok(enemies.every((e) => !e.holdsToken));
});

test('tokens are per level: two levels never share a pool', () => {
  const one = squad('sprayer', 2);
  const two = squad('sprayer', 2);
  assert.ok(one.enemies.every((e) => e.startTelegraph()));
  assert.ok(two.enemies.every((e) => e.startTelegraph()), 'another root has its own two');
});

// --- Enemies 3: the telegraph by distance -------------------------------------

test('the telegraph whine fades with distance and is silent far away', async () => {
  const { near, far } = ENEMY_ATTACK.telegraphHearing;
  const { enemies: [close] } = squad('sprayer', 1);
  close._lastPlayer = close.position.clone().add(new THREE.Vector3(near - 1, 0, 0));
  const { enemies: [mid] } = squad('sprayer', 1);
  mid._lastPlayer = mid.position.clone().add(new THREE.Vector3((near + far) / 2, 0, 0));
  const { enemies: [distant] } = squad('sprayer', 1);
  distant._lastPlayer = distant.position.clone().add(new THREE.Vector3(far + 5, 0, 0));
  const heard = await listen(() => { close.startTelegraph(); mid.startTelegraph(); distant.startTelegraph(); });
  const whines = heard.filter((h) => h.name === 'telegraph');
  assert.equal(whines.length, 2, 'the far one winds up in silence');
  assert.equal(whines[0].gain, 1);
  assert.ok(whines[1].gain > 0.3 && whines[1].gain < 0.7);
  assert.ok(distant.telegraphing, 'silent, but the visual tell still plays');
});

// --- P1-5: the combo is heard -------------------------------------------------

test('freeze, shatter and pin each have their sound', async () => {
  const { enemies: [e] } = squad('sprayer', 1);
  const heard = await listen(() => {
    for (let i = 0; i < BLUE_FREEZE.hitsToFreeze; i++) e.takeColourHit(PAINT_IDS.blue, 1);
    e._frozenTimer = BLUE_FREEZE.critWindow;
    for (let i = 0; i < 30; i++) e.update(DT, new THREE.Vector3(20, 0, 0));   // past armDelay
    e.takeColourHit(PAINT_IDS.red, 1);
  });
  const names = heard.map((h) => h.name);
  assert.ok(names.includes('freeze'), names.join());
  assert.ok(names.includes('shatter'), names.join());
  const { enemies: [g] } = squad('sprayer', 1);
  const pin = await listen(() => { g.takeColourHit(PAINT_IDS.green, 1); g.takeColourHit(PAINT_IDS.green, 1); });
  assert.equal(pin.filter((h) => h.name === 'pin').length, 1, 'one clamp per pin, not per hit');
});

// --- P1-4: death returns colour ------------------------------------------------

test('a paint kill bursts into drops of the killing colour, cleaned up with the corpse', () => {
  const { parent, enemies: [e] } = squad('sprayer', 1);
  e.takeColourHit(PAINT_IDS.green, 999);
  const burst = parent.getObjectByName('death-burst');
  assert.ok(burst, 'the burst is in the level');
  assert.equal(burst.material.color.getHex(), PAINT.green.hex);
  for (let t = 0; t < 1; t += DT) e.update(DT, new THREE.Vector3());
  assert.equal(parent.getObjectByName('death-burst'), undefined, 'gone with the corpse');
});

test('a trap kill is colourless: no burst', () => {
  const { parent, enemies: [e] } = squad('sprayer', 1);
  e.takeDamage(999);
  assert.equal(parent.getObjectByName('death-burst'), undefined);
});

// --- Big Arm ---------------------------------------------------------------------

test("Big Arm reports each combo step and its slam, and the slam booms", async () => {
  const parent = new THREE.Group();
  const ground = floor();
  parent.add(ground.mesh);
  const b = new BigArm({ position: new THREE.Vector3(), parent, floors: [ground], surfaces: [ground], blockers: [] });
  const steps = [];
  b.onComboStep = (_, n) => steps.push(n);
  for (let i = 0; i < BLUE_FREEZE.hitsToFreeze; i++) b.takeColourHit(PAINT_IDS.blue);
  b.takeColourHit(PAINT_IDS.green);
  b.takeColourHit(PAINT_IDS.red);
  assert.deepEqual(steps, [1, 2, 3]);

  const b2 = new BigArm({ position: new THREE.Vector3(), parent, floors: [ground], surfaces: [ground], blockers: [] });
  b2.wake();
  const slams = [];
  b2.onSlam = (_, at) => slams.push(at.clone());
  const heard = await listen(() => {
    for (let t = 0; t < ENEMY.bigArm.windup + 1 && !slams.length; t += DT) b2.update(DT, new THREE.Vector3(0, 0, 3));
  });
  assert.equal(slams.length, 1);
  assert.ok(heard.some((h) => h.name === 'slam'));
});

// --- Q1: the submerged avatar ----------------------------------------------------

test('submerged, the avatar squashes into a blob of the paint, rippling in and out, feet on the floor', () => {
  // The loader skipped, as the other avatar tests do: no GLB in Node.
  const parent = new THREE.Group();
  const avatar = Object.create(Avatar.prototype);
  avatar.parent = parent;
  avatar.root = new THREE.Group();
  avatar.moving = false;
  avatar._pendingHand = [];
  parent.add(avatar.root);
  avatar._buildSwim(parent);
  avatar.setSubmerged(true, PAINT.blue.hex);
  for (let i = 0; i < 60; i++) avatar.update(DT);
  assert.ok(Math.abs(avatar.root.scale.y - SWIM.squash) < 1e-6, 'squashed flat');
  const feet = avatar.root.position.y - PLAYER.height * 0.5 * avatar.root.scale.y;
  assert.ok(Math.abs(feet + PLAYER.height * 0.5) < 1e-6, 'the feet stay where they were');
  assert.ok(avatar._blob.visible && avatar._blob.material.color.getHex() === PAINT.blue.hex);
  const rings = () => avatar._ripples.filter((r) => r.visible).length;
  avatar.moving = true;
  for (let i = 0; i < 20; i++) avatar.update(DT);
  assert.ok(rings() >= 1, 'a wake trails it while it moves');
  avatar.moving = false;
  for (let i = 0; i < 60; i++) avatar.update(DT);
  assert.equal(rings(), 0);
  avatar.setSubmerged(false);
  assert.equal(rings(), 1, 'up out of the paint: a ripple');
  for (let i = 0; i < 60; i++) avatar.update(DT);
  assert.ok(Math.abs(avatar.root.scale.y - 1) < 1e-6);
  assert.equal(avatar._blob.visible, false);
  avatar.dispose();
  assert.equal(parent.children.length, 0, 'disposed: nothing left on the player');
});
