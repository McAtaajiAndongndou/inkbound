// The Big Arm combo is taught (QA 30 Oct: "couldn't find the combo, not even a
// hint at it"). The Primer's R7 holds a harmless Big Arm that one combo knocks
// down, both levels hang a combo rack whose lamps follow the chain, and the
// sergeant says the combo when each Big Arm wakes and when the Siphon opens.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';

import { Level00 } from '../src/levels/level-00-the-primer.js';
import { Level03 } from '../src/levels/level-03-horde.js';
import { COMMS_LINES } from '../src/ui/comms-lines.js';
import { PAINT_IDS, ENEMY, PRIMER } from '../src/config.js';

async function loaded(Kind, game = {}) {
  const level = new Kind({ scene: new THREE.Scene(), ...game });
  await level.load();
  level.root.updateMatrixWorld(true);
  return level;
}
const hit = (boss, colour, n = 1) => { for (let i = 0; i < n; i++) boss.takeColourHit(PAINT_IDS[colour], 10); };

test('the Primer dummy: one combo knocks it down, and its rack lights step by step', async () => {
  const level = await loaded(Level00);
  const boss = level.comboDummy;
  const rack = level.comboRack;
  const at = (s) => level.update(s, { position: new THREE.Vector3(0, 8, -30) });
  at(0.016);
  assert.equal(rack.steps, 0);
  hit(boss, 'red', 3);
  hit(boss, 'green', 3);
  assert.ok(boss.alive, 'out of order does nothing');
  hit(boss, 'blue', 3);
  at(0.3);   // the freeze arms after BLUE_FREEZE.armDelay
  assert.equal(boss.combo, 'frozen');
  assert.equal(rack.steps, 1);
  hit(boss, 'green');
  at(0.016);
  assert.equal(rack.steps, 2);
  hit(boss, 'red');
  assert.equal(boss.alive, false, 'one combo is the whole drill');
  at(0.016);
  assert.equal(rack.steps, 0);
  level.dispose();
});

test('the Primer dummy is harmless and keeps its type, model and windows', async () => {
  const level = await loaded(Level00);
  const boss = level.comboDummy;
  assert.equal(boss.type, 'bigArm');
  assert.equal(boss.config.contactDamage, 0);
  assert.equal(boss.config.canMove, false);
  assert.equal(boss.config.attackRange, 0);
  assert.equal(boss.config.pinFor, ENEMY.bigArm.pinFor, 'the real boss timing, so the drill transfers');
  assert.equal(ENEMY.bigArm.hp, 3, 'the boss itself is untouched');
  assert.equal(PRIMER.comboDummy.hp, 1);
  level.dispose();
});

test("tuning a placement keeps the enemy's type (a tuned Drainer is not a Sprayer)", async () => {
  const level = await loaded(Level03);
  const tuned = level.roster.filter((r) => r.data.tune);
  assert.ok(tuned.length > 0);
  for (const { data, enemy } of tuned) assert.equal(enemy.type, data.type, data.id);
  level.dispose();
});

test('the sergeant says the combo when each Big Arm wakes, and the Siphon when it opens', async () => {
  for (const id of ['primer-combo', 'last-colour-big-arm', 'last-colour-siphon']) {
    assert.ok(COMMS_LINES[id]?.text, `no line written for ${id}`);
  }
  const said = [];
  const primer = await loaded(Level00, { say: (id) => { said.push(id); return true; } });
  primer.game = { say: (id) => { said.push(id); return true; } };
  for (const e of primer.enemies) e.update = () => {};
  primer.roster[0].enemy.alive = false;
  primer.update(0.016, { position: new THREE.Vector3(0, 8, -30) });
  primer.update(0.016, { position: new THREE.Vector3(0, 8, -30) });
  assert.ok(said.includes('primer-combo'));
  primer.dispose();

  const core = await loaded(Level03);
  core.game = { say: (id) => { said.push(id); return true; } };
  core.bigArm.wake();
  core.update(0.016, { position: new THREE.Vector3(0, 0, -20), velocity: new THREE.Vector3() });
  assert.ok(said.includes('last-colour-big-arm'));
  core.dispose();
});
