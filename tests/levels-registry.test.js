import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';

import { LEVELS, DEFAULT_LEVEL_ID, createLevel, levelEntry } from '../src/levels/index.js';
import { LevelBase } from '../src/levels/level-base.js';

function makeGame() {
  return { scene: new THREE.Scene(), onWin: null };
}

test('the four levels are listed under the names the design fixed', () => {
  assert.deepEqual(
    LEVELS.map((l) => l.name),
    ['The Primer', 'Outskirts', 'The Ascent', 'Last Colour'],
  );
  assert.equal(new Set(LEVELS.map((l) => l.id)).size, LEVELS.length, 'ids must be unique');
  assert.ok(LEVELS.some((l) => l.id === DEFAULT_LEVEL_ID), 'the default must be a real entry');
});

test('every registered level loads as a playable package, stubs included', async () => {
  for (const entry of LEVELS) {
    const game = makeGame();
    const level = entry.create(game);

    assert.ok(level instanceof LevelBase, `${entry.id} must extend LevelBase`);
    await level.load();

    assert.ok(level.spawn instanceof THREE.Vector3, `${entry.id} needs a spawn`);
    assert.ok(level.surfaces.length > 0, `${entry.id} needs ground to stand on`);
    assert.ok(
      level.surfaces.every((s) => typeof s.isFloor === 'boolean'),
      `${entry.id}: every surface must set isFloor or the player falls through it`,
    );
    assert.ok(level.extraction instanceof THREE.Box3, `${entry.id} needs a win volume`);
    assert.ok(Array.isArray(level.enemies), `${entry.id} needs an enemies array`);

    level.dispose();
  }
});

test('a level can be built by id, and it is the class the registry promised', () => {
  const level = createLevel('ascent', makeGame());
  assert.ok(level instanceof LevelBase);
  assert.equal(level.constructor.name, 'Level02');
});

test('an unknown id falls back to the default rather than leaving a dead page', () => {
  const original = console.warn;
  let warned = false;
  console.warn = () => { warned = true; };

  try {
    assert.equal(levelEntry('not-a-level').id, DEFAULT_LEVEL_ID);
  } finally {
    console.warn = original;
  }

  assert.ok(warned, 'the fallback must say so; silence makes a typo unfindable');
});

test('a stub level can be completed, so selecting it proves the whole path', async () => {
  const game = makeGame();
  let wins = 0;
  game.onWin = () => { wins += 1; };

  const level = createLevel('last-colour', game);
  await level.load();

  const player = { position: level.extraction.getCenter(new THREE.Vector3()) };
  level.update(1 / 60, player);
  level.update(1 / 60, player);

  assert.equal(wins, 1, 'win must fire exactly once');
  level.dispose();
});
