// OWNER: E (Levels)
//
// THE PRIMER — the layout, as data. Version 2 (29 Oct 2026).
//
// The single source of truth for the tutorial's shape, read by the massing
// model, the design-doc diagrams and the level (see ascent.js for why). Its
// physics checks are tests/primer-layout.test.js — including a REAL jump
// simulation of the blue gap, because the v1 doc's 8 m gap cleared with blue by
// 14 cm (measured with the player's own physics, 29 Oct).
//
// THE SHAPE: a straight course, one room per verb, on one axis (x 0) — the
// fiction is a rebel training course, so the geometry may look built. It
// climbs as it goes (floor 0 → 3 → 8) because each lesson's exit is the next
// lesson's floor. NOTHING HERE KILLS (issue #79): every room is walled higher
// than its floor plus a red bounce, and the one pit has stairs back out.
//
// AXES. x east, y up, z SOUTH; the player starts in the south and walks north.
// BOXES are [x0, x1, y0, y1, z0, z1], metres, axis-aligned.
import { PAINT_GRID } from '../../config.js';

/** Floors, walls, steps and blocks. */
const solids = [
  // --- R0 Briefing and R1 Move -------------------------------------------------
  { id: 'r0-floor', room: 'R0', box: [-7, 7, -2, 0, 84, 92], top: true },
  { id: 'r1-floor', room: 'R1', box: [-7, 7, -2, 0, 70, 84], top: true },
  // The one low wall: stops a walk (chest height), not a jump.
  { id: 'r1-low-wall', room: 'R1', box: [-7, 7, 0, 1, 76, 76.6], kind: 'cover' },

  // --- R2 The First Splat — a wall to paint, with a way round each side --------
  { id: 'r2-floor', room: 'R2', box: [-7, 7, -2, 0, 58, 70], top: true },
  { id: 'r2-target', room: 'R2', box: [-4, 4, 0, 5, 58, 59], kind: 'target' },

  // --- R3 Blue — a 6.5 m gap: beyond any grey jump, inside a blue one ----------
  { id: 'r3-runup', room: 'R3', box: [-7, 7, -2, 0, 44, 58], top: true },
  { id: 'r3-pit', room: 'R3', box: [-7, 7, -5, -3, 37.5, 41], top: true, kind: 'catch' },
  // The way out of the pit, back to the run-up: two 1.2 m steps and a 0.6 m one.
  { id: 'r3-step-1', room: 'R3', box: [-7, 7, -5, -1.8, 41, 42.5], top: true, kind: 'step' },
  { id: 'r3-step-2', room: 'R3', box: [-7, 7, -5, -0.6, 42.5, 44], top: true, kind: 'step' },
  // Down to the pit floor: a 2 m-deep landing left a slot under it onto the void.
  { id: 'r3-landing', room: 'R3', box: [-7, 7, -5, 0, 30, 37.5], top: true },

  // --- R4 Red — a 3 m ledge: above a jump, inside a bounce ---------------------
  { id: 'r4-floor', room: 'R4', box: [-7, 7, -2, 0, 16, 30], top: true },
  // The ledge IS R5's floor. Its face is rock: one mechanic per room, so
  // green cannot answer the red room.
  { id: 'r5-floor', room: 'R5', box: [-7, 7, 0, 3, 4, 16], top: true },

  // --- R5 Green — a 5 m wall (beyond a bounce); R6 is on top of it --------------
  { id: 'r6-floor', room: 'R6', box: [-7, 7, 0, 8, -20, 4], top: true, lips: { '+z': 0.3 } },

  // --- R7 One of Theirs and R8 Free Play — a wide hall, gated in two ------------
  { id: 'r7-floor', room: 'R7', box: [-12, 12, 0, 8, -50, -20], top: true },
  { id: 'r8-floor', room: 'R8', box: [-12, 12, 0, 8, -82, -50], top: true },
  // The free-play platform: 4 m — a red bounce reaches it, a green strip too.
  { id: 'r8-platform', room: 'R8', box: [4, 10, 8, 12, -78, -70], top: true, lips: { '+z': 0.3 } },

  // --- R9 Extraction -------------------------------------------------------------
  { id: 'r9-floor', room: 'R9', box: [-7, 7, 0, 8, -92, -82], top: true },

  // --- Walls: each section taller than its highest floor plus a red bounce -------
  { id: 'wall-start', box: [-9, 9, 0, 10, 92, 94], kind: 'wall' },
  // From y −5, not 0: the R3 pit is below floor level, and its sides must be walls too.
  { id: 'wall-w-0', box: [-9, -7, -5, 10, 16, 92], kind: 'wall' },
  { id: 'wall-e-0', box: [7, 9, -5, 10, 16, 92], kind: 'wall' },
  { id: 'wall-w-3', box: [-9, -7, 0, 13, 4, 16], kind: 'wall' },
  { id: 'wall-e-3', box: [7, 9, 0, 13, 4, 16], kind: 'wall' },
  { id: 'wall-w-8', box: [-9, -7, 0, 18, -20, 4], kind: 'wall' },
  { id: 'wall-e-8', box: [7, 9, 0, 18, -20, 4], kind: 'wall' },
  { id: 'wall-hall-sw', box: [-14, -9, 0, 18, -20, -18], kind: 'wall' },
  { id: 'wall-hall-se', box: [9, 14, 0, 18, -20, -18], kind: 'wall' },
  { id: 'wall-hall-w', box: [-14, -12, 0, 18, -82, -20], kind: 'wall' },
  { id: 'wall-hall-e', box: [12, 14, 0, 18, -82, -20], kind: 'wall' },
  { id: 'wall-hall-nw', box: [-14, -9, 0, 18, -84, -82], kind: 'wall' },
  { id: 'wall-hall-ne', box: [9, 14, 0, 18, -84, -82], kind: 'wall' },
  { id: 'wall-w-9', box: [-9, -7, 0, 18, -92, -82], kind: 'wall' },
  { id: 'wall-e-9', box: [7, 9, 0, 18, -92, -82], kind: 'wall' },
  { id: 'wall-end', box: [-9, 9, 0, 18, -94, -92], kind: 'wall' },
  // Thresholds (decision 2): a cross wall with a 4 m doorway where two lessons
  // would otherwise run together, so each room isolates one idea and the next
  // verb is a reveal. R2's target wall, the red ledge and the green wall
  // already divide their rooms; these close the rest.
  { id: 'door-r1-r2-w', box: [-7, -2, 0, 10, 69.5, 70.5], kind: 'wall' },
  { id: 'door-r1-r2-e', box: [2, 7, 0, 10, 69.5, 70.5], kind: 'wall' },
  { id: 'door-r3-r4-w', box: [-7, -2, 0, 10, 29.5, 30.5], kind: 'wall' },
  { id: 'door-r3-r4-e', box: [2, 7, 0, 10, 29.5, 30.5], kind: 'wall' },
  { id: 'door-r6-r7-w', box: [-7, -2, 8, 18, -20.5, -19.5], kind: 'wall' },
  { id: 'door-r6-r7-e', box: [2, 7, 8, 18, -20.5, -19.5], kind: 'wall' },
  // R7's exit: a doorway with the gate in it.
  { id: 'r7-door-w', box: [-12, -4, 8, 18, -50.5, -49.5], kind: 'wall' },
  { id: 'r7-door-e', box: [4, 12, 8, 18, -50.5, -49.5], kind: 'wall' },

  // --- Dressing (polish pass 1): "the rebels built this" ----------------------
  // Crates and target boards from plain boxes, no new models. All of it hugs a
  // wall, clear of the route and every climb (tests/primer-layout.test.js).
  // Crates have no `top`: you can stand on one, but no route may rely on it.
  // Boards are paintable (a `climb: false` strip): shooting a target and
  // seeing your colour on it is the range doing its job.
  { id: 'r1-crate-a', room: 'R1', box: [4.6, 6.4, 0, 1.2, 79, 80.8], kind: 'crate' },
  { id: 'r1-crate-b', room: 'R1', box: [5, 6.2, 1.2, 2.2, 79.3, 80.5], kind: 'crate' },
  { id: 'r1-crate-c', room: 'R1', box: [-6.6, -5.2, 0, 1.2, 72, 73.4], kind: 'crate' },
  { id: 'r1-board-w', room: 'R1', box: [-5.5, -3.5, 1, 3, 70.5, 70.7], kind: 'board' },
  { id: 'r1-board-e', room: 'R1', box: [3.5, 5.5, 1, 3, 70.5, 70.7], kind: 'board' },
  { id: 'r7-crate-a', room: 'R7', box: [-11.6, -9.8, 8, 9.2, -27, -25.2], kind: 'crate' },
  { id: 'r7-crate-b', room: 'R7', box: [-11.4, -10.2, 9.2, 10.2, -26.6, -25.6], kind: 'crate' },
  { id: 'r7-crate-c', room: 'R7', box: [9.8, 11.6, 8, 9.2, -46, -44.2], kind: 'crate' },
  { id: 'r7-board-w', room: 'R7', box: [-10, -6, 9, 11.5, -49.5, -49.3], kind: 'board' },
  { id: 'r7-board-e', room: 'R7', box: [6, 10, 9, 11.5, -49.5, -49.3], kind: 'board' },
];

/**
 * Paintable walls. `climb: false` is a wall to paint, not to climb (R2's first
 * splat) — the top-out checks skip it.
 */
const strips = [
  { id: 'r2-first-splat', room: 'R2', face: '+z', at: 59, span: [-4, 4], y: [0, 5], climb: false, note: 'The first splat — on a wall, so the colour stays in view' },
  { id: 'r5-green', room: 'R5', face: '+z', at: 4, span: [-2, 2], y: [3, 8], note: 'The only way up: 5 m, beyond a red bounce' },
  { id: 'r8-platform-climb', room: 'R8', face: '+z', at: -70, span: [6, 8], y: [8, 12], note: 'Free play: climb it or bounce it' },
  // The range's target boards (dressing): paint them, never climb them.
  { id: 'r1-board-w', room: 'R1', face: '+z', at: 70.7, span: [-5.5, -3.5], y: [1, 3], climb: false, note: 'Target board' },
  { id: 'r1-board-e', room: 'R1', face: '+z', at: 70.7, span: [3.5, 5.5], y: [1, 3], climb: false, note: 'Target board' },
  { id: 'r7-board-w', room: 'R7', face: '+z', at: -49.3, span: [-10, -6], y: [9, 11.5], climb: false, note: 'Target board' },
  { id: 'r7-board-e', room: 'R7', face: '+z', at: -49.3, span: [6, 10], y: [9, 11.5], climb: false, note: 'Target board' },
];

/**
 * Chalk lane markings (dressing): `rect` is x0, x1, z0, z1 on the floor at `y`.
 * Chalk, not paint: they change nothing underfoot (config PRIMER.dressing).
 */
const W = 0.075;   // half of PRIMER.dressing.lineWidth
const markings = [
  // R1: a lane down the middle, broken by the low wall, and a start line.
  { id: 'r1-start', room: 'R1', y: 0, rect: [-2, 2, 83 - W, 83 + W] },
  { id: 'r1-lane-w-1', room: 'R1', y: 0, rect: [-2 - W, -2 + W, 77, 83] },
  { id: 'r1-lane-e-1', room: 'R1', y: 0, rect: [2 - W, 2 + W, 77, 83] },
  { id: 'r1-lane-w-2', room: 'R1', y: 0, rect: [-2 - W, -2 + W, 71, 75.6] },
  { id: 'r1-lane-e-2', room: 'R1', y: 0, rect: [2 - W, 2 + W, 71, 75.6] },
  // R7: a firing line where you enter, and the lane to the gate.
  { id: 'r7-line', room: 'R7', y: 8, rect: [-6, 6, -23 - W, -23 + W] },
  { id: 'r7-lane-w', room: 'R7', y: 8, rect: [-2 - W, -2 + W, -48, -24] },
  { id: 'r7-lane-e', room: 'R7', y: 8, rect: [2 - W, 2 + W, -48, -24] },
];

/**
 * Paint already on the floor when the level loads — the teaching examples.
 * `y` is the floor; the rect is x0, x1, z0, z1.
 */
const prepaint = [
  { id: 'r3-blue-strip', room: 'R3', colour: 'blue', y: 0, rect: [-2, 2, 44, 56], note: '"A blue strip leading to the edge"' },
  { id: 'r4-red-pad', room: 'R4', colour: 'red', y: 0, rect: [-2, 2, 16.5, 19], note: '"A red pad at the base"' },
  { id: 'r8-blue-lane', room: 'R8', colour: 'blue', y: 8, rect: [-10, -6, -76, -54], note: 'Free play: slide' },
  { id: 'r8-red-pad', room: 'R8', colour: 'red', y: 8, rect: [5, 9, -68, -64], note: 'Free play: bounce onto the platform' },
];

/** The gate that holds R7 shut until its Charger is gone. */
const gates = [
  { id: 'gate-r7', box: [-4, 4, 8, 18, -50.2, -49.8], opens: 'cleared:R7' },
];

/** Trap zones (built: src/levels/spike-pit.js, #101). Damages, never kills. */
const traps = [
  { id: 'r6-spike-pit', room: 'R6', kind: 'spikes', box: [-7, 7, 8, 9, -12, -8], note: 'Telegraphed: a sagging floor and a creak. Damages, does not kill. Blue slides over it.' },
];

const enemies = [
  { id: 'r7-charger', type: 'charger', pos: [0, 8, -40], room: 'R7', wave: 1, wake: 'enter:R7' },
];

const routes = {
  main: [
    [0, 0, 90], [0, 0, 78], [0, 0, 75], [0, 0, 62], [5.5, 0, 60], [5.5, 0, 57], [0, 0, 50],
    [0, 0, 44.1], [0, 0, 37], [0, 0, 20], [0, 3, 14], [0, 3, 5], [0, 8, 3.8], [0, 8, -21],
    [0, 8, -49], [0, 8, -60], [0, 8, -83], [0, 8, -88],
  ],
};

/**
 * Rooms. Fight and dwell seconds are ESTIMATES; travel is measured from the
 * route. Dwell here is the lesson itself: firing at the wall, trying the
 * blue, finding the bounce — and free play, which is all dwell by design.
 */
const rooms = [
  { id: 'R0', name: 'Briefing', act: 1, intensity: 0, fightSeconds: 0, dwellSeconds: 8,
    eye: { pos: [0, 1.5, 90], target: [0, 2, 60] }, question: '—' },
  { id: 'R1', name: 'Move', act: 1, intensity: 1, fightSeconds: 0,
    eye: { pos: [0, 1.5, 83], target: [0, 1, 70] }, question: 'Can I move?' },
  { id: 'R2', name: 'The First Splat', act: 1, intensity: 2, fightSeconds: 0, dwellSeconds: 8,
    eye: { pos: [0, 1.5, 69], target: [0, 2.5, 59] }, question: 'What does the gun do?' },
  { id: 'R3', name: 'Blue', act: 2, intensity: 3, fightSeconds: 0, dwellSeconds: 10,
    eye: { pos: [0, 1.5, 57], target: [0, 0, 36] }, question: 'What if the ground was slippery?' },
  { id: 'R4', name: 'Red', act: 2, intensity: 3, fightSeconds: 0, dwellSeconds: 8,
    eye: { pos: [0, 1.5, 29], target: [0, 3, 14] }, question: 'What if the ground pushed back?' },
  { id: 'R5', name: 'Green', act: 2, intensity: 3, fightSeconds: 0, dwellSeconds: 8,
    eye: { pos: [0, 4.5, 15], target: [0, 6, 4] }, question: 'What if the wall wanted to be climbed?' },
  { id: 'R6', name: 'The Trap', act: 2, intensity: 4, fightSeconds: 0, dwellSeconds: 4,
    eye: { pos: [0, 9.5, 3], target: [0, 8, -14] }, question: 'Is this place dangerous?' },
  { id: 'R7', name: 'One of Theirs', act: 3, intensity: 6, fightSeconds: 30,
    eye: { pos: [0, 9.5, -21], target: [0, 9, -40] }, question: 'Which colour is this?' },
  { id: 'R8', name: 'Free Play', act: 3, intensity: 2, fightSeconds: 0, dwellSeconds: 30,
    eye: { pos: [0, 9.5, -51], target: [3, 10, -72] }, question: 'What can I do with this?' },
  { id: 'R9', name: 'Extraction', act: 3, intensity: 1, fightSeconds: 0, dwellSeconds: 5,
    eye: { pos: [0, 9.5, -83], target: [0, 9, -89] }, question: '—' },
];

/** The win: the pad in R9, beyond free play — never in it (issue #79). */
const win = { box: [-3, 3, 7.5, 11, -90, -86], requires: 'R7' };

/** What the design tools need that is not geometry (see ascent.js). */
const doc = {
  planBounds: [-16, 16, -96, 96],
  goal: { label: 'the extraction pad', point: [0, 9.5, -88] },
  sections: [
    { id: 'a', axis: 'x', at: 0, from: 96, to: -96, top: 22, title: 'SECTION A — south–north through x 0: the whole course, floor 0 → 3 → 8' },
    { id: 'b', axis: 'z', at: -74, from: -16, to: 16, top: 22, title: 'SECTION B — west–east through z −74: free play, its blue lane and its platform' },
  ],
  views: [
    { name: 'overview', label: 'Overview (from the east)', pos: [150, 130, 40], target: [0, 4, 0], fov: 55, caption: 'The course: one room per verb on one axis, climbing 0 → 3 → 8 m.' },
    { name: 'top', label: 'Top-down plan', pos: [0, 270, 0.01], target: [0, 0, 0], fov: 40, caption: 'Plan view. Floors are coloured by room.' },
    { name: 'lessons', label: 'Blue, red, green from above', pos: [30, 30, 50], target: [0, 2, 22], fov: 55, caption: 'R3 → R5: the gap, the ledge, the wall.' },
    { name: 'hall', label: 'The hall from above', pos: [34, 40, -24], target: [0, 8, -60], fov: 55, caption: 'R7 and R8: the Charger, its gate, and free play.' },
  ],
};

export const PRIMER = {
  id: 'primer', name: 'The Primer', cells: PAINT_GRID.level0Cells,
  solids, slabs: [], strips, kerbs: [], landmarks: [], gates, traps, targets: [], prepaint, markings,
  enemies, routes, rooms, win, doc,
};
