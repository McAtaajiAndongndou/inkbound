import test from 'node:test';
import assert from 'node:assert/strict';
import { Avatar } from '../src/shaders/avatar.js';

function makeAvatar() {
  const a = Object.create(Avatar.prototype);
  const act = (name) => ({ name, reset() { return this; }, fadeIn() { return this; },
    fadeOut() { return this; }, play() { return this; }, setLoop() { return this; } });
  a.actions = { Idle_Gun_Pointing: act('Idle_Gun_Pointing'), Run_Shoot: act('Run_Shoot') };
  Object.assign(a, { current: null, armed: true, moving: false, airborne: false, _airKind: null,
    _landing: false, _landClipName: null, climbing: false, _air: { jump: 0, fall: 0, land: 0, push: 0 } });
  return a;
}
const DT = 1 / 60;

test('a ground jump starts with a push-off crouch', () => {
  const a = makeAvatar();
  a.setAirborne(false, 8.5);
  a._stepAir(DT);
  assert.ok(a._air.push > 0.5);
  for (let i = 0; i < 10; i++) a._stepAir(DT);
  assert.equal(a._air.push, 0);
});

test('a wall-jump skips the push-off', () => {
  const a = makeAvatar();
  a.setClimbing(true, 4.5);
  a.setClimbing(false, 8.5);
  a.setAirborne(false, 8.5);
  a._stepAir(DT);
  assert.equal(a._air.push, 0);
});

test('a long fall lands deeper than a small hop', () => {
  const peak = (vy) => {
    const a = makeAvatar();
    a.setAirborne(false, vy);
    a.setAirborne(true, 0);
    let max = 0;
    for (let i = 0; i < 30; i++) { a._stepAir(DT); max = Math.max(max, a._air.land); }
    return max;
  };
  assert.ok(peak(-14) > peak(-3) + 0.2);
  assert.ok(peak(-3) > 0);
});

test('the land crouch does not block locomotion', () => {
  const a = makeAvatar();
  a.setAirborne(false, -8);
  a.setAirborne(true, 0);
  a.setMoving(true);
  assert.equal(a.current.name, 'Run_Shoot');
  a._stepAir(0.04);
  assert.ok(a._air.land > 0);
});