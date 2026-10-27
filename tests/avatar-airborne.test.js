import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';

import * as avatarModule from '../src/shaders/avatar.js';
import * as config from '../src/config.js';
// Namespace imports, not `{ Avatar, LIBRARY_CLIPS }` and `{ ANIM }`: on the
// commit before #82 config.js has no ANIM export, and on a branch before #121
// avatar.js has no LIBRARY_CLIPS export, and a named import turns either into
// one module-level crash that says nothing about the behaviour. Reading them off
// the namespace lets every test fail on its own merits instead.

const { Avatar } = avatarModule;

/**
 * #82 — the player's airborne animation.
 *
 * The bug: `main.js` called `setMoving(speed > 0.5)` and nothing else, so the
 * avatar played its RUN cycle while falling through the air. Standing still
 * mid-jump looked like sprinting mid-jump.
 *
 * These tests drive the state machine directly. No mixer, no GLB, no browser:
 * `node --test` cannot load the model, and the state machine's whole job is
 * deciding WHICH clip, which is decidable without one. A fake action records
 * what was asked of it, so "did it play the jump clip" is a real assertion.
 *
 * The rig ships no jump/fall/land clip of its own; #121 brings three in from the
 * animation library under the names in LIBRARY_CLIPS, and the pack has no fall
 * clip at all. So every case here is run against a rig with the library clips and
 * a rig without them — that is what the fallback rule is for.
 */

/** The armed set the player actually runs with (main.js calls setArmed(true)). */
const ARMED_IDLE = 'Idle_Gun_Pointing';
const ARMED_RUN = 'Run_Shoot';

function fakeAction(name) {
  const a = {
    name,
    plays: 0,
    fadesIn: [],
    fadesOut: [],
    loop: null,
    clamp: false,
    reset() { return a; },
    fadeIn(sec) { a.fadesIn.push(sec); return a; },
    fadeOut(sec) { a.fadesOut.push(sec); return a; },
    play() { a.plays += 1; return a; },
    setLoop(loop) { a.loop = loop; return a; },
    getClip() { return { name, duration: 1 }; },
  };
  return a;
}

/**
 * An Avatar with the loader skipped. `Object.create` rather than `new Avatar`:
 * the constructor starts a GLTF fetch that cannot resolve in Node, and the
 * state machine does not depend on the model being there.
 */
function makeAvatar(clipNames, { armed = true } = {}) {
  const avatar = Object.create(Avatar.prototype);
  avatar.actions = {};
  for (const name of clipNames) avatar.actions[name] = fakeAction(name);
  avatar.current = null;
  avatar.armed = armed;
  avatar.moving = false;
  avatar.airborne = false;
  avatar._airKind = null;
  avatar._landing = false;
  avatar._landClipName = null;
  return avatar;
}

const currentName = (avatar) => avatar.current?.name ?? null;

test('airborne leaves the run cycle instead of running through the air', () => {
  const avatar = makeAvatar([ARMED_IDLE, ARMED_RUN, 'Jump']);

  avatar.setMoving(true);
  assert.equal(currentName(avatar), ARMED_RUN, 'precondition: running on the ground');

  // the frame the player leaves the floor, moving forward, rising
  avatar.setAirborne(false, 8.5);
  avatar.setMoving(true);          // main.js still reports "moving" mid-air

  assert.equal(currentName(avatar), 'Jump',
    'the avatar kept its run cycle while airborne — that is the bug in #82');
});

test('rising and falling use different clips when the rig has them', () => {
  const avatar = makeAvatar([ARMED_IDLE, ARMED_RUN, 'Jump_Start', 'Fall']);

  avatar.setAirborne(false, 8.5);  // leaving the floor, going up
  assert.equal(currentName(avatar), 'Jump_Start');

  avatar.setAirborne(false, -1.2); // past the apex, coming down
  assert.equal(currentName(avatar), 'Fall');
});

test('one airborne clip covers both directions when that is all the rig has', () => {
  const avatar = makeAvatar([ARMED_IDLE, ARMED_RUN, 'Jump']);

  avatar.setAirborne(false, 8.5);
  const rising = currentName(avatar);
  avatar.setAirborne(false, -6);
  const falling = currentName(avatar);

  assert.equal(rising, 'Jump');
  assert.equal(falling, 'Jump', 'a single airborne clip is a supported rig');
});

test('a missing airborne clip falls back to idle, never to the run cycle', () => {
  // This is the real rig today: five clips, none of them jump/fall/land (#49).
  const avatar = makeAvatar([ARMED_IDLE, ARMED_RUN, 'Death']);

  avatar.setMoving(true);
  avatar.setAirborne(false, 8.5);
  avatar.setMoving(true);

  assert.equal(currentName(avatar), ARMED_IDLE,
    'no airborne clip must read as "not running", not as "still running"');
  assert.notEqual(currentName(avatar), ARMED_RUN);
});

test('landing plays once and does not loop', () => {
  const avatar = makeAvatar([ARMED_IDLE, ARMED_RUN, 'Jump', 'Land']);

  avatar.setAirborne(false, 8.5);
  avatar.setAirborne(true, 0);            // touchdown

  const land = avatar.actions.Land;
  assert.equal(currentName(avatar), 'Land');
  assert.equal(land.loop, THREE.LoopOnce, 'a looping land beat never stops playing');
  assert.equal(land.clampWhenFinished, true, 'it must hold its last pose, not snap');
  assert.equal(land.plays, 1);
});

test('the land beat owns the body until its clip finishes', () => {
  const avatar = makeAvatar([ARMED_IDLE, ARMED_RUN, 'Jump', 'Land']);

  avatar.setAirborne(false, 8.5);
  avatar.setAirborne(true, 0);

  // main.js calls setMoving every frame; none of them may cut the beat short
  avatar.setMoving(true);
  avatar.setMoving(true);
  assert.equal(currentName(avatar), 'Land', 'the land beat was cut off by setMoving');

  // ...and it ends on the mixer's own `finished` event, not a timer
  avatar._onFinished({ action: avatar.actions.Land });
  assert.equal(currentName(avatar), ARMED_RUN, 'the run cycle must resume after the beat');
  assert.equal(avatar._landing, false);
});

test('a rig with no land clip goes straight back to locomotion', () => {
  const avatar = makeAvatar([ARMED_IDLE, ARMED_RUN, 'Jump']);

  avatar.setAirborne(false, 8.5);
  avatar.setAirborne(true, 0);

  assert.equal(avatar._landing, false, 'no land clip means no beat to wait for');
  assert.equal(currentName(avatar), ARMED_IDLE, 'it falls back to idle');

  // and the ground animation takes over again on the next frame
  avatar.setMoving(true);
  assert.equal(currentName(avatar), ARMED_RUN);
});

test('jumping again cancels an unfinished land beat', () => {
  const avatar = makeAvatar([ARMED_IDLE, ARMED_RUN, 'Jump', 'Land']);

  avatar.setAirborne(false, 8.5);
  avatar.setAirborne(true, 0);
  assert.equal(currentName(avatar), 'Land');

  avatar.setAirborne(false, 8.5);          // bounce straight back up
  assert.equal(currentName(avatar), 'Jump');
  assert.equal(avatar._landing, false, 'a stale land beat would win the next touchdown');
});

test('the airborne clip is chosen once, not every frame', () => {
  const avatar = makeAvatar([ARMED_IDLE, ARMED_RUN, 'Jump_Start', 'Fall']);

  for (let i = 0; i < 60; i++) avatar.setAirborne(false, 8.5);   // one second rising
  assert.equal(avatar.actions.Jump_Start.plays, 1,
    'replaying the clip every frame restarts it 60 times a second — it would never advance');

  avatar.setAirborne(false, -1);
  for (let i = 0; i < 60; i++) avatar.setAirborne(false, -1);
  assert.equal(avatar.actions.Fall.plays, 1);
});

test('grounded frames are harmless: no restart, no thrash', () => {
  const avatar = makeAvatar([ARMED_IDLE, ARMED_RUN, 'Jump', 'Land']);

  avatar.setMoving(true);
  const plays = avatar.actions[ARMED_RUN].plays;
  for (let i = 0; i < 30; i++) avatar.setAirborne(true, 0);

  assert.equal(avatar.actions[ARMED_RUN].plays, plays, 'idle ground frames restarted the run cycle');
  assert.equal(currentName(avatar), ARMED_RUN);
  assert.equal(avatar._landing, false, 'a ground frame must not start a land beat');
});

test('the blends are short, and the air blend is shorter still', () => {
  const { ANIM } = config;
  assert.ok(ANIM.blend <= 0.1, `a ${ANIM.blend}s ground blend is slower than the physics`);
  assert.ok(ANIM.airBlend <= ANIM.blend, 'the air blend must not be the slower of the two');

  const avatar = makeAvatar([ARMED_IDLE, ARMED_RUN, 'Jump', 'Land']);
  avatar.setMoving(true);
  avatar.setAirborne(false, 8.5);

  assert.deepEqual(avatar.actions.Jump.fadesIn, [ANIM.airBlend],
    'the airborne pose faded in over the ground duration, so it lags the jump');
  assert.deepEqual(avatar.actions[ARMED_RUN].fadesOut, [ANIM.airBlend]);
});

test('an unarmed avatar falls back to its own idle clip', () => {
  const avatar = makeAvatar(['Idle', 'Run'], { armed: false });

  avatar.setMoving(true);
  avatar.setAirborne(false, 8.5);

  assert.equal(currentName(avatar), 'Idle');
});

test('a death clip finishing does not end a land beat', () => {
  const avatar = makeAvatar([ARMED_IDLE, ARMED_RUN, 'Jump', 'Land', 'Death']);

  avatar.setAirborne(false, 8.5);
  avatar.setAirborne(true, 0);
  avatar._onFinished({ action: avatar.actions.Death });

  assert.equal(currentName(avatar), 'Land', 'the corpse animation must not drive the body');
  assert.equal(avatar._landing, true);
});

/**
 * The shipped rig (#121 + #82 together).
 *
 * The tests above use made-up rigs to pin the rules. These use the names that
 * actually ship, because the whole point of #82 was to stop the player running
 * through the air, and a rule that selects nothing is the same bug.
 */

const JUMP_START = 'Jump_Start';
const JUMP_LOOP = 'Jump_Loop';
const JUMP_LAND = 'Jump_Land';

/** The armed player exactly as it is in the game: five model clips plus #121's. */
function makeShippedAvatar() {
  return makeAvatar([ARMED_IDLE, ARMED_RUN, 'Death', JUMP_START, JUMP_LOOP, JUMP_LAND]);
}

test('the airborne states name the clips #121 actually ships', () => {
  const shipped = Object.values(avatarModule.LIBRARY_CLIPS ?? {}).sort();
  assert.deepEqual(shipped, [JUMP_LAND, JUMP_LOOP, JUMP_START].sort(),
    'the clip names in this file have drifted from the library table in avatar.js');
});

test('on the shipped rig a jump uses the library start clip', () => {
  const avatar = makeShippedAvatar();

  avatar.setMoving(true);
  avatar.setAirborne(false, 8.5);

  assert.equal(currentName(avatar), JUMP_START, 'the player still ran through the air');
});

test('on the shipped rig falling holds the library loop, not the run cycle', () => {
  // The pack has no fall clip (#121), so the airborne loop is what holds the
  // body on the way down. Without it there is no candidate at all for `fall`,
  // and the rig drops to idle for the whole descent.
  const avatar = makeShippedAvatar();

  avatar.setMoving(true);
  avatar.setAirborne(false, 8.5);
  avatar.setAirborne(false, -6);

  assert.equal(currentName(avatar), JUMP_LOOP);
  assert.notEqual(currentName(avatar), ARMED_RUN);
});

test('on the shipped rig touchdown plays the library land clip once', () => {
  const avatar = makeShippedAvatar();

  avatar.setAirborne(false, 8.5);
  avatar.setAirborne(true, 0);

  assert.equal(currentName(avatar), JUMP_LAND);
  assert.equal(avatar.actions[JUMP_LAND].loop, THREE.LoopOnce,
    'a looping land clip would freeze the player in a crouch');
  assert.equal(avatar._landing, true, 'the land beat must own the body until it finishes');
});
