// The Core's waves come AT you (QA 30 Oct: "they just stay in the corners").
// Before this, wave two's Drainers fed in their bays (an 8 m hunt radius, bays
// ~30 m out), wave three waited on them, and Big Arm waited on wave three — so
// the fight stalled until you walked into the corners. A Charger that overshot
// past the sight radius stalled it the same way.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';

import { Level03 } from '../src/levels/level-03-horde.js';
import { LAST_COLOUR as L } from '../src/levels/layouts/last-colour.js';
import { LAST_COLOUR, ENEMY } from '../src/config.js';

async function loaded() {
  const level = new Level03({ scene: new THREE.Scene() });
  await level.load();
  level.root.updateMatrixWorld(true);
  return level;
}

test('every enemy type is in the Core', () => {
  const core = new Set(L.enemies.filter((e) => e.room === 'R3').map((e) => e.type));
  for (const type of ['drainer', 'charger', 'stalker', 'sprayer', 'wallCrawler', 'turret', 'bigArm']) {
    assert.ok(core.has(type), `the Core has no ${type}`);
  }
});

test("the Core's Drainers hunt across the room; the type's own numbers are untouched", async () => {
  const level = await loaded();
  const drainers = level.roster.filter((r) => r.data.room === 'R3' && r.data.type === 'drainer');
  assert.ok(drainers.length > 0);
  for (const { data, enemy } of drainers) {
    assert.equal(enemy.config.huntRadius, LAST_COLOUR.waveDrainer.huntRadius, data.id);
  }
  const hangar = level.roster.find((r) => r.data.room === 'R1' && r.data.type === 'drainer');
  assert.equal(hangar.enemy.config.huntRadius, ENEMY.drainer.huntRadius, 'the hangar keeps the Drainer as designed');
  assert.equal(ENEMY.drainer.huntRadius, 8, 'tuning one placement must not edit the type');
  level.dispose();
});

test('standing in the middle of the Core, each wave comes to you and Big Arm wakes', async () => {
  const level = await loaded();
  const player = { position: new THREE.Vector3(0, 0, -20), velocity: new THREE.Vector3() };
  const core = level.roster.filter((r) => r.data.room === 'R3' && r.data.type !== 'bigArm' && r.data.wake !== 'summon');
  const dt = 1 / 30;
  // A player who never moves and never aims: anything that reaches 6 m dies,
  // turrets (which never move) die once awake. Everything else must walk in.
  for (let t = 0; t < 150 && level.bigArm.sleeping; t += dt) {
    level.update(dt, player);
    for (const { data, enemy } of core) {
      if (!enemy.alive || enemy.sleeping) continue;
      if (data.type === 'turret' || enemy.position.distanceTo(player.position) < 6) enemy.takeDamage(999);
    }
  }
  const stuck = core.filter((r) => r.enemy.alive).map((r) => r.data.id);
  assert.deepEqual(stuck, [], 'these never came to the player');
  assert.equal(level.bigArm.sleeping, false, 'Big Arm never woke');
  level.dispose();
});
