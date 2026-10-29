import test from 'node:test';
import assert from 'node:assert/strict';

const { TerritoryTrend, TERRITORY } = await import('../src/ui/hud.js');

test('the readout shows whole percents of the level painted (#127)', () => {
  const t = new TerritoryTrend();
  assert.equal(t.sample(0.344), 34);
  assert.equal(t.sample(1.2), 100, 'clamped');
});

test('losing a visible point starts the falling look, and it holds', () => {
  const t = new TerritoryTrend();
  t.sample(0.40);
  t.sample(0.38);
  assert.equal(t.falling, true);
  t.update(TERRITORY.fallHold - 0.1);
  assert.equal(t.falling, true, 'still showing — long enough to catch peripherally');
  t.update(0.2);
  assert.equal(t.falling, false);
});

test('a steady drain keeps it falling; painting back clears it', () => {
  const t = new TerritoryTrend();
  t.sample(0.50);
  for (let pct = 0.49; pct > 0.44; pct -= 0.01) {
    t.update(TERRITORY.interval);
    t.sample(pct);
    assert.equal(t.falling, true);
  }
  t.sample(0.47);
  assert.equal(t.falling, false);
});

test('noise under a whole point is not a fall', () => {
  const t = new TerritoryTrend();
  t.sample(0.402);
  t.sample(0.398);
  assert.equal(t.falling, false);
});

test('a new level starts fresh rather than reading as a loss', () => {
  const t = new TerritoryTrend();
  t.sample(0.6);
  t.reset();
  t.sample(0);
  assert.equal(t.falling, false);
});

test('the grid scan is a few times a second, not every frame', () => {
  assert.ok(TERRITORY.interval >= 0.2);
});
