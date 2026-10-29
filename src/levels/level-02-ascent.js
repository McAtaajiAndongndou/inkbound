// OWNER: E (Levels)
// L2 — "THE ASCENT". A spiral climb round one peak; paint is scarce.
// WHAT THIS LEVEL DOES THAT THE OTHERS DO NOT: paint is scarce, so every shot
// is a choice between traversal and combat. The player is RATIONING.
// Enemies: Wall-crawler, Turret, Charger (13). Traps: in the trap pass.
//
// Status: BLOCKOUT of design v2. Every number comes from the layout DATA —
// src/levels/layouts/ascent.js — the same file the design doc's plan, sections
// and 3D massing model are generated from (docs/levels/02-the-ascent.md).
// The behaviour (wake rules, the win) is LayoutLevel's, shared with Last
// Colour. To change the level, change the data and run its tests.
import { LayoutLevel } from './layout-level.js';
import { ASCENT } from './layouts/ascent.js';

export class Level02 extends LayoutLevel {
  // Viewer shots: the design doc's "what you see" frames, one per room, from
  // the same eye points — so a viewer screenshot of the BUILT level can be put
  // side by side with the doc's massing frame and compared.
  static SHOTS = ASCENT.rooms.map((r) => ({
    name: `eye-${r.id}`, label: `${r.id} ${r.name}`, position: r.eye.pos, target: r.eye.target, fog: true,
  }));

  get layout() { return ASCENT; }

  update(dt, player) {
    super.update(dt, player);
    // #112 — the sergeant's one line on the summit (R7): no enemies, the base
    // on the horizon (docs/levels/02-the-ascent.md).
    if (!this._saidSummit && this.inRoom('R7', player.position)) {
      this._saidSummit = true;
      this.game.say?.('ascent-summit');
    }
  }
}
