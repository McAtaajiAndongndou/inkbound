// The Primer's spike pit (R6, #101), in the BUILT level: it hurts, it never
// kills, and blue slides over it. Polish pass 1.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';

import { Level00 } from '../src/levels/level-00-the-primer.js';
import { PRIMER as L } from '../src/levels/layouts/primer.js';
import { TrapVolume } from '../src/levels/trap-volume.js';
import { TRAP } from '../src/config.js';

async function loaded() {
  const level = new Level00({ scene: new THREE.Scene(), onWin: null });
  await level.load();
  level.root.updateMatrixWorld(true);
  return level;
}

/** Player-shaped: `health`, `dead`, and a takeDamage that can kill. */
function runner(x, y, z, health = 100) {
  return {
    position: new THREE.Vector3(x, y, z),
    health,
    dead: false,
    taken: 0,
    takeDamage(n) {
      this.taken += n;
      this.health = Math.max(0, this.health - n);
      if (this.health === 0) this.dead = true;
      return true;
    },
  };
}

const pitBox = L.traps.find((t) => t.id === 'r6-spike-pit').box;
const [, , PIT_Y, , PIT_Z0, PIT_Z1] = pitBox;

/** Walk `who` north across the pit at `speed` m/s, ticking the pit at 60 Hz. */
function cross(pit, who, speed) {
  const dt = 1 / 60;
  for (let z = PIT_Z1 + 1; z > PIT_Z0 - 1; z -= speed * dt) {
    who.position.z = z;
    pit.update(dt, [who]);
  }
}

test('R6 has a spike pit built over its trap zone', async () => {
  const level = await loaded();
  assert.equal(level.pits.length, 1);
  const pit = level.pits[0];
  assert.ok(pit.floor, 'the pit found no floor to sit in');
  assert.ok(pit.trap.contains(new THREE.Vector3(0, PIT_Y, (PIT_Z0 + PIT_Z1) / 2)));
  level.dispose();
});

test('the pit damages on grey', async () => {
  const level = await loaded();
  const who = runner(0, PIT_Y, 0);
  cross(level.pits[0], who, 4);
  assert.ok(who.taken > 0, 'walking through the spikes cost nothing');
  level.dispose();
});

test('the pit never kills: standing in it for a minute leaves the spare health', async () => {
  const level = await loaded();
  const who = runner(0, PIT_Y, (PIT_Z0 + PIT_Z1) / 2, 40);
  for (let i = 0; i < 60 * 60; i++) level.pits[0].update(1 / 60, [who]);
  assert.equal(who.dead, false);
  assert.equal(who.health, TRAP.pit.spare);
  level.dispose();
});

test('blue slides over it: a blue-painted pit is crossed untouched; red is not an answer', async () => {
  const level = await loaded();
  const pit = level.pits[0];
  const paint = (colour) => {
    for (let z = PIT_Z1 + 1; z >= PIT_Z0 - 1; z -= 0.5) pit.floor.splat(new THREE.Vector3(0, PIT_Y, z), colour, 1.2);
  };

  paint('red');
  const onRed = runner(0, PIT_Y, 0);
  cross(pit, onRed, 4);
  assert.ok(onRed.taken > 0, 'red should not answer the pit');

  paint('blue');
  const onBlue = runner(0, PIT_Y, 0);
  cross(pit, onBlue, 4);
  assert.equal(onBlue.taken, 0, 'blue should slide over the spikes');
  level.dispose();
});

test('TrapVolume `spare`: a target with no health field still takes full damage', () => {
  const trap = new TrapVolume({ region: new THREE.Box3(new THREE.Vector3(-1, -1, -1), new THREE.Vector3(1, 1, 1)), damage: 15, spare: 1 });
  const hits = [];
  trap.update(0, [{ position: new THREE.Vector3(), takeDamage: (n) => hits.push(n) }]);
  assert.deepEqual(hits, [15]);
});
