import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';

const { IntroTimeline, ease, cardLines } = await import('../src/ui/mission-intro.js');
const { INTROS } = await import('../src/ui/intro-lines.js');
const { MISSION_INTRO, DANGER } = await import('../src/config.js');
const { LEVELS, createLevel } = await import('../src/levels/index.js');
const { CameraRig } = await import('../src/core/camera-rig.js');
const { Player } = await import('../src/core/player.js');

const CARD = { name: 'Outskirts', location: 'The drained forest', when: 'Day 3 · 06:10', objective: 'Cross the islands.' };

/** Step the timeline `seconds` forward in 50 ms frames. */
function run(t, seconds) {
  for (let s = 0; s < seconds - 1e-9; s += 0.05) t.update(0.05);
}

test('the camera eases from the goal to the player over moveTime, then the card fades (G4)', () => {
  const t = new IntroTimeline(CARD);
  assert.equal(t.progress, 0);
  run(t, MISSION_INTRO.moveTime / 2);
  assert.ok(Math.abs(t.progress - 0.5) < 0.05, 'halfway in time is halfway in space');
  run(t, MISSION_INTRO.moveTime / 2 + 0.05);
  assert.equal(t.phase, 'leaving');
  assert.equal(t.progress, 1, 'camera is home before control lands');
  run(t, MISSION_INTRO.fadeOut + 0.05);
  assert.equal(t.phase, 'done');
});

test('never longer than the cap from load to control', () => {
  assert.ok(MISSION_INTRO.moveTime + MISSION_INTRO.fadeOut <= MISSION_INTRO.cap);
});

test('the ease neither lurches off nor slams in', () => {
  assert.equal(ease(0), 0);
  assert.equal(ease(1), 1);
  assert.ok(ease(0.05) < 0.05 && ease(0.95) > 0.95, 'slow at both ends');
});

test('the card types out one line after another', () => {
  const t = new IntroTimeline(CARD);
  t.update(0.05);
  const early = t.typed();
  assert.ok(early[0].length > 0 && early[0].length < CARD.name.length, 'the name is typing');
  assert.deepEqual(early.slice(1), ['', '', ''], 'the rest have not started');
  assert.equal(t.linesStarted, 1);
  run(t, 3);
  assert.deepEqual(t.typed(), cardLines(CARD), 'all four lines are in before the camera lands');
  assert.equal(t.linesStarted, 4);
});

test('skip sends the camera home and fades the card at once', () => {
  const t = new IntroTimeline(CARD);
  run(t, 1);
  t.skip();
  assert.equal(t.phase, 'leaving');
  assert.equal(t.progress, 1);
  assert.deepEqual(t.typed(), cardLines(CARD), 'the card is whole while it fades');
});

test('every level has a title card, and only the Primer has no camera move', () => {
  for (const { id } of LEVELS) {
    const intro = INTROS[id];
    assert.ok(intro, `${id} has an intro`);
    for (const line of cardLines(intro.card)) assert.ok(line && line.length <= 40, `${id}: "${line}" is one short line`);
    assert.equal(intro.from === null, id === 'primer', `${id} camera move`);
  }
});

test('the card is never the danger colour', async () => {
  const { readFileSync } = await import('node:fs');
  const css = readFileSync('src/ui/style.css', 'utf8');
  const block = css.slice(css.indexOf('/* Mission intro'));
  const amber = `#${DANGER.amber.toString(16).padStart(6, '0')}`;
  assert.ok(!block.toLowerCase().includes(amber), 'no amber');
  assert.ok(!block.toLowerCase().includes('#ffe600'), 'no telegraph yellow');
});

// The camera path. Built in Node: the level, a real player at its spawn and the
// real camera rig behind them give the END of the move — the play camera — and
// the start shot is the intro's. The straight line between them must not pass
// through anything solid, or the camera clips a wall on its way home.
const solidMeshes = (level) => {
  const skip = new Set([level.atmosphere, level.waste].filter(Boolean));
  const out = [];
  level.root.traverse((o) => {
    if (skip.has(o)) return;
    if (!o.isMesh || !o.material) return;
    for (let p = o; p; p = p.parent) if (!p.visible || skip.has(p)) return;
    if (o.material.transparent && o.material.opacity < 1) return; // a gate field: see-through
    out.push(o);
  });
  return out;
};

for (const { id } of LEVELS) {
  if (!INTROS[id]?.from) continue;
  test(`${id}: the intro camera reaches the player without passing through a wall`, async () => {
    const level = createLevel(id, { scene: new THREE.Scene(), onWin: null });
    await level.load();
    level.root.updateMatrixWorld(true);
    const player = new Player(level.surfaces, level.spawn);
    const rig = new CameraRig(16 / 9);
    rig.update(player, 0);

    const { pos, target } = INTROS[id].from;
    const start = new THREE.Vector3(...pos);
    const end = rig.camera.position.clone();
    const span = start.distanceTo(end);
    // The last 1.5 m is the play camera's own spot, not the intro's path: the
    // rig has no camera collision, so if it starts behind a wall (Last Colour's
    // landing, z 90), it does so with or without an intro.
    const ray = new THREE.Raycaster(start, end.clone().sub(start).normalize(), 0, span - 1.5);
    const hit = ray.intersectObjects(solidMeshes(level), false)[0];
    // A string, not the hit: printing a hit object prints the whole level.
    const what = hit ? `${hit.object.name || hit.object.type} at ${hit.point.toArray().map((n) => n.toFixed(1))}` : 'nothing';
    assert.equal(what, 'nothing', 'the camera path hits a solid');

    // Faces the way the player faces, so the move is a pull-back, not a turn.
    const intoShot = new THREE.Vector3(...target).sub(start).setY(0).normalize();
    const playLook = rig.camera.getWorldDirection(new THREE.Vector3()).setY(0).normalize();
    assert.ok(intoShot.dot(playLook) > 0.7, 'the start shot faces the play camera\'s way');
    level.dispose();
  });
}
