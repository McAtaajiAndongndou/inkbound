import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';

const { Campaign, nextLevelId, furthest } = await import('../src/ui/campaign.js');
const { winHint } = await import('../src/ui/hud.js');
const { LEVELS, DEFAULT_LEVEL_ID } = await import('../src/levels/index.js');
const { COMMS_LINES } = await import('../src/ui/comms-lines.js');
const { BRIEFING_IMAGE } = await import('../src/ui/briefing.js');
const { INTROS } = await import('../src/ui/intro-lines.js');

/** A Storage stand-in; `broken` throws like a blocked localStorage. */
function fakeStorage({ broken = false } = {}) {
  const data = new Map();
  return {
    data,
    getItem: (k) => { if (broken) throw new Error('blocked'); return data.get(k) ?? null; },
    setItem: (k, v) => { if (broken) throw new Error('blocked'); data.set(k, v); },
  };
}

test('a new player starts in the tutorial', () => {
  assert.equal(DEFAULT_LEVEL_ID, 'primer');
});

test('the campaign runs in the level list\'s order and ends after Last Colour', () => {
  assert.deepEqual(LEVELS.map((l) => nextLevelId(LEVELS, l.id)), ['outskirts', 'ascent', 'last-colour', null]);
  assert.equal(nextLevelId(LEVELS, 'no-such-level'), null);
  const c = new Campaign(LEVELS, null);
  assert.equal(c.isFinale('last-colour'), true);
  assert.equal(c.isFinale('ascent'), false);
});

test('a win moves progress to the next mission, and replaying never moves it back', () => {
  const storage = fakeStorage();
  const c = new Campaign(LEVELS, storage);
  assert.equal(c.reached, null, 'nothing saved yet: no Continue');
  c.recordWin('primer', 60);
  assert.equal(c.reached, 'outskirts');
  c.recordWin('outskirts', 120);
  c.recordWin('primer', 50);
  assert.equal(c.reached, 'ascent', 'replaying the Primer does not undo reaching the Ascent');
  assert.equal(new Campaign(LEVELS, storage).reached, 'ascent', 'kept for the next visit');
  assert.equal(furthest(LEVELS, 'ascent', 'primer'), 'ascent');
});

test('the finale\'s win keeps progress on the finale', () => {
  const c = new Campaign(LEVELS, fakeStorage());
  c.recordWin('last-colour', 300);
  assert.equal(c.reached, 'last-colour');
});

test('blocked storage: no Continue, and the campaign still works', () => {
  const c = new Campaign(LEVELS, fakeStorage({ broken: true }));
  assert.equal(c.reached, null);
  c.recordWin('primer', 60);
  assert.equal(c.reached, 'outskirts', 'progress still moves for this session');
});

test('a saved id that is no longer a level is ignored', () => {
  const storage = fakeStorage();
  storage.data.set('inkbound.progress', JSON.stringify({ reached: 'deleted-level' }));
  assert.equal(new Campaign(LEVELS, storage).reached, null);
});

test('the campaign-complete totals add up each mission\'s latest win', () => {
  const c = new Campaign(LEVELS, null);
  c.recordWin('primer', 60);
  c.recordWin('outskirts', 200);
  c.recordWin('outskirts', 150);
  assert.deepEqual(c.totals(), { cleared: 2, of: 4, time: 210 });
});

test('the win screen offers the next mission on Enter, and credits after the finale', () => {
  assert.match(winHint({ next: 'The Ascent' }), /<b>Enter<\/b> next: The Ascent/);
  assert.match(winHint({ next: 'The Ascent' }), /restart level/);
  assert.match(winHint({ finale: true }), /<b>Enter<\/b> credits/);
  assert.doesNotMatch(winHint({}), /Enter/, 'no next, no finale: no Enter');
  assert.doesNotMatch(winHint({ next: '<img>' }), /<img>/, 'level names are escaped');
});

test('the briefing never asks for art that is not there (no 404 on load)', async () => {
  const { existsSync } = await import('node:fs');
  if (BRIEFING_IMAGE) assert.ok(existsSync(`public/${BRIEFING_IMAGE.replace(/^\.\//, '')}`), `${BRIEFING_IMAGE} is missing`);
});

test('every sergeant line has text', () => {
  for (const [id, line] of Object.entries(COMMS_LINES)) assert.ok(line.text, `${id} is unwritten`);
});

test('the Primer asks its three lines once each, room by room, R7\'s before R7', async () => {
  const { Level00 } = await import('../src/levels/level-00-the-primer.js');
  const said = [];
  const level = new Level00({ scene: new THREE.Scene(), onWin: null, say: (id) => said.push(id) });
  await level.load();
  const at = (x, y, z) => ({ position: new THREE.Vector3(x, y, z), health: 100 });
  const walk = [at(0, 0, 80), at(0, 0, 65), at(0, 0, 65), at(0, 8, 2), at(0, 8, -86)];
  for (const p of walk) level.update(1 / 60, p);
  assert.deepEqual(said, ['primer-splat', 'primer-theirs', 'primer-ready']);
  for (const id of said) assert.ok(COMMS_LINES[id]?.text, `${id} has text`);
  assert.equal(level.inRoom('R7', walk[3].position), false, 'the warning comes a room before R7 wakes its Charger');
  level.dispose();
});

test('each intro\'s objective marker is on screen in its opening shot', () => {
  const cam = new THREE.PerspectiveCamera(70, 16 / 9, 0.1, 400);
  for (const [id, intro] of Object.entries(INTROS)) {
    if (!intro.from) continue;
    assert.ok(intro.goal?.label, `${id} names its goal`);
    cam.position.fromArray(intro.from.pos);
    cam.lookAt(new THREE.Vector3(...intro.from.target));
    cam.updateMatrixWorld();
    const p = new THREE.Vector3(...intro.goal.point).project(cam);
    assert.ok(p.z < 1 && Math.abs(p.x) < 0.9 && Math.abs(p.y) < 0.9, `${id}: ${intro.goal.label} is in the opening frame`);
  }
});

test('Outskirts\' goal has a beacon, behind the ledge and out of every walk', async () => {
  const { Level01 } = await import('../src/levels/level-01-mission.js');
  const level = new Level01({ scene: new THREE.Scene(), onWin: null });
  await level.load();
  const beacon = level.root.getObjectByName('extraction-beacon');
  const mast = level.root.getObjectByName('extraction-mast');
  assert.ok(beacon && mast);
  assert.ok(!level.surfaces.some((s) => s.mesh === mast || s.mesh === beacon), 'no collider');
  assert.ok(mast.position.z < level.extraction.min.z, 'behind the extraction, not in it');
  level.dispose();
});
