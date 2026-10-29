import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';

import { Enemy, MODEL_URLS } from '../src/enemies/enemy.js';
import { DANGER, ENEMY, PAINT, PAINT_IDS, TRAP } from '../src/config.js';

// #126 — danger language + readability.
//
// DECISIONS.md: "Amber is the only danger colour — enemy telegraphs, traps and
// incoming fire all use it, because it is not a paint colour." Two ways that
// decision had leaked, and one readability gap, are pinned here:
//
//   1. The telegraph kept its OWN amber (0xffe600, a local const) while TRAP
//      declared a different one (0xd98a2b). Two "the" danger colours is exactly
//      what the decision forbids. Now both read DANGER.amber from config.js.
//   2. The green pin lasts 1.5 s but the hit tint fades in 1.0 s, so a pinned
//      enemy stopped reading as pinned for its last half-second. Now the green
//      holds for the whole root.
//   3. Nothing VERIFIED that each enemy reads as its own silhouette. The live
//      types run four distinct GLBs plus one deliberate box (the immobile
//      turret); the test fails the day two moving enemies share a model.
//
// "Incoming projectiles" have no visual in the game today (ranged damage lands
// at the onAttack frame), so there is nothing to point at the amber yet — the
// constant is the designated colour for when one exists.

const FAR = new THREE.Vector3(0, 0, 100);
const DT = 1 / 60;

function make(type = 'charger') {
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

test('one danger colour, defined once, used by telegraph and traps', () => {
  assert.equal(TRAP.amber, DANGER.amber,
    'TRAP must not carry its own amber — one value, defined once in DANGER');

  const enemy = make('sprayer');
  assert.equal(enemy._telegraphColour.getHex(), DANGER.amber,
    'the attack telegraph must BE the danger amber, not a similar one');

  assert.ok(enemy.startTelegraph(), 'windup starts');
  assert.equal(enemy._telegraphColour.getHex(), DANGER.amber);
});

test('the danger amber is not any paint colour', () => {
  for (const [name, paint] of Object.entries(PAINT)) {
    assert.notEqual(DANGER.amber, paint.hex,
      `danger amber must never collide with paint '${name}' — nothing dangerous may share a colour with something helpful`);
  }
});

test('every moving enemy has its own silhouette', () => {
  const live = Object.keys(ENEMY);

  // M14 model gap: the Stalker (#120) shipped behaviour-first — today it is a
  // moving box, and a moving box reads as every other box at 20 m. Listed here
  // rather than exempted invisibly: the entry is asserted still model-less, so
  // the day M14 gives the Stalker a body, THIS TEST FAILS until the entry is
  // pruned and the Stalker joins the silhouette rule like everyone else.
  const PENDING_MODEL = new Set(['stalker']);
  for (const type of PENDING_MODEL) {
    assert.ok(ENEMY[type], `${type} is not an ENEMY type — prune it from PENDING_MODEL`);
    assert.ok(!MODEL_URLS[type],
      `${type} now HAS a model — remove it from PENDING_MODEL so the silhouette rule applies`);
  }

  const modelled = live.filter((type) => ENEMY[type].canMove && !PENDING_MODEL.has(type));
  for (const type of modelled) {
    assert.ok(MODEL_URLS[type],
      `${type} moves but has no model — a moving box reads as every other box at 20 m`);
  }

  const urls = modelled.map((type) => MODEL_URLS[type]);
  assert.equal(new Set(urls).size, urls.length,
    'two moving enemies share one GLB — silhouettes must differ, not just behaviour');

  // The turret is the one deliberate box: it cannot move, so a distinct pose
  // (a stationary, ground-hugging chunk) is available for free. Anything that
  // hunts on legs needs a real shape — or a PENDING_MODEL entry above.
  for (const type of live) {
    if (!MODEL_URLS[type] && !PENDING_MODEL.has(type)) {
      assert.equal(ENEMY[type].canMove, false,
        `${type} has no model but can move — that is an unreadable enemy`);
    }
  }
});

test('a pinned enemy reads as pinned for the whole pin', () => {
  const enemy = make('charger');
  enemy.takeColourHit(PAINT_IDS.green, 10);

  // 1.2 s in: past the 1.0 s hit flash, inside the 1.5 s root. Pre-#126 the
  // tint was already gone here and the enemy looked free.
  tick(enemy, 1.2);
  assert.ok(enemy._pinnedTimer > 0, 'still rooted at 1.2 s');
  assert.ok(enemy._tintTimer > 0,
    'the green must outlive the hit flash — a pin that stops reading is a free enemy');
  assert.equal(enemy._tintTarget.getHex(), PAINT.green.hex);

  // ...and the green releases when the root ends, so the hold is not a stuck
  // tint. By ~2.1 s the pin (1.5 s) and the held half-strength tint (0.5 s
  // past it) have both run out.
  tick(enemy, 0.9);
  // The fade can overshoot 0 by one dt before the early-return freezes it —
  // what matters is the hold is gone, not the exact residue.
  assert.ok(enemy._tintTimer <= 0, 'tint releases after the pin');
});

test('frozen and pinned read as two different states', () => {
  const frozen = make('charger');
  for (let i = 0; i < 3; i++) frozen.takeColourHit(PAINT_IDS.blue, 10);
  tick(frozen, 0.1);

  const pinned = make('charger');
  pinned.takeColourHit(PAINT_IDS.green, 10);
  tick(pinned, 0.1);

  assert.equal(frozen._frostShell.visible, true,
    'frozen wears the ice shell');
  assert.equal(pinned._frostShell.visible, false,
    'pinned does not — green root, not ice');
  assert.equal(pinned._tintTarget.getHex(), PAINT.green.hex);
  assert.ok(pinned._tintTimer > 0, 'pinned carries the green tint, not just the timer');
});
