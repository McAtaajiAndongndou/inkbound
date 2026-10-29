import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';

import { Level01 } from '../src/levels/level-01-mission.js';
import { TRAP, OUTSKIRTS } from '../src/config.js';

// Polish pass 1, Outskirts (docs/levels/polish-pass-1.md, section 1): the vent in
// island C and the decor reveal on the Ledge.

async function buildLevel() {
  const level = new Level01({ scene: new THREE.Scene(), onWin: null });
  await level.load();
  level.root.updateMatrixWorld(true);
  return level;
}

function makeTarget(x, y, z) {
  return {
    position: new THREE.Vector3(x, y, z),
    hits: [],
    takeDamage(n) { this.hits.push(n); return true; },
  };
}

/** One full cycle of the vent's rhythm, in small steps. */
function runCycle(vent, targets) {
  const { rest, tell, erupt } = TRAP.vent;
  const total = rest + tell + erupt + 0.1;
  for (let t = 0; t < total; t += 1 / 60) vent.update(1 / 60, targets);
}

function ventCentre(level) {
  const r = level.vent.rect;
  return new THREE.Vector3((r.xMin + r.xMax) / 2, 0, (r.zMin + r.zMax) / 2);
}

test('the vent sits on island C, in its own lane, clear of the block', async () => {
  const level = await buildLevel();
  const r = level.vent.rect;
  assert.ok(level.vent.floor, 'the vent found no floor under it');
  assert.ok(level._inIsland('C', ventCentre(level)), 'the vent is not on island C');
  // The block is x 7..11; the vent must not overlap it, or the lane is gone.
  assert.ok(r.xMin >= 11, `the vent overlaps the block (xMin ${r.xMin})`);
  level.dispose();
});

test('an unpainted vent erupts and hurts whoever stands on it', async () => {
  const level = await buildLevel();
  const target = makeTarget(...ventCentre(level).add(new THREE.Vector3(0, 0.1, 0)).toArray());

  assert.equal(level.vent.dormant, false);
  runCycle(level.vent, [target]);

  assert.deepEqual(target.hits, [TRAP.vent.damage], 'one eruption should be one hit');
  level.dispose();
});

test('a painted vent goes dormant and deals no damage', async () => {
  const level = await buildLevel();
  const centre = ventCentre(level);
  level.vent.floor.splat(centre, 'blue', 2.5);
  const target = makeTarget(centre.x, 0.1, centre.z);

  assert.equal(level.vent.dormant, true, 'paint over the grate should kill the vent');
  runCycle(level.vent, [target]);
  runCycle(level.vent, [target]);

  assert.deepEqual(target.hits, []);
  assert.equal(level.vent.column.visible, false, 'a dead vent must not show its column');
  level.dispose();
});

test('grey over the paint re-arms the vent', async () => {
  const level = await buildLevel();
  const centre = ventCentre(level);
  level.vent.floor.splat(centre, 'blue', 2.5);
  assert.equal(level.vent.dormant, true);

  level.vent.floor.splat(centre, 'grey', 2.5);
  assert.equal(level.vent.dormant, false);
  level.dispose();
});

test('the vent hurts enemies too, so a Charger can be shoved into it', async () => {
  const level = await buildLevel();
  const centre = ventCentre(level);
  const enemyLike = makeTarget(centre.x, 0.1, centre.z);
  enemyLike.alive = true;

  runCycle(level.vent, [enemyLike]);
  assert.equal(enemyLike.hits.length, 1);
  level.dispose();
});

test('landing on the Ledge brings back the props near the player\'s paint, once', async () => {
  const level = await buildLevel();
  const props = level.decor.tree.props.filter((p) => p.floor);
  const near = props[0];
  const far = props.find((p) => Math.hypot(p.x - near.x, p.z - near.z) > 10);

  // Paint NEXT TO the tree, not under it: the moment-to-moment reaction would
  // never see this, and the reveal should.
  const beside = new THREE.Vector3(near.x + OUTSKIRTS.reveal.radius, near.y, near.z);
  near.floor.splat(beside, 'red', 0.8);
  assert.equal(near.paintName, 'grey');

  // Not on the ledge yet: nothing happens.
  level._revealOnLedge(new THREE.Vector3(0, 0, -20));
  assert.equal(near.paintName, 'grey');

  level._revealOnLedge(new THREE.Vector3(0, 12, -40));
  assert.equal(near.paintName, 'red', 'the tree beside the paint did not come back');
  assert.equal(far.paintName, 'grey', 'a tree nowhere near paint should stay grey');
  assert.equal(level.revealed, true);
  level.dispose();
});

test('the viewer has fixed shots for the vent and the Ledge', () => {
  const names = Level01.SHOTS.map((s) => s.name);
  assert.ok(names.includes('vent'));
  assert.ok(names.includes('ledge'));
});
