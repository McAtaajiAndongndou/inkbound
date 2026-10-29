/**
 * #124 — player combat poses.
 *
 * These never build an `Avatar`: the constructor fires a GLB load that
 * `node --test` cannot serve, and none of the pose logic needs a model. The
 * object below has the prototype and the fields the state machine reads, which
 * is enough to prove WHICH clip each state asks for — the thing that was wrong.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';

import { Avatar } from '../src/shaders/avatar.js';

const DURATION = 0.5;

function fakeAction(name, duration = DURATION) {
  return {
    name,
    resets: 0,
    loop: null,
    clampWhenFinished: false,
    reset() { this.resets++; return this; },
    fadeIn() { return this; },
    fadeOut() { return this; },
    play() { return this; },
    setLoop(loop, repetitions) { this.loop = loop; this.repetitions = repetitions; return this; },
    getClip() { return { duration }; },
  };
}

/** Every clip the soldier rig ships, so a missing one is a test failure. */
const CLIP_NAMES = [
  'Idle', 'Idle_Gun', 'Idle_Gun_Pointing', 'Idle_Gun_Shoot',
  'Run', 'Run_Shoot', 'Gun_Shoot', 'HitRecieve', 'HitRecieve_2',
];

function makeAvatar() {
  const avatar = Object.create(Avatar.prototype);
  avatar.armed = true;
  avatar.moving = false;
  avatar.aiming = false;
  avatar.airborne = false;
  avatar._airKind = null;
  avatar._landing = false;
  avatar._landClipName = null;
  avatar._accent = false;
  avatar._accentKind = null;
  avatar._accentName = null;
  avatar._accentLeft = 0;
  avatar._hits = 0;
  avatar.current = null;
  avatar.actions = {};
  for (const name of CLIP_NAMES) avatar.actions[name] = fakeAction(name);
  avatar.mixer = { update() {} };
  return avatar;
}

test('the default armed pose is NOT the aim pose', () => {
  // The bug #124 exists to fix: `Idle_Gun_Pointing` used to be the armed idle, so
  // the player was permanently aiming and the aim input had nothing to change.
  const avatar = makeAvatar();
  avatar.setArmed(true);
  assert.equal(avatar.current.name, 'Idle_Gun');
  assert.notEqual(avatar.current.name, 'Idle_Gun_Pointing');
});

test('aiming raises the gun and releasing lowers it', () => {
  const avatar = makeAvatar();

  avatar.setAiming(true);
  assert.equal(avatar.current.name, 'Idle_Gun_Pointing', 'aiming is the pointing pose');

  avatar.setAiming(false);
  assert.equal(avatar.current.name, 'Idle_Gun', 'releasing goes back to the neutral hold');
});

test('aiming while moving keeps the legs running', () => {
  const avatar = makeAvatar();
  avatar.setMoving(true);
  assert.equal(avatar.current.name, 'Run');

  avatar.setAiming(true);
  assert.equal(avatar.current.name, 'Run_Shoot', 'the combined clip: aimed, still running');
});

test('the aim pose is restored by the next state change, not only by aim input', () => {
  const avatar = makeAvatar();
  avatar.setAiming(true);
  avatar.setMoving(true);
  assert.equal(avatar.current.name, 'Run_Shoot');

  avatar.setMoving(false);
  assert.equal(avatar.current.name, 'Idle_Gun_Pointing', 'standing still while aimed');
});

test('a standing shot is Gun_Shoot, a moving shot keeps the run', () => {
  const standing = makeAvatar();
  standing.fire();
  assert.equal(standing.current.name, 'Gun_Shoot');

  const moving = makeAvatar();
  moving.setMoving(true);
  moving.fire();
  assert.equal(moving.current.name, 'Run_Shoot', 'firing must not stop the legs');
});

test('a shot is a one-shot that does not loop and does not clamp', () => {
  const avatar = makeAvatar();
  avatar.fire();
  const action = avatar.actions.Gun_Shoot;

  assert.equal(action.loop, THREE.LoopOnce, 'a shot is a one-shot');
  assert.equal(action.clampWhenFinished, false, 'a clamped accent can stick forever');
});

test('starting to run mid-shot swaps to the running variant at once', () => {
  const avatar = makeAvatar();
  avatar.fire();
  assert.equal(avatar.current.name, 'Gun_Shoot');

  // "Firing must not cancel locomotion" is not only about the frame you pull the
  // trigger on: a shot that keeps `Gun_Shoot` up while the player accelerates
  // freezes the legs for the whole clip.
  avatar.setMoving(true);
  assert.equal(avatar.current.name, 'Run_Shoot', 'the legs answer on the same frame');
});

test('stopping mid-shot goes back to the standing variant', () => {
  const avatar = makeAvatar();
  avatar.setMoving(true);
  avatar.fire();
  assert.equal(avatar.current.name, 'Run_Shoot');

  avatar.setMoving(false);
  assert.equal(avatar.current.name, 'Gun_Shoot');
});

test('a flinch holds the body through a change of speed', () => {
  const avatar = makeAvatar();
  avatar.hit();
  assert.equal(avatar.current.name, 'HitRecieve');

  // Being hit staggers you: the reaction outranks the legs until it ends.
  avatar.setMoving(true);
  assert.equal(avatar.current.name, 'HitRecieve', 'a flinch is not interrupted by a walk');

  avatar.update(DURATION + 0.1);
  assert.equal(avatar.current.name, 'Run', 'and the legs come back when it ends');
});

test('the accent hands the body back when its clip finishes', () => {
  const avatar = makeAvatar();
  avatar.setMoving(true);
  avatar.fire();

  // The frame-rate caller must not cut the accent off on the very next frame.
  avatar.setMoving(true);
  assert.equal(avatar.current.name, 'Run_Shoot', 'still firing');

  avatar.update(DURATION + 0.1);
  assert.equal(avatar.current.name, 'Run', 'and the plain run comes back');
});

test('a second shot restarts the same clip instead of freezing on it', () => {
  const avatar = makeAvatar();
  avatar.fire();
  const before = avatar.actions.Gun_Shoot.resets;

  avatar.fire();
  assert.equal(avatar.actions.Gun_Shoot.resets, before + 1, 'holding the trigger keeps firing');
});

test('a hit plays HitRecieve once, and the next hit alternates', () => {
  const avatar = makeAvatar();

  avatar.hit();
  assert.equal(avatar.current.name, 'HitRecieve');
  avatar.update(DURATION + 0.1);

  avatar.hit();
  assert.equal(avatar.current.name, 'HitRecieve_2');
});

test('a hit does not interrupt a jump', () => {
  const avatar = makeAvatar();
  avatar.airborne = true;
  avatar.hit();
  assert.equal(avatar._accent, false, 'the air state owns the body');
});

test('a shot does not interrupt a landing', () => {
  const avatar = makeAvatar();
  avatar._landing = true;
  avatar.fire();
  assert.equal(avatar._accent, false);
});

test('going airborne cancels an accent that was already playing', () => {
  const avatar = makeAvatar();
  avatar.actions.Fall = fakeAction('Fall');
  avatar.fire();
  assert.equal(avatar._accent, true);

  avatar.setAirborne(false, 0);   // a fall, from the physics
  assert.equal(avatar._accent, false, 'a shot must not outlive the ground');
  assert.equal(avatar.current.name, 'Fall');
});

test('a clip that never reports finishing cannot hold the pose', () => {
  const avatar = makeAvatar();
  avatar.fire();
  assert.equal(avatar._accent, true);

  // No `finished` event is ever delivered here: the watchdog is the only thing
  // that ends the accent, which is #124's "state ends early" guarantee.
  avatar.update(DURATION + 0.1);
  assert.equal(avatar._accent, false);
  assert.equal(avatar.current.name, 'Idle_Gun');
});

test('an unarmed avatar has no aim pose to raise into', () => {
  const avatar = makeAvatar();
  avatar.setArmed(false);

  avatar.setAiming(true);
  assert.equal(avatar.current.name, 'Idle', 'the unarmed set has no pointing clip');
});
