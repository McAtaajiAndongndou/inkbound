// Quality plan B5: "One of theirs" fired while the player was at the spike pit.
// It was asked on entering R6, and R6 is the trap room. Now it waits until the
// player is past the pit, and the Charger's wake waits long enough for it to be read.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';

import { Level00 } from '../src/levels/level-00-the-primer.js';
import { PRIMER as L } from '../src/levels/layouts/primer.js';
import { COMMS } from '../src/ui/comms.js';
import { PLAYER, SURFACE } from '../src/config.js';

const [, , , , PIT_Z0, PIT_Z1] = L.traps.find((t) => t.id === 'r6-spike-pit').box;

/** Walk R6 into R7 at `speed` m/s, 60 Hz; report when the line was asked and the Charger woke. */
async function run(speed) {
  const asked = [];
  let clock = 0;
  const level = new Level00({ scene: new THREE.Scene(), onWin: null, say: (id) => asked.push({ id, at: clock, z: who.position.z }) });
  const who = { position: new THREE.Vector3(0, 8, 3), health: 100 };
  await level.load();
  const charger = level.enemies[0];
  let wokeAt = null;
  const dt = 1 / 60;
  while (clock < 20 && wokeAt === null) {
    if (who.position.z > -30) who.position.z -= speed * dt;   // stop short of the Charger
    level.update(dt, who);
    clock += dt;
    if (!charger.sleeping && wokeAt === null) wokeAt = clock;
  }
  level.dispose();
  return { line: asked.find((a) => a.id === 'primer-theirs'), wokeAt };
}

test('B5: "One of theirs" is not asked at the trap, only once you are past it', async () => {
  const { line } = await run(PLAYER.maxSpeed);
  assert.ok(line, 'the line was never asked');
  assert.ok(line.z < PIT_Z0, `asked at z=${line.z.toFixed(1)}, which is not past the pit (${PIT_Z1}..${PIT_Z0})`);
});

test('B5: even at a blue sprint, the line is up for its readable minimum before the Charger wakes', async () => {
  const sprint = PLAYER.maxSpeed * SURFACE.blue.speedScale;
  const { line, wokeAt } = await run(sprint);
  assert.ok(wokeAt !== null, 'the Charger never woke');
  assert.ok(wokeAt - line.at >= COMMS.holdMin, `only ${(wokeAt - line.at).toFixed(2)} s between the line and the wake`);
});
