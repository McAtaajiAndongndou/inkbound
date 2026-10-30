// #217: the sergeant warns before the Primer's spike pit, and "One of theirs"
// still follows past it. Run against the REAL comms timeline (one line at a
// time), so a busy bar is part of the test: the level re-asks a refused line
// until the bar takes it.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';

import { Level00 } from '../src/levels/level-00-the-primer.js';
import { PRIMER as L } from '../src/levels/layouts/primer.js';
import { CommsTimeline, COMMS } from '../src/ui/comms.js';
import { COMMS_LINES } from '../src/ui/comms-lines.js';
import { PLAYER, SURFACE } from '../src/config.js';

const [, , , , , PIT_NEAR] = L.traps.find((t) => t.id === 'r6-spike-pit').box;

/** Walk from R6's entry into R7 at `speed`; record when each line was up, and the Charger's wake. */
async function walk(speed) {
  const bar = new CommsTimeline(COMMS_LINES);
  const who = { position: new THREE.Vector3(0, 8, 3), health: 100 };
  const level = new Level00({ scene: new THREE.Scene(), onWin: null, say: (id) => bar.request(id) });
  await level.load();
  const charger = level.enemies[0];
  const shown = {};   // id → { from, to, z }
  let clock = 0;
  let wokeAt = null;
  const dt = 1 / 60;
  while (clock < 25) {
    if (who.position.z > -30) who.position.z -= speed * dt;
    level.update(dt, who);
    bar.update(dt, !charger.sleeping);
    clock += dt;
    if (!charger.sleeping && wokeAt === null) wokeAt = clock;
    const id = bar.phase === 'showing' && Object.keys(COMMS_LINES).find((k) => COMMS_LINES[k] === bar.line);
    if (id) {
      shown[id] ??= { from: clock, z: who.position.z };
      shown[id].to = clock;
    }
  }
  level.dispose();
  return { shown, wokeAt };
}

test('#217: the trap warning is up before the player reaches the pit', async () => {
  const { shown } = await walk(PLAYER.maxSpeed);
  assert.ok(shown['primer-trap'], 'the warning never showed');
  assert.ok(shown['primer-trap'].z > PIT_NEAR, `it showed at z=${shown['primer-trap'].z.toFixed(1)}, already at the pit (near edge ${PIT_NEAR})`);
});

for (const [pace, speed] of [['a walk', PLAYER.maxSpeed], ['a blue sprint', PLAYER.maxSpeed * SURFACE.blue.speedScale]]) {
  test(`#217: at ${pace}, both lines are read — the warning, then "One of theirs" before the fight`, async () => {
    const { shown, wokeAt } = await walk(speed);
    assert.ok(shown['primer-trap'] && shown['primer-theirs'], `shown: ${Object.keys(shown).join(', ') || 'nothing'}`);
    assert.ok(shown['primer-trap'].from < shown['primer-theirs'].from, 'the warning comes first');
    const read = (shown['primer-theirs'].to - shown['primer-theirs'].from);
    assert.ok(read >= COMMS.holdMin - 0.05, `"One of theirs" was up ${read.toFixed(2)} s (woke at ${wokeAt?.toFixed(2)})`);
  });
}
