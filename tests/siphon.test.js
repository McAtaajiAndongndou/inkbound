// The Siphon (#100): Last Colour's three-colour exam, against the issue's
// acceptance criteria and docs/levels/03-last-colour.md (R5).
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';

import { Level03 } from '../src/levels/level-03-horde.js';
import { LAST_COLOUR as L } from '../src/levels/layouts/last-colour.js';
import { LAST_COLOUR as TUNING, PAINT, PAINT_GUN, PLAYER } from '../src/config.js';

const S = TUNING.siphon;
const DT = 1 / 60;

async function loaded(onWin = null) {
  const level = new Level03({ scene: new THREE.Scene(), onWin });
  await level.load();
  level.root.updateMatrixWorld(true);
  for (const e of level.enemies) e.update = () => {};
  return level;
}
const player = { position: new THREE.Vector3(0, 0, -20) };   // the Core floor, south of the Siphon
const tick = (level, seconds) => { for (let t = 0; t < seconds - 1e-9; t += DT) level.update(DT, player); };
/** Core clear: the exam begins on the next tick. */
async function examLevel(onWin) {
  const level = await loaded(onWin);
  for (const r of level.roster) r.enemy.alive = false;
  tick(level, DT);
  return level;
}
const centre = (t) => t.surf.mesh.getWorldPosition(new THREE.Vector3());
const shoot = (t, colour) => t.surf.splat(centre(t), colour, PAINT_GUN.radius);
const past = (level) => tick(level, S.revealFor + DT);
const targets = (level, kind) => level.siphon.byKind(kind);

test('the exam waits for a clear Core, then opens on the intake', async () => {
  const level = await loaded();
  tick(level, 1);
  assert.equal(level.siphon.phase, 'dormant');
  for (const r of level.roster) r.enemy.alive = false;
  tick(level, DT);
  assert.equal(level.siphon.phase, 'intake');
  level.dispose();
});

test('a target does not exist before its phase, so nothing can be done out of order', async () => {
  const level = await examLevel();
  for (const t of [...targets(level, 'arm'), ...targets(level, 'core')]) {
    assert.ok(t.surf.mesh.position.y < PLAYER.killY, `${t.id} is out of reach during phase one`);
    assert.equal(t.frame.visible, false);
  }
  assert.ok(level.siphon.shutter.position.y < targets(level, 'core')[0].home.y + 1, 'the core is behind its shutter');
  level.dispose();
});

test('the tell before the test: during the reveal the frame pulses blue and paint is refused', async () => {
  const level = await examLevel();
  const [intake] = targets(level, 'intake');
  const seen = new Set();
  for (let t = 0; t < S.revealFor * 0.9; t += DT) {
    shoot(intake, 'blue');
    level.update(DT, player);
    seen.add(intake.frame.material.color.getHex());
  }
  assert.ok(seen.has(PAINT.blue.hex), 'the frame shows the colour it wants');
  assert.equal(level.siphon.share(intake, 'blue'), 0, 'paint during the reveal is wiped');
  assert.equal(intake.solved, false);
  level.dispose();
});

test('phase one: blue freezes the intake; damage and the wrong colour do nothing; you can recover', async () => {
  const level = await examLevel();
  const [intake] = targets(level, 'intake');
  past(level);

  shoot(intake, 'red');
  shoot(intake, 'green');
  tick(level, 1);
  assert.equal(level.siphon.phase, 'intake', 'red and green are only paint on it');

  shoot(intake, 'blue');   // forgot the colour, shot it again in the right one
  tick(level, DT);
  assert.equal(intake.solved, true);
  assert.equal(intake.frame.material.color.getHex(), new THREE.Color(S.frost).getHex(), 'frozen reads as frost');
  assert.equal(level.siphon.phase, 'arms');
  level.dispose();
});

test('phase two: the arms thrash; green pins each, and the phase ends when all three are pinned', async () => {
  const level = await examLevel();
  past(level);
  shoot(targets(level, 'intake')[0], 'blue');
  tick(level, DT);
  assert.equal(level.siphon.phase, 'arms');
  const arms = targets(level, 'arm');
  assert.equal(arms.length, 3);

  past(level);
  const before = arms.map((a) => a.surf.mesh.position.y);
  tick(level, 0.4);
  arms.forEach((a, i) => assert.notEqual(a.surf.mesh.position.y, before[i], `${a.id} thrashes`));
  assert.ok(new Set(arms.map((a) => a.surf.mesh.position.y.toFixed(3))).size > 1, 'out of step with each other');

  shoot(arms[0], 'green');
  tick(level, DT);
  assert.equal(arms[0].solved, true);
  const pinned = arms[0].surf.mesh.position.y;
  tick(level, 0.5);
  assert.equal(arms[0].surf.mesh.position.y, pinned, 'a pinned arm stops dead');
  assert.equal(level.siphon.phase, 'arms', 'two still thrash');

  for (const a of arms.slice(1)) shoot(a, 'green');
  tick(level, DT);
  assert.equal(level.siphon.phase, 'core');
  level.dispose();
});

test('phase three: red knocks the core in, the beacon dies, and the win fires once, after the finale', async () => {
  let wins = 0;
  const level = await examLevel(() => { wins++; });
  past(level);
  shoot(targets(level, 'intake')[0], 'blue');
  tick(level, DT);
  past(level);
  for (const a of targets(level, 'arm')) shoot(a, 'green');
  tick(level, DT);
  assert.equal(level.siphon.phase, 'core');

  const [core] = targets(level, 'core');
  past(level);
  assert.ok(level.siphon.shutter.position.y > core.home.y + S.core.size, 'the shutter has lifted');
  shoot(core, 'red');
  tick(level, DT);
  assert.equal(level.siphon.phase, 'finale');
  assert.equal(wins, 0, 'not before the finale has played');

  tick(level, S.finaleFor + 0.1);
  assert.equal(level.siphon.phase, 'done');
  assert.equal(wins, 1);
  assert.equal(level.root.getObjectByName('siphon-mast-beacon').visible, false, 'the beacon is dark');
  const sunk = centre(core).distanceTo(core.home);
  assert.ok(Math.abs(sunk - S.knockDepth) < 1e-6, 'the core is inside the machine');

  tick(level, 2);
  assert.equal(wins, 1, 'exactly once');
  level.dispose();
});

test('the leak: each phase spills its colour at the Siphon\'s foot, and it is paint you refill from', async () => {
  const level = await examLevel();
  const at = new THREE.Vector3(L.spill[0], 0, L.spill[1]);
  const floor = level.surfaces.find((s) => s.isFloor && Math.abs(s.mesh.position.y) < 1e-6 && s.worldToCell(at));
  assert.equal(floor.paintIdAtWorld(at), 1, 'blue for the intake');   // PAINT_IDS.blue
  assert.ok(floor.isPlayerPaintAtWorld(at), 'player paint: standing in it refills the tank');

  past(level);
  shoot(targets(level, 'intake')[0], 'blue');
  tick(level, DT);
  assert.equal(floor.paintIdAtWorld(at), 3, 'green for the arms');    // PAINT_IDS.green
  level.dispose();
});

test('every plate takes the paint gun at the Siphon: one centred shot solves it', async () => {
  // A single splat at the plate's centre must clear the `need` share, so the
  // exam costs about one shot per target — knowledge, not ammunition.
  const level = await examLevel();
  past(level);
  for (const t of level.siphon.targets) {
    level.siphon._place(t);
    shoot(t, t.colour);
    assert.ok(level.siphon.share(t) >= S.need, `${t.id}: one shot covers ${level.siphon.share(t)}`);
  }
  level.dispose();
});

test('ten loads with the Siphon leak nothing into the scene', async () => {
  const scene = new THREE.Scene();
  for (let i = 0; i < 10; i++) {
    const level = new Level03({ scene });
    await level.load();
    scene.add(level.root);
    level.dispose();
  }
  assert.equal(scene.children.length, 0);
});

test('the real paint gun, fired from the Core floor, solves the intake and the core', async () => {
  const { PaintGun } = await import('../src/paint/paint-gun.js');
  const level = await examLevel();
  const gun = new PaintGun(level.surfaces, 'last-colour', [], new THREE.Scene());
  const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 500);
  const fireAt = (t, colour, from) => {
    camera.position.set(...from);
    camera.lookAt(centre(t));
    camera.updateMatrixWorld();
    gun.selectColour(gun.colours.indexOf(colour));
    gun.cooldown = 0;
    assert.equal(gun.tryFire(camera, null, true), true, `the gun fires at ${t.id}`);
    for (let i = 0; i < 60; i++) gun.update(DT);
  };

  past(level);
  const [intake] = targets(level, 'intake');
  fireAt(intake, 'blue', [0, PLAYER.eyeHeight, -22]);
  tick(level, DT);
  assert.equal(intake.solved, true, 'one blue shot from 9 m freezes the intake');

  // Arms: pinned by hand here (the phase-two test covers them).
  past(level);
  for (const a of targets(level, 'arm')) shoot(a, 'green');
  tick(level, DT);
  past(level);
  const [core] = targets(level, 'core');
  fireAt(core, 'red', [0, PLAYER.eyeHeight, -20]);
  tick(level, DT);
  assert.equal(level.siphon.phase, 'finale', 'one red shot from the floor reaches the core 16 m up');
  gun.dispose();
  level.dispose();
});
