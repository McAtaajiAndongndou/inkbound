// Quality plan §4.2 (Phase 2): the Charger "just kind of jumps towards me".
// Its soldier body had no charge or melee clip, so every level now spawns it in
// the zombie charger's body (Run, Run_Attack). The stats stay the Charger's.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';

import { ENEMY } from '../src/config.js';
import { MODEL_URLS } from '../src/enemies/enemy.js';

test('the Charger config names the zombie charger body, which exists', () => {
  assert.equal(ENEMY.charger.model, 'chargerZombie');
  assert.ok(MODEL_URLS[ENEMY.charger.model], 'no GLB for that key');
});

test('every level spawns its Chargers in the zombie body, with the Charger\'s stats', async () => {
  const { createLevel, LEVELS } = await import('../src/levels/index.js');
  let seen = 0;
  for (const { id } of LEVELS) {
    const level = createLevel(id, { scene: new THREE.Scene(), onWin: null, say: () => true });
    await level.load();
    for (const e of level.enemies.filter((x) => x.config === ENEMY.charger)) {
      assert.equal(e.type, 'chargerZombie', `${id}: a Charger in the old soldier body`);
      assert.equal(e.hp, ENEMY.charger.hp, `${id}: the body swap changed its health`);
      seen++;
    }
    level.dispose();
  }
  assert.ok(seen > 0, 'no level spawns a Charger');
});

test('other enemies keep their own bodies', async () => {
  const { createLevel } = await import('../src/levels/index.js');
  const level = createLevel('outskirts', { scene: new THREE.Scene(), onWin: null, say: () => true });
  await level.load();
  const sprayer = level.enemies.find((e) => e.config === ENEMY.sprayer);
  assert.ok(sprayer);
  assert.equal(sprayer.type, 'sprayer');
  level.dispose();
});
