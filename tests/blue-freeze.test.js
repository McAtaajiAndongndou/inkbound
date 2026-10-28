import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';

import { Enemy } from '../src/enemies/enemy.js';
import { ENEMY, BLUE_FREEZE, PAINT_IDS } from '../src/config.js';

const FAR = new THREE.Vector3(0, 0, 100);
const DT = 1 / 60;

function make(type = 'sprayer') {
  return new Enemy({
    position: new THREE.Vector3(0, 0, 0),
    config: ENEMY[type],
    parent: new THREE.Group(),
    floors: [],
  });
}

function tick(enemy, seconds) {
  for (let t = 0; t < seconds; t += DT) enemy.update(DT, FAR);
}

function freeze(enemy) {
  for (let i = 0; i < BLUE_FREEZE.hitsToFreeze; i++) enemy.takeColourHit(PAINT_IDS.blue, 10);
}

function arm(enemy) {
  tick(enemy, BLUE_FREEZE.armDelay + 0.05);
}

test('three blue hits inside the window freeze a non-turret enemy', () => {
  const e = make();
  freeze(e);
  assert.ok(e._frozenTimer > 0);
  assert.equal(e._frostShell.visible, true);
});

test('buildup decays if the player stops hitting', () => {
  const e = make();
  e.takeColourHit(PAINT_IDS.blue, 10);
  e.takeColourHit(PAINT_IDS.blue, 10);
  tick(e, BLUE_FREEZE.buildupWindow + 0.1);
  assert.equal(e._blueHitCount, 0);
  assert.equal(e._frostShell.visible, false);

  e.takeColourHit(PAINT_IDS.blue, 10);
  assert.equal(e._frozenTimer, 0, 'old hits must not count toward a new freeze');
});

test('the window does not slide: late hits cannot extend it', () => {
  const e = make();
  e.takeColourHit(PAINT_IDS.blue, 10);
  tick(e, BLUE_FREEZE.buildupWindow - 0.1);
  e.takeColourHit(PAINT_IDS.blue, 10);
  tick(e, 0.2);                       // the first hit's window has now expired
  e.takeColourHit(PAINT_IDS.blue, 10);
  assert.equal(e._frozenTimer, 0);
});

test('a freeze expires on its own after the crit window', () => {
  const e = make();
  freeze(e);
  tick(e, BLUE_FREEZE.critWindow + 0.1);
  assert.equal(e._frozenTimer, 0);
  assert.equal(e._frostShell.visible, false);
});

test('buildup hits deal scaled damage', () => {
  const e = make();
  const before = e.hp;
  e.takeColourHit(PAINT_IDS.blue, 10);
  assert.equal(before - e.hp, Math.round(10 * BLUE_FREEZE.buildupDamageScale));
});

test('the next armed hit of any colour crits and ends the freeze', () => {
  const e = make();
  freeze(e);
  arm(e);
  const before = e.hp;
  e.takeColourHit(PAINT_IDS.red, 10);
  assert.equal(before - e.hp, 10 * BLUE_FREEZE.criticalMultiplier);
  assert.equal(e._frozenTimer, 0);
  assert.equal(e._frostShell.visible, false);
});

test('a hit inside the arm delay does not spend the freeze', () => {
  const e = make();
  freeze(e);
  const before = e.hp;
  e.takeColourHit(PAINT_IDS.red, 10);
  assert.equal(before - e.hp, 10, 'normal damage, no crit');
  assert.ok(e._frozenTimer > 0, 'still frozen');
});

test('a turret never freezes and always takes full damage', () => {
  const t = make('turret');
  for (let i = 0; i < 5; i++) {
    const before = t.hp;
    t.takeColourHit(PAINT_IDS.blue, 10);
    assert.equal(before - t.hp, 10);
  }
  assert.equal(t._frozenTimer, 0);
  assert.equal(t._frostShell.visible, false);
});

test('environmental damage never crits or ends a freeze', () => {
  const e = make();
  freeze(e);
  arm(e);
  const before = e.hp;
  e.takeDamage(10);
  assert.equal(before - e.hp, 10);
  assert.ok(e._frozenTimer > 0);
});

test('the frost shell strengthens with each blue hit and is full when frozen', () => {
  const e = make();
  const u = e._frostShell.material.uniforms.uOpacity;

  e.takeColourHit(PAINT_IDS.blue, 10);
  const afterOne = u.value;
  e.takeColourHit(PAINT_IDS.blue, 10);
  const afterTwo = u.value;
  e.takeColourHit(PAINT_IDS.blue, 10);

  assert.ok(afterOne < afterTwo, 'second hit is stronger than the first');
  assert.ok(afterTwo < BLUE_FREEZE.shellOpacity, 'buildup is weaker than frozen');
  assert.equal(u.value, BLUE_FREEZE.shellOpacity);
});