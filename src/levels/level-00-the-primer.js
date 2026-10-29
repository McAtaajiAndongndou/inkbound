// OWNER: E (Levels)
// L0 — "THE PRIMER". The rebel training course. Ten rooms, one new verb each.
// WHAT THIS LEVEL DOES THAT THE OTHERS DO NOT: it teaches. Grey slows from room
// one, the first splat is on a WALL, and no room may kill except the trap.
// Enemies: one Charger behind a gate (room R7). Traps: one spike pit (R6) —
// its zone is placed, the pit is built in the trap pass (#101).
//
// Status: BLOCKOUT of design v2. Every number comes from the layout DATA —
// src/levels/layouts/primer.js — the same file the design doc's plan,
// sections, pacing and 3D massing model are generated from
// (docs/levels/00-the-primer.md). Behaviour (the gate, the win, the paint
// already on the floor) is LayoutLevel's, shared with the other data levels.
import { LayoutLevel } from './layout-level.js';
import { PRIMER } from './layouts/primer.js';

export class Level00 extends LayoutLevel {
  // Viewer shots: the design doc's "what you see" frames, one per room.
  static SHOTS = PRIMER.rooms.map((r) => ({
    name: `eye-${r.id}`, label: `${r.id} ${r.name}`, position: r.eye.pos, target: r.eye.target, fog: true,
  }));

  get layout() { return PRIMER; }
}
