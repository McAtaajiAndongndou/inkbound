// Polish audit (30 Oct), the levels lane: the colour language (P0-5), the trap
// sounds and their camera shake, the layout gates' sound, the Ascent's first
// frame, and the Outskirts lock bar that sank out of the Ledge's look back.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';

import { audio } from '../src/audio/audio-manager.js';
import { Level01 } from '../src/levels/level-01-mission.js';
import { Level02 } from '../src/levels/level-02-ascent.js';
import { Level03 } from '../src/levels/level-03-horde.js';
import { PaintVent } from '../src/levels/paint-vent.js';
import { hearingGain } from '../src/levels/trap-sound.js';
import { spawnAim } from '../src/levels/level-base.js';
import { PAINT, DANGER, GATE, MARKER, OUTSKIRTS, TRAP, CAMERA, LAST_COLOUR } from '../src/config.js';

/** Record every audio.play for the duration of `fn`. */
async function listen(fn) {
  const heard = [];
  const real = audio.play;
  audio.play = (name, opts) => heard.push({ name, gain: opts?.gain ?? 1 });
  try { await fn(); } finally { audio.play = real; }
  return heard;
}
const names = (heard) => heard.map((h) => h.name);

/** Euclidean distance in 0..255 RGB. */
function rgbDistance(a, b) {
  const ca = new THREE.Color(a);
  const cb = new THREE.Color(b);
  return Math.hypot(ca.r - cb.r, ca.g - cb.g, ca.b - cb.b) * 255;
}

// --- P0-5 colour language ----------------------------------------------------

test('no gate or goal furniture wears a paint colour or the danger amber (P0-5)', () => {
  const furniture = { 'GATE.field': GATE.field, 'GATE.lock': GATE.lock, 'GATE.open': GATE.open, 'goal beacon': OUTSKIRTS.beacon.colour };
  const reserved = { blue: PAINT.blue.hex, red: PAINT.red.hex, green: PAINT.green.hex, amber: DANGER.amber };
  for (const [what, hex] of Object.entries(furniture)) {
    for (const [rule, r] of Object.entries(reserved)) {
      assert.ok(rgbDistance(hex, r) > 90, `${what} is too close to ${rule}: ${rgbDistance(hex, r).toFixed(0)}`);
    }
  }
  assert.equal(GATE.open, MARKER.white, 'an opened door says "here", in the marker white');
  assert.equal(OUTSKIRTS.beacon.colour, MARKER.white);
  assert.equal(LAST_COLOUR.props.floodlight, MARKER.white, 'one white, not two');
});

test("Outskirts' built gates and beacon use the config colours", async () => {
  const level = new Level01({ scene: new THREE.Scene(), onWin: null });
  await level.load();
  for (const gate of level.gates) {
    assert.equal(gate.curtain.material.color.getHex(), GATE.field);
    assert.equal(gate.light.material.color.getHex(), GATE.lock);
  }
  assert.equal(level.root.getObjectByName('extraction-beacon').material.color.getHex(), MARKER.white);
  level.dispose();
});

test("the layout levels' beacons are marker white and their gate fields grey-violet", async () => {
  const level = new Level03({ scene: new THREE.Scene() });
  await level.load();
  assert.equal(level.root.getObjectByName('siphon-mast-beacon').material.color.getHex(), MARKER.white);
  assert.ok(level.gates.length > 0, 'Last Colour has gates');
  for (const gate of level.gates) assert.equal(gate.field.material.color.getHex(), GATE.field);
  level.dispose();
});

// --- the lock bar ------------------------------------------------------------

test("once a field has faded, its lock bar sinks into the lintel and stops (the Ledge's frame)", async () => {
  const level = new Level01({ scene: new THREE.Scene(), onWin: null });
  await level.load();
  const gate = level.gateB;
  for (const enemy of gate.watch) enemy.takeColourHit(1, 999);
  const far = { position: new THREE.Vector3(0, 0, 20) };
  for (let i = 0; i < 60 * 4; i++) level.update(1 / 60, far);
  assert.equal(gate.open, true);
  assert.equal(gate.curtain.visible, false, 'the field faded to nothing and hid');
  assert.ok(Math.abs(gate.light.position.y - (gate.barRest - GATE.barDrop)) < 1e-6, 'the bar is buried, and no lower');
  assert.equal(level.gateC.light.position.y, level.gateC.barRest, 'a shut gate keeps its bar');
  level.dispose();
});

// --- trap sounds ---------------------------------------------------------------

test('trap sound fades with distance: full near, silent far', () => {
  const at = { x: 0, y: 0, z: 0 };
  assert.equal(hearingGain(at, { x: TRAP.hearing.near - 0.1, y: 0, z: 0 }), 1);
  assert.equal(hearingGain(at, { x: TRAP.hearing.far + 0.1, y: 0, z: 0 }), 0);
  const mid = hearingGain(at, { x: (TRAP.hearing.near + TRAP.hearing.far) / 2, y: 0, z: 0 });
  assert.ok(mid > 0.4 && mid < 0.6);
});

test('the crusher ticks on the tell, clanks on the drop, hisses on the rise, and shakes nearby', async () => {
  const level = new Level03({ scene: new THREE.Scene() });
  await level.load();
  const [crusher] = level.crushers;
  const shakes = [];
  level.game.shake = (n) => shakes.push(n);
  const near = { position: crusher.group.position.clone() };
  const heard = await listen(() => {
    for (let t = 0; t < LAST_COLOUR.crusher.period * 1.5; t += 1 / 120) crusher.update(1 / 120, [near]);
  });
  const n = names(heard);
  assert.ok(n.includes('tick'), 'the lamp ticks');
  assert.ok(n.includes('crush'), 'the head clanks down');
  assert.ok(n.includes('hiss'), 'and hisses back up');
  assert.ok(n.indexOf('tick') < n.indexOf('crush'), 'the tell comes before the beat');
  assert.equal(n.filter((x) => x === 'crush').length, 1, 'one clank per beat, not one per frame');
  assert.ok(shakes.length === 1 && Math.abs(shakes[0] - TRAP.shake.crusher) < 1e-9, 'a beat beside you shakes the camera');

  const farAway = { position: crusher.group.position.clone().add(new THREE.Vector3(0, 0, TRAP.hearing.far + 5)) };
  const quiet = await listen(() => {
    for (let t = 0; t < LAST_COLOUR.crusher.period; t += 1 / 120) crusher.update(1 / 120, [farAway]);
  });
  assert.deepEqual(quiet, [], 'a crusher across the hangar is silent');
  level.dispose();
});

test('the vent hisses once per eruption, and a dead vent is silent', () => {
  const root = new THREE.Group();
  let painted = false;
  const floor = { isPlayerPaintAtWorld: () => painted };
  const vent = new PaintVent({ parent: root, floor, rect: { xMin: 0, xMax: 2, zMin: 0, zMax: 2 } });
  const player = { position: new THREE.Vector3(1, 0, 1), takeDamage() {} };
  const cycle = TRAP.vent.rest + TRAP.vent.tell + TRAP.vent.erupt;
  return listen(() => {
    for (let t = 0; t < cycle * 2; t += 1 / 60) vent.update(1 / 60, [player]);
  }).then(async (heard) => {
    assert.equal(names(heard).filter((x) => x === 'vent').length, 2, 'two cycles, two hisses');
    painted = true;
    const dead = await listen(() => { for (let t = 0; t < cycle * 2; t += 1 / 60) vent.update(1 / 60, [player]); });
    assert.deepEqual(dead, []);
  });
});

test('at rest the vent is a machine: a raised rim, slats and a grey wisp that only leaks while live', () => {
  const root = new THREE.Group();
  let painted = false;
  const vent = new PaintVent({ parent: root, floor: { isPlayerPaintAtWorld: () => painted }, rect: { xMin: 0, xMax: 2, zMin: 0, zMax: 2 } });
  const player = { position: new THREE.Vector3(9, 0, 9), takeDamage() {} };
  vent.update(0.1, [player]);
  assert.equal(vent.phase, 'rest');
  const box = new THREE.Box3().setFromObject(vent.group);
  assert.ok(box.max.y - vent.y >= TRAP.vent.rimHeight - 1e-6, 'it stands proud of the floor');
  assert.ok(vent.wisps.every((w) => w.visible), 'a live vent leaks');
  for (const w of vent.wisps) assert.equal(w.material.color.getHex(), TRAP.vent.wisp, 'grey, never amber');
  painted = true;
  vent.update(0.1, [player]);
  assert.ok(vent.wisps.every((w) => !w.visible), 'a dead vent is still');
});

test('the catwalk creaks when you step on, crumbles when it goes, and shakes a fall beside you', async () => {
  const level = new Level02({ scene: new THREE.Scene() });
  await level.load();
  const shakes = [];
  level.game.shake = (n) => shakes.push(n);
  const seg = level.catwalk.get('span-2-3');
  const on = seg.centre.clone();
  const player = { position: on };
  const heard = await listen(() => {
    for (let t = 0; t < 1.5; t += 1 / 60) level.catwalk.update(1 / 60, player);
  });
  const n = names(heard);
  assert.equal(n[0], 'creak');
  assert.ok(n.includes('collapse'), 'the defined-but-never-played collapse SFX is played');
  assert.equal(n.filter((x) => x === 'collapse').length, 1);
  assert.equal(shakes.length, 1);
  level.dispose();
});

test('a layout gate plays the gate sound when it opens', async () => {
  const level = new Level03({ scene: new THREE.Scene() });
  await level.load();
  const gate = level.gates[0];
  gate.data = { ...gate.data, opens: 'always' };
  const heard = await listen(() => level.update(1 / 60, { position: new THREE.Vector3(0, -50, 0), velocity: new THREE.Vector3() }));
  assert.ok(names(heard).includes('gate'));
  level.dispose();
});

// --- the Ascent's first frame -----------------------------------------------

test("the Ascent's first frame faces its goal, as high as the camera may look", async () => {
  const level = new Level02({ scene: new THREE.Scene() });
  await level.load();
  assert.ok(level.spawnLook, 'the Ascent names what its first frame faces');
  const { yaw, pitch } = spawnAim(level.spawn, level.spawnLook);
  assert.ok(Math.abs(yaw) < 0.05, 'straight up the mountain, toward the lift tower');
  assert.equal(pitch, CAMERA.pitchMax, 'the beacon is past the limit, so the aim sits on it');
  assert.deepEqual(level.spawnFacing, { yaw, pitch }, 'main.js reads it as spawnFacing');
  level.dispose();
});

test('spawnAim matches the player convention: forward is (-sin yaw, -cos yaw)', () => {
  const from = new THREE.Vector3(0, 0, 0);
  assert.ok(Math.abs(spawnAim(from, new THREE.Vector3(0, 0, -10)).yaw) < 1e-9);
  assert.ok(Math.abs(spawnAim(from, new THREE.Vector3(-10, 0, 0)).yaw - Math.PI / 2) < 1e-9);
  assert.ok(Math.abs(spawnAim(from, new THREE.Vector3(0, 1, -10)).pitch - Math.atan(0.1)) < 1e-9);
});

// --- the Siphon is heard -------------------------------------------------------

test('the Siphon sounds each reveal, each solved target, and its fall', async () => {
  const level = new Level03({ scene: new THREE.Scene(), onWin: () => {} });
  await level.load();
  level.root.updateMatrixWorld(true);
  for (const e of level.enemies) e.update = () => {};
  for (const r of level.roster) r.enemy.alive = false;
  const at = { position: new THREE.Vector3(0, 0, -20) };
  const heard = await listen(() => {
    const tick = (s) => { for (let t = 0; t < s - 1e-9; t += 1 / 60) level.update(1 / 60, at); };
    tick(1 / 60);
    for (const kind of ['intake', 'arm', 'core']) {
      tick(LAST_COLOUR.siphon.revealFor + 1 / 60);
      for (const t of level.siphon.byKind(kind)) {
        t.surf.splat(t.surf.mesh.getWorldPosition(new THREE.Vector3()), t.colour, 1.4);
      }
      tick(2 / 60);
    }
  });
  const n = names(heard);
  assert.equal(n.filter((x) => x === 'siphon').length, 3, 'one reveal per phase');
  assert.equal(n.filter((x) => x === 'solved').length, 5, 'intake, three arms, core');
  assert.equal(n.filter((x) => x === 'siphonDown').length, 1);
  level.dispose();
});

// --- spawn pads ----------------------------------------------------------------

test('every level starts on a pad of the player\'s paint, so its first steps are fast', async () => {
  const { createLevel, LEVELS } = await import('../src/levels/index.js');
  const { SPAWN_PAD, SURFACE } = await import('../src/config.js');
  for (const { id } of LEVELS) {
    const level = createLevel(id, { scene: new THREE.Scene(), onWin: null, say: () => true });
    await level.load();
    level.root.updateMatrixWorld(true);
    const feet = level.spawn.clone();
    const floor = level.surfaces
      .filter((s) => s.isFloor && s.mesh.position.y <= feet.y + 1e-6 && s.worldToCell(feet.clone().setY(s.mesh.position.y)))
      .sort((a, b) => b.mesh.position.y - a.mesh.position.y)[0];
    assert.ok(floor, `${id}: a floor under the spawn`);
    const ground = feet.clone().setY(floor.mesh.position.y);
    assert.ok(floor.isPlayerPaintAtWorld(ground), `${id}: the spawn is on player paint`);
    assert.deepEqual(floor.surfaceAtWorld(ground), SURFACE[SPAWN_PAD.colour], `${id}: the pad is ${SPAWN_PAD.colour}`);
    const edge = ground.clone().add(new THREE.Vector3(SPAWN_PAD.half + 1.5, 0, 0));
    if (floor.worldToCell(edge)) assert.equal(floor.isPlayerPaintAtWorld(edge), false, `${id}: past the pad it is grey again`);
    level.dispose();
  }
});

// --- the Primer teaches submerge -----------------------------------------------

test('the Primer has a submerge pool in R2, and the sergeant says "hold Shift" in it, after the first line', async () => {
  const { Level00 } = await import('../src/levels/level-00-the-primer.js');
  const { PRIMER } = await import('../src/levels/layouts/primer.js');
  const said = [];
  let busy = false;
  const level = new Level00({ scene: new THREE.Scene(), onWin: null, say: (id) => { if (busy) return false; said.push(id); return true; } });
  await level.load();
  const pool = PRIMER.prepaint.find((p) => p.id === 'r2-pool');
  assert.ok(pool && pool.room === 'R2', 'the pool is in R2');
  const [x0, x1, z0, z1] = pool.rect;
  const inPool = { position: new THREE.Vector3((x0 + x1) / 2, 0, (z0 + z1) / 2), velocity: new THREE.Vector3(), takeDamage() {} };
  busy = true;   // the bar is still showing the first-splat line
  level.update(1 / 60, inPool);
  assert.deepEqual(said, [], 'a refused line is asked again, not lost');
  busy = false;
  level.update(1 / 60, inPool);
  level.update(1 / 60, inPool);
  assert.deepEqual(said, ['primer-splat', 'primer-submerge']);
  level.dispose();
});
