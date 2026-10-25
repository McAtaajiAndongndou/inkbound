import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';

import { TrapVolume } from '../src/levels/trap-volume.js';
import { Enemy } from '../src/enemies/enemy.js';
import { TRAP, HEALTH, ENEMY } from '../src/config.js';

/**
 * The contract TrapVolume reads. `takeDamage` is the seam the enemies lane has
 * not filled yet (Enemy exposes only `takeColourHit`), which is why one test
 * below pins the "no takeDamage = skipped" behaviour on purpose.
 */
function makeTarget(x, y, z, hp = 100) {
  return {
    position: new THREE.Vector3(x, y, z),
    hp,
    dead: false,
    hits: [],
    takeDamage(n) {
      this.hits.push(n);
      this.hp -= n;
      if (this.hp <= 0) this.dead = true;
      return true;
    },
  };
}

function region(xMin = -1, xMax = 1, zMin = -1, zMax = 1) {
  return new THREE.Box3(
    new THREE.Vector3(xMin, -0.5, zMin),
    new THREE.Vector3(xMax, 1, zMax),
  );
}

function volume(overrides = {}) {
  return new TrapVolume({ region: region(), damage: 15, cooldown: 1, ...overrides });
}

test('a target standing inside the region takes damage once', () => {
  const trap = volume();
  const target = makeTarget(0, 0, 0);

  trap.update(1 / 60, [target]);

  assert.deepEqual(target.hits, [15]);
});

test('a target outside the region is untouched', () => {
  const trap = volume();
  const target = makeTarget(5, 0, 0);

  trap.update(1 / 60, [target]);

  assert.deepEqual(target.hits, []);
});

test('the cooldown stops a second hit, and expires on its own', () => {
  const trap = volume({ cooldown: 1 });
  const target = makeTarget(0, 0, 0);

  // 1 second of frames = exactly the cooldown. One hit, not sixty.
  for (let i = 0; i < 60; i++) trap.update(1 / 60, [target]);
  assert.equal(target.hits.length, 1);

  // A frame or two after it expires is a second hit. The margin is there on
  // purpose: 1/60 is not exact in binary, so the last frame can leave a residue.
  trap.update(1 / 60, [target]);
  trap.update(1 / 60, [target]);
  assert.equal(target.hits.length, 2);
});

test('leaving and re-entering does not skip the cooldown', () => {
  const trap = volume({ cooldown: 1 });
  const target = makeTarget(0, 0, 0);

  trap.update(1 / 60, [target]);            // hit
  target.position.set(5, 0, 0);             // step out
  trap.update(0.5, [target]);               // cooldown still runs
  target.position.set(0, 0, 0);             // step back in
  trap.update(1 / 60, [target]);

  assert.equal(target.hits.length, 1, 're-entering must not re-trigger a trap you just escaped');
});

test('a corpse is not a hazard', () => {
  const trap = volume();
  const corpse = makeTarget(0, 0, 0);
  corpse.dead = true;

  trap.update(1 / 60, [corpse]);
  assert.deepEqual(corpse.hits, []);
});

test('a target with no colourless damage method is skipped, not hit with a proc', () => {
  // A stand-in for anything that only knows how to take a coloured hit. The
  // helper must not invent a colour on its behalf.
  const trap = volume();
  const paintOnly = { position: new THREE.Vector3(0, 0, 0), alive: true, takeColourHit() {} };

  assert.doesNotThrow(() => trap.update(1 / 60, [paintOnly]));
});

test('every target inside is damaged independently', () => {
  const trap = volume();
  const a = makeTarget(0.5, 0, 0.5);
  const b = makeTarget(-0.5, 0, -0.5);
  const outside = makeTarget(9, 0, 9);

  trap.update(1 / 60, [a, b, outside]);

  assert.equal(a.hits.length, 1);
  assert.equal(b.hits.length, 1);
  assert.equal(outside.hits.length, 0);
});

test('the spike pit is survivable at full health', () => {
  assert.ok(
    TRAP.spike.damage < HEALTH.max,
    'a trap must damage, never one-shot',
  );
  assert.ok(
    HEALTH.max - TRAP.spike.damage > 0,
    'one hit must leave the player alive',
  );
});

test('fresh hazards must assume a real enemy death path, not a paint one', () => {
  // A real Enemy inside a region: this is the seam PRD F1 was about. It does not
  // need a level to prove it — the helper must work wherever a hazard is placed,
  // and Outskirts no longer places one (docs/levels/01-outskirts.md, "The trap
  // language": the pit belongs to the Primer's corridor).
  const pit = new TrapVolume({
    region: new THREE.Box3(new THREE.Vector3(-1, -0.2, -1), new THREE.Vector3(1, 1, 1)),
    damage: TRAP.spike.damage,
    cooldown: TRAP.spike.cooldown,
  });

  const charger = new Enemy({
    position: new THREE.Vector3(0, 0, 0),
    config: ENEMY.charger,
    parent: new THREE.Group(),
    floors: [],
  });

  // 15 against 30 hp on a 1 s cooldown: the second hit kills.
  for (let i = 0; i < 180 && charger.alive; i++) pit.update(1 / 60, [charger]);

  assert.equal(charger.alive, false, 'a Charger left in a hazard must die, not idle in it');
  assert.equal(charger._tintTimer, 0, 'the kill must not read as a paint kill');
});

test('Enemy.takeDamage is colourless: damage and death, no paint proc', () => {
  const enemy = new Enemy({
    position: new THREE.Vector3(0, 0, 0),
    config: ENEMY.charger,
    parent: new THREE.Group(),
    floors: [],
  });

  assert.equal(enemy.takeDamage(5), true);
  assert.equal(enemy.hp, ENEMY.charger.hp - 5);
  assert.equal(enemy.alive, true);

  // None of the paint reactions fired. `grey` would have been rejected outright
  // by takeColourHit, which is exactly why this method exists.
  assert.equal(enemy._tintTimer, 0, 'no tint');
  assert.equal(enemy._slipTimer, 0, 'no blue slip');
  assert.equal(enemy._pinnedTimer, 0, 'no green pin');

  enemy.takeDamage(ENEMY.charger.hp);
  assert.equal(enemy.alive, false);
  assert.equal(enemy.takeDamage(5), false, 'a corpse cannot take more damage');
});

