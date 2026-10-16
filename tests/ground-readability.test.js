import test from 'node:test';
import assert from 'node:assert/strict';

import { PAINT, PAINT_GRID } from '../src/config.js';
import { PaintSurface } from '../src/paint/paint-surface.js';
import { DECOR } from '../src/levels/decor.js';

/**
 * The visible grid and the paint grid are two different things, and conflating
 * them is what made L1's floor look like graph paper.
 *
 * Paint needs a fine grid to splat into. The READABLE grid is a hint for the
 * player, and at 4 cells per world unit a line every 25cm is 64 lines across a
 * 16m corridor. This pins the decoupling: the visible square is one metre
 * regardless of how fine the paint is.
 */
test('one visible grid square is one metre, whatever the paint resolution', async () => {
  for (const cells of [1, 2, 4, 8, 16]) {
    const surface = new PaintSurface({ width: 16, height: 10, cells });
    const step = surface.material.uniforms.uGridStep.value;

    // the uniform is in PAINT CELLS, so the square is step/cells world units
    assert.equal(step / cells, 1,
      `at ${cells} cells/unit the visible grid square is ${step / cells}m, expected 1m`);

    // and the shader actually uses it, rather than the raw paint grid
    assert.match(surface.material.fragmentShader, /uGridSize \/ uGridStep/,
      'the grid must be divided by the step, or it is still one line per paint cell');
    assert.match(surface.material.fragmentShader, /0\.06 \/ uGridStep/,
      'the line width must be scaled too, or a coarser grid also draws fatter lines');
  }
});

test('the grid step never collapses below one paint cell', async () => {
  // a surface coarser than one cell per metre would otherwise get a step < 1,
  // which would draw MORE than one line per paint cell
  const coarse = new PaintSurface({ width: 16, height: 10, cells: 0.25 });
  assert.ok(coarse.material.uniforms.uGridStep.value >= 1);
});

/**
 * The world has ONE dead colour.
 *
 * `PAINT.grey` is the absence of paint: the floor, the unpainted props and the
 * HUD ammo bar all read it. It was 0x5a5a66 -- blue-violet -- while the drained
 * decor tint was grey-green, so the floor read as a different world from the
 * things standing on it. The plan flagged it in step 1 and it stayed unfixed
 * because the instanced props were not rendering, so there was nothing for the
 * floor to visibly disagree with.
 *
 * Asserted on the CHANNELS rather than the exact hex, because the point is the
 * family, not the value: a dead world must not be blue-dominant when everything
 * alive-in-grey in it is green-ish. Anyone re-tinting it is free to -- they just
 * have to keep it in the same family as the foliage.
 */
test('the dead colour is not blue-dominant, and sits in the same family as the decor', () => {
  const dead = PAINT.grey.hex;
  const r = (dead >> 16) & 0xff;
  const g = (dead >> 8) & 0xff;
  const b = dead & 0xff;

  assert.ok(b <= r && b <= g,
    `dead ground is 0x${dead.toString(16)} -- blue is its strongest channel, which is the `
    + 'blue-violet that stopped matching the grey-green forest');

  // and it should be LIGHTER than the foliage tint, so a slab still separates
  // from the floor it lies on instead of disappearing into it
  const tint = DECOR.tint;
  const tintLuma = 0.2126 * ((tint >> 16) & 0xff) + 0.7152 * ((tint >> 8) & 0xff) + 0.0722 * (tint & 0xff);
  const deadLuma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  assert.ok(deadLuma > tintLuma,
    `the floor (luma ${deadLuma.toFixed(0)}) must be lighter than the drained props (${tintLuma.toFixed(0)}), `
    + 'or a flat slab on it reads as a hole');
});

test('the ground shader draws the dead colour, not a second copy of it', async () => {
  const surface = new PaintSurface({ width: 16, height: 10, cells: PAINT_GRID.level1Cells });
  const painted = surface.material.uniforms.uColours.value[0];

  assert.equal(painted.getHex(), PAINT.grey.hex,
    'uColours[0] must be PAINT.grey.hex, or the floor and the HUD disagree about what dead looks like');
});
