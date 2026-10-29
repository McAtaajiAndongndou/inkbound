import test from 'node:test';
import assert from 'node:assert/strict';

import * as avatarModule from '../src/shaders/avatar.js';
import * as config from '../src/config.js';

const { Avatar } = avatarModule;

// #122: the player's climb animation. Drives the state machine directly, like
// avatar-airborne.test.js: no mixer, no GLB, a fake action that records calls.
// Neither the rig nor the #121 library has a climb clip, so the shipped rig is
// tested against the documented fallback, and a rig WITH one must prefer it.

const ARMED_IDLE = 'Idle_Gun_Pointing';
const ARMED_RUN = 'Run_Shoot';
const SHIPPED = [ARMED_IDLE, ARMED_RUN, 'Jump_Start', 'Jump_Loop', 'Jump_Land'];

function fakeAction(name) {
  const a = {
    name,
    plays: 0,
    fadesIn: [],
    timeScale: 1,
    reset() { return a; },
    fadeIn(sec) { a.fadesIn.push(sec); return a; },
    fadeOut() { return a; },
    play() { a.plays += 1; return a; },
    setLoop() { return a; },
    getClip() { return { name, duration: 1 }; },
  };
  return a;
}

function makeAvatar(clipNames) {
  const avatar = Object.create(Avatar.prototype);
  avatar.actions = {};
  for (const name of clipNames) avatar.actions[name] = fakeAction(name);
  avatar.current = null;
  avatar.armed = true;
  avatar.aiming = true;
  avatar.moving = false;
  avatar.airborne = false;
  avatar._airKind = null;
  avatar._landing = false;
  avatar._landClipName = null;
  avatar.climbing = false;
  return avatar;
}

const name = (avatar) => avatar.current?.name ?? null;

/** What main.js does each frame, in its order. */
function frame(avatar, { climbing, onGround, vy, moving }) {
  avatar.setClimbing(climbing, vy);
  avatar.setAirborne(onGround, vy);
  avatar.setMoving(moving);
}

test('a climbing player does not run up the wall', () => {
  const avatar = makeAvatar(SHIPPED);
  frame(avatar, { climbing: false, onGround: true, vy: 0, moving: true });
  assert.equal(name(avatar), ARMED_RUN, 'precondition: running on the ground');

  frame(avatar, { climbing: true, onGround: false, vy: 4.5, moving: true });
  assert.notEqual(name(avatar), ARMED_RUN);
  assert.equal(name(avatar), 'Jump_Loop', 'the documented fallback');
});

test('a climb is not read as a jump, even though the player is off the floor', () => {
  const avatar = makeAvatar(SHIPPED);
  frame(avatar, { climbing: true, onGround: false, vy: 4.5, moving: true });
  assert.notEqual(name(avatar), 'Jump_Start');
  assert.equal(avatar.airborne, false);
});

test('a real climb clip wins over the fallback', () => {
  const avatar = makeAvatar([...SHIPPED, 'Climb']);
  frame(avatar, { climbing: true, onGround: false, vy: 4.5, moving: true });
  assert.equal(name(avatar), 'Climb');
});

test('with no climb or library clips the avatar idles, never runs or T-poses', () => {
  const avatar = makeAvatar([ARMED_IDLE, ARMED_RUN]);
  frame(avatar, { climbing: true, onGround: false, vy: 4.5, moving: true });
  assert.equal(name(avatar), ARMED_IDLE);
});

test('the climb clip is chosen once, not restarted every frame', () => {
  const avatar = makeAvatar(SHIPPED);
  for (let i = 0; i < 30; i++) {
    frame(avatar, { climbing: true, onGround: false, vy: 4.5, moving: true });
  }
  assert.equal(avatar.actions.Jump_Loop.plays, 1);
});

test('the entry blend is short enough not to lag the physics', () => {
  const avatar = makeAvatar(SHIPPED);
  frame(avatar, { climbing: true, onGround: false, vy: 4.5, moving: false });
  const fade = avatar.actions.Jump_Loop.fadesIn.at(-1);
  assert.ok(fade <= 0.1, `blend was ${fade}s`);
  assert.equal(fade, config.ANIM.airBlend);
});

test('moving up and moving down are not the same: the clip reverses', () => {
  const avatar = makeAvatar(SHIPPED);
  frame(avatar, { climbing: true, onGround: false, vy: 4.5, moving: false });
  assert.equal(avatar.actions.Jump_Loop.timeScale, 1);

  frame(avatar, { climbing: true, onGround: false, vy: -4.5, moving: false });
  assert.equal(avatar.actions.Jump_Loop.timeScale, -1);

  frame(avatar, { climbing: true, onGround: false, vy: 4.5, moving: false });
  assert.equal(avatar.actions.Jump_Loop.timeScale, 1);
});

test('a wall-jump exit goes straight to the jump clip', () => {
  const avatar = makeAvatar(SHIPPED);
  frame(avatar, { climbing: true, onGround: false, vy: 4.5, moving: true });
  frame(avatar, { climbing: false, onGround: false, vy: 8.5, moving: true });
  assert.equal(name(avatar), 'Jump_Start');
});

test('dropping off the wall falls', () => {
  const avatar = makeAvatar(SHIPPED);
  frame(avatar, { climbing: true, onGround: false, vy: 4.5, moving: true });
  frame(avatar, { climbing: false, onGround: false, vy: -3, moving: true });
  assert.equal(name(avatar), 'Jump_Loop');
  assert.equal(avatar.actions.Jump_Loop.timeScale, 1, 'the reverse is cleared on exit');
  assert.equal(avatar.airborne, true, 'the fall is now an air state');
});

test('topping out onto the ledge returns to locomotion with no land beat', () => {
  const avatar = makeAvatar(SHIPPED);
  frame(avatar, { climbing: true, onGround: false, vy: 4.5, moving: true });
  frame(avatar, { climbing: false, onGround: true, vy: 0, moving: true });
  assert.equal(name(avatar), ARMED_RUN);
  assert.equal(avatar._landing, false);
});

test('a climb cancels an unfinished land beat', () => {
  const avatar = makeAvatar(SHIPPED);
  avatar._landing = true;
  avatar._landClipName = 'Jump_Land';
  frame(avatar, { climbing: true, onGround: false, vy: 4.5, moving: true });
  assert.equal(avatar._landing, false);
  assert.equal(name(avatar), 'Jump_Loop');
});

test('a climb does not break the ground and air states it sits between', () => {
  const avatar = makeAvatar(SHIPPED);
  frame(avatar, { climbing: false, onGround: true, vy: 0, moving: false });
  assert.equal(name(avatar), ARMED_IDLE);
  frame(avatar, { climbing: false, onGround: false, vy: 8.5, moving: false });
  assert.equal(name(avatar), 'Jump_Start');
});

test('with Idle_Neutral on the rig, the climb is the procedural overlay, not an airborne clip', () => {
  const avatar = makeAvatar([...SHIPPED, 'Idle_Neutral']);
  frame(avatar, { climbing: true, onGround: false, vy: 4.5, moving: true });
  assert.equal(name(avatar), 'Idle_Neutral');
  assert.notEqual(name(avatar), 'Jump_Loop');
  assert.equal(avatar._climbClip(), null);
});