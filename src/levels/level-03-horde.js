// OWNER: E (Levels)
// L3 — "LAST COLOUR". One axis to the Siphon: hangar, corridor, the Core.
// WHAT THIS LEVEL DOES THAT THE OTHERS DO NOT: the enemies EAT your paint,
// so your safe painted ground shrinks while you fight. The player is DROWNING.
// Enemies: Drainer, Charger, Turret, Stalker (30); Big Arm is placed, not built
// (#99). Traps: cargo crusher, laser grid — zones placed, built in the trap pass.
//
// Status: BLOCKOUT of design v2. Every number comes from the layout DATA —
// src/levels/layouts/last-colour.js — the same file the design doc's plan,
// sections, pacing and 3D massing model are generated from
// (docs/levels/03-last-colour.md). The behaviour (waves, gates, the win) is
// LayoutLevel's, shared with the Ascent. The win is a PLACEHOLDER until the
// Siphon's phases exist (#100): reach its intake with the Core clear.
import { LayoutLevel } from './layout-level.js';
import { LAST_COLOUR } from './layouts/last-colour.js';

export class Level03 extends LayoutLevel {
  // Viewer shots: the design doc's "what you see" frames, one per room, from
  // the same eye points, so the built level can be compared with the doc.
  static SHOTS = LAST_COLOUR.rooms.map((r) => ({
    name: `eye-${r.id}`, label: `${r.id} ${r.name}`, position: r.eye.pos, target: r.eye.target, fog: true,
  }));

  get layout() { return LAST_COLOUR; }
}
