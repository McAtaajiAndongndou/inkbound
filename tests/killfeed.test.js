import test from 'node:test';
import assert from 'node:assert/strict';

const { KillFeed, KILLFEED, killText } = await import('../src/ui/hud.js');
const { Enemy } = await import('../src/enemies/enemy.js');
const { ENEMY, PAINT_IDS } = await import('../src/config.js');
const THREE = await import('three');

const make = (config) => new Enemy({
  position: new THREE.Vector3(0, 0, 0),
  config,
  parent: new THREE.Group(),
  floors: [],
});

test('a kill reads as the enemy and what the colour did (#129)', () => {
  assert.equal(killText({ name: 'SPRAYER', verb: 'FLUNG', count: 1 }), 'SPRAYER — FLUNG');
});

test('repeated kills coalesce into one counted line', () => {
  const feed = new KillFeed();
  for (let i = 0; i < 8; i++) feed.push('DRAINER', 'SLICKED', 'blue');
  assert.equal(feed.lines.length, 1);
  assert.equal(killText(feed.lines[0]), 'DRAINER — SLICKED ×8');
});

test('at most three lines, newest first; the oldest is dropped', () => {
  const feed = new KillFeed();
  feed.push('SPRAYER', 'FLUNG', 'red');
  feed.push('CHARGER', 'PINNED', 'green');
  feed.push('DRAINER', 'SLICKED', 'blue');
  feed.push('TURRET', 'PAINTED OUT', 'red');
  assert.equal(feed.lines.length, KILLFEED.maxLines);
  assert.deepEqual(feed.lines.map((l) => l.name), ['TURRET', 'DRAINER', 'CHARGER']);
});

test('lines fade out on their own; a repeat kill keeps its line up', () => {
  const feed = new KillFeed();
  feed.push('DRAINER', 'SLICKED', 'blue');
  feed.update(KILLFEED.life - 0.5);
  feed.push('DRAINER', 'SLICKED', 'blue');
  feed.update(1);
  assert.equal(feed.lines.length, 1, 'the second kill restarted its life');
  feed.update(KILLFEED.life);
  assert.equal(feed.lines.length, 0);
});

// --- the event payload, from the enemy itself -------------------------------

function kill(config, colourId, { frozen = false } = {}) {
  const enemy = make(config);
  let cause = null;
  enemy.onDeath = (e, c) => { cause = { ...c }; };
  enemy.hp = 1;
  if (frozen) enemy._frozenTimer = 0.01; // armed: past the arm delay, inside the window
  enemy.takeColourHit(colourId, 10, null);
  return cause;
}

test('onDeath says which colour killed the enemy and what it did', () => {
  assert.deepEqual(kill(ENEMY.sprayer, PAINT_IDS.red), { colour: 'red', effect: 'knockback' });
  assert.deepEqual(kill(ENEMY.charger, PAINT_IDS.green), { colour: 'green', effect: 'pin' });
  assert.deepEqual(kill(ENEMY.drainer, PAINT_IDS.blue), { colour: 'blue', effect: 'slip' });
  assert.deepEqual(kill(ENEMY.sprayer, PAINT_IDS.blue, { frozen: true }), { colour: 'blue', effect: 'shatter' });
});

test('a turret takes no procs, so it is never claimed as flung', () => {
  assert.deepEqual(kill(ENEMY.turret, PAINT_IDS.red), { colour: 'red', effect: 'paint' });
});

test('a colourless kill while red is still throwing the enemy credits red', () => {
  const enemy = make(ENEMY.charger);
  const causes = [];
  enemy.onDeath = (e, c) => causes.push({ ...c });
  enemy.takeColourHit(PAINT_IDS.red, 1, null);   // knocked back, survives
  enemy.takeDamage(10_000);                       // into the pit
  assert.deepEqual(causes, [{ colour: 'red', effect: 'knockback' }]);

  const other = make(ENEMY.charger);
  other.onDeath = (e, c) => causes.push({ ...c });
  other.takeDamage(10_000);
  assert.deepEqual(causes[1], { colour: null, effect: 'trap' });
});
