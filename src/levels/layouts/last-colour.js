// OWNER: E (Levels)
//
// LAST COLOUR — the layout, as data. Version 2 (29 Oct 2026).
//
// The single source of truth for the level's shape, read by the massing model,
// the design-doc diagrams, and the level itself (see ascent.js for why). Its
// physics checks are tests/last-colour-layout.test.js.
//
// THREE SPATIAL IDEAS CARRY THE LEVEL:
//
//   1. THE SIPHON IS THE GOAL YOU CAN SEE. Lift, hangar, corridor and Core sit
//      on one north–south axis (x 0), so the Siphon is in frame from the lift
//      door onward — straight down the corridor, through the gate fields.
//   2. HIGH GROUND IS THE ONLY SAFE PAINT. Drainers, Stalkers and Chargers
//      cannot climb (`climbsGreen: false`), so a raised platform is paint
//      nothing can eat. Every arena floor point is within a 5 s walk of a
//      climb up to one (tested) — the design doc's "paintable pocket" rule.
//      Wave three's turrets are what take that safety away.
//   3. THE NEXT WAVE IS VISIBLE. Wave bays sit behind gate fields; wave three
//      waits, dormant, behind wave two.
//
// AXES. x east, y up, z SOUTH. The player arrives in the south (+z) by the
// Ascent's supply lift and walks north (−z) to the Siphon.
// BOXES are [x0, x1, y0, y1, z0, z1], metres, axis-aligned.
import { PAINT_GRID } from '../../config.js';

/** Solid rock, steel and concrete. `top: true` means a walkable top. */
const solids = [
  // --- R0 The Lift Landing — the arrival, 3 m above the hangar floor ----------
  // A one-way vantage ("a vista with a one-way entrance", LDB): a 3 m drop in,
  // and a green strip (or a red bounce) back up — so it is also a paint pocket.
  { id: 'landing', room: 'R0', box: [-6, 6, 0, 3, 78, 90], top: true, lips: { '-z': 0.3 } },
  { id: 'shaft-w', box: [-8, -6, 0, 12, 78, 92], kind: 'wall' },
  { id: 'shaft-e', box: [6, 8, 0, 12, 78, 92], kind: 'wall' },
  { id: 'shaft-n', box: [-6, 6, 0, 12, 90, 92], kind: 'wall' },

  // --- R1 The Hangar — 48 x 38 m, wave one: six Drainers -----------------------
  { id: 'hangar-floor', room: 'R1', box: [-24, 24, -2, 0, 40, 78], top: true },
  { id: 'hangar-w', box: [-26, -24, 0, 12, 40, 78], kind: 'wall' },
  { id: 'hangar-e', box: [24, 26, 0, 12, 40, 78], kind: 'wall' },
  { id: 'hangar-s-w', box: [-26, -8, 0, 12, 78, 80], kind: 'wall' },
  { id: 'hangar-s-e', box: [8, 26, 0, 12, 78, 80], kind: 'wall' },
  { id: 'hangar-n-w', box: [-26, -6, 0, 12, 38, 40], kind: 'wall' },
  { id: 'hangar-n-e', box: [6, 26, 0, 12, 38, 40], kind: 'wall' },
  // Gantries along both long walls: the hangar's safe paint.
  { id: 'gantry-w', room: 'R1', box: [-24, -18, 0, 5, 44, 74], top: true, kind: 'pocket', lips: { '+x': 0.3 } },
  { id: 'gantry-e', room: 'R1', box: [18, 24, 0, 5, 44, 74], top: true, kind: 'pocket', lips: { '-x': 0.3 } },
  // A control booth by the corridor mouth: the third pocket, so the north end
  // of the floor is in reach of one too.
  { id: 'booth', room: 'R1', box: [4, 10, 0, 3.5, 42, 46], top: true, kind: 'pocket', lips: { '+z': 0.3 } },
  // Containers: cover, 4.6 m — above a red bounce, never a perch.
  { id: 'container-1', room: 'R1', box: [-14, -8, 0, 4.6, 62, 65], kind: 'cover' },
  { id: 'container-2', room: 'R1', box: [8, 14, 0, 4.6, 52, 55], kind: 'cover' },
  { id: 'container-3', room: 'R1', box: [-10, -4, 0, 4.6, 50, 52], kind: 'cover' },

  // --- R2 The Corridor — 12 x 50 m, two turrets and a Charger -----------------
  { id: 'corridor-floor', room: 'R2', box: [-6, 6, -2, 0, -10, 40], top: true },
  // Walls are 10 m: the walkway (4 m) plus a red bounce (4.33) must not clear them.
  { id: 'corridor-w-s', box: [-8, -6, 0, 10, 18, 38], kind: 'wall' },
  { id: 'corridor-w-n', box: [-8, -6, 0, 10, -8, 12], kind: 'wall' },
  { id: 'corridor-e', box: [6, 8, 0, 10, -8, 38], kind: 'wall' },
  // The alcove: turret T2's nest, a recess in the west wall.
  { id: 'alcove-floor', room: 'R2', box: [-12, -6, -2, 0, 12, 18], top: true },
  { id: 'alcove-back', box: [-14, -12, 0, 10, 10, 20], kind: 'wall' },
  { id: 'alcove-n', box: [-12, -8, 0, 10, 10, 12], kind: 'wall' },
  { id: 'alcove-s', box: [-12, -8, 0, 10, 18, 20], kind: 'wall' },
  // The flanking walkway along the east wall, 4 m up: the way past both turrets
  // — and over the laser grid (trap pass), which only reaches 3 m.
  { id: 'walkway', room: 'R2', box: [2, 6, 0, 4, -6, 36], top: true, lips: { '-x': 0.3 } },
  { id: 'pillar-s', room: 'R2', box: [-4, -2, 0, 10, 26, 28], kind: 'cover' },
  { id: 'pillar-n', room: 'R2', box: [-4, -2, 0, 10, 4, 6], kind: 'cover' },
  // Turret T1's platform at the corridor's far end, beside the Core door.
  { id: 't1-platform', room: 'R2', box: [-6, -2, 0, 3, -10, -6], top: true },

  // --- R3 The Core — 52 x 52 m, waves two and three, the Siphon ---------------
  { id: 'core-floor', room: 'R3', box: [-26, 26, -2, 0, -62, -10], top: true },
  { id: 'core-s-w', box: [-28, -6, 0, 14, -10, -8], kind: 'wall' },
  { id: 'core-s-e', box: [6, 28, 0, 14, -10, -8], kind: 'wall' },
  { id: 'core-w-s', box: [-28, -26, 0, 14, -30, -10], kind: 'wall' },
  { id: 'core-w-n', box: [-28, -26, 0, 14, -64, -42], kind: 'wall' },
  { id: 'core-e-s', box: [26, 28, 0, 14, -30, -10], kind: 'wall' },
  { id: 'core-e-n', box: [26, 28, 0, 14, -64, -42], kind: 'wall' },
  { id: 'core-n-w', box: [-26, -6, 0, 14, -64, -62], kind: 'wall' },
  { id: 'core-n-e', box: [6, 26, 0, 14, -64, -62], kind: 'wall' },
  // The ring balcony, 5 m up and 6 m deep, broken only at the three bay mouths
  // and the entrance. Every piece is a pocket: nothing that eats paint climbs.
  { id: 'balcony-sw', room: 'R3', box: [-26, -6, 0, 5, -16, -10], top: true, kind: 'pocket', lips: { '-z': 0.3 } },
  { id: 'balcony-se', room: 'R3', box: [6, 26, 0, 5, -16, -10], top: true, kind: 'pocket', lips: { '-z': 0.3 } },
  { id: 'balcony-w-s', room: 'R3', box: [-26, -20, 0, 5, -30, -16], top: true, kind: 'pocket', lips: { '+x': 0.3 } },
  { id: 'balcony-w-n', room: 'R3', box: [-26, -20, 0, 5, -56, -42], top: true, kind: 'pocket' },
  { id: 'balcony-e-s', room: 'R3', box: [20, 26, 0, 5, -30, -16], top: true, kind: 'pocket', lips: { '-x': 0.3 } },
  { id: 'balcony-e-n', room: 'R3', box: [20, 26, 0, 5, -56, -42], top: true, kind: 'pocket' },
  { id: 'balcony-nw', room: 'R3', box: [-26, -6, 0, 5, -62, -56], top: true, kind: 'pocket', lips: { '+z': 0.3 } },
  { id: 'balcony-ne', room: 'R3', box: [6, 26, 0, 5, -62, -56], top: true, kind: 'pocket', lips: { '+z': 0.3 } },
  // The Siphon: 10 x 10 x 22 m in the middle of the room. Architecture and cover
  // during the waves; the final exam after (#100). Its phases are not built here.
  { id: 'siphon', room: 'R3', box: [-5, 5, 0, 22, -41, -31], kind: 'siphon' },
  // Floor cover: two low walls (hop them) and two blocks (fight round them).
  { id: 'core-low-wall-w', room: 'R3', box: [-14, -8, 0, 1, -24, -23.4], kind: 'cover' },
  { id: 'core-low-wall-e', room: 'R3', box: [8, 14, 0, 1, -24, -23.4], kind: 'cover' },
  { id: 'core-block-w', room: 'R3', box: [-16, -12, 0, 4.6, -50, -46], kind: 'cover' },
  { id: 'core-block-e', room: 'R3', box: [12, 16, 0, 4.6, -50, -46], kind: 'cover' },

  // --- Wave bays: the west and east bays hold waves two and three; the north
  // bay is Big Arm's (#99). Each behind a gate field the player can see into.
  { id: 'bay-w-floor', room: 'R3', box: [-34, -26, -2, 0, -42, -30], top: true, kind: 'bay' },
  { id: 'bay-w-back', box: [-36, -34, 0, 10, -44, -28], kind: 'wall' },
  { id: 'bay-w-n', box: [-34, -28, 0, 10, -44, -42], kind: 'wall' },
  { id: 'bay-w-s', box: [-34, -28, 0, 10, -30, -28], kind: 'wall' },
  { id: 'bay-e-floor', room: 'R3', box: [26, 34, -2, 0, -42, -30], top: true, kind: 'bay' },
  { id: 'bay-e-back', box: [34, 36, 0, 10, -44, -28], kind: 'wall' },
  { id: 'bay-e-n', box: [28, 34, 0, 10, -44, -42], kind: 'wall' },
  { id: 'bay-e-s', box: [28, 34, 0, 10, -30, -28], kind: 'wall' },
  { id: 'bay-n-floor', room: 'R3', box: [-6, 6, -2, 0, -74, -62], top: true, kind: 'bay' },
  { id: 'bay-n-back', box: [-8, 8, 0, 14, -76, -74], kind: 'wall' },
  { id: 'bay-n-w', box: [-8, -6, 0, 14, -74, -64], kind: 'wall' },
  { id: 'bay-n-e', box: [6, 8, 0, 14, -74, -64], kind: 'wall' },
];

/** Paintable climb strips — the ways up to the pockets. Everything else is steel. */
const strips = [
  { id: 'landing-return', room: 'R0', face: '-z', at: 78, span: [-2, 2], y: [0, 3], note: 'Back up to the landing' },
  { id: 'gantry-w-climb', room: 'R1', face: '+x', at: -18, span: [56, 60], y: [0, 5], note: 'West gantry' },
  { id: 'gantry-e-climb', room: 'R1', face: '-x', at: 18, span: [56, 60], y: [0, 5], note: 'East gantry' },
  { id: 'booth-climb', room: 'R1', face: '+z', at: 46, span: [6, 8], y: [0, 3.5], note: 'The booth' },
  { id: 'walkway-climb', room: 'R2', face: '-x', at: 2, span: [32, 36], y: [0, 4], note: 'Onto the flanking walkway' },
  { id: 'balcony-sw-climb', room: 'R3', face: '-z', at: -16, span: [-12, -8], y: [0, 5], note: 'South-west balcony' },
  { id: 'balcony-se-climb', room: 'R3', face: '-z', at: -16, span: [8, 12], y: [0, 5], note: 'South-east balcony' },
  { id: 'balcony-w-climb', room: 'R3', face: '+x', at: -20, span: [-26, -22], y: [0, 5], note: 'West balcony' },
  { id: 'balcony-e-climb', room: 'R3', face: '-x', at: 20, span: [-26, -22], y: [0, 5], note: 'East balcony' },
  { id: 'balcony-nw-climb', room: 'R3', face: '+z', at: -56, span: [-16, -12], y: [0, 5], note: 'North-west balcony' },
  { id: 'balcony-ne-climb', room: 'R3', face: '+z', at: -56, span: [12, 16], y: [0, 5], note: 'North-east balcony' },
];

/**
 * Gates: full-height fields that drop when their rule holds (layout-level.js).
 * The wave bays open as you enter the Core, so wave two pours in; wave three is
 * already standing behind it, and waits 8 s after wave two is gone. Big Arm's
 * gate pulses for 12 s once wave three is gone, then drops (decision 1: the
 * pacing never dropped, so these are the two breaths).
 */
const gates = [
  { id: 'gate-corridor', box: [-6, 6, 0, 10, 39.8, 40.2], opens: 'cleared:R1.1' },
  { id: 'gate-bay-w', box: [-26.2, -25.8, 0, 10, -42, -30], opens: 'enter:R3' },
  { id: 'gate-bay-e', box: [25.8, 26.2, 0, 10, -42, -30], opens: 'enter:R3' },
  { id: 'gate-bay-n', box: [-6, 6, 0, 14, -62.2, -61.8], opens: 'cleared:R3.3+12' },
];

/**
 * Trap zones. The crusher is built (crusher.js, polish pass 1); the laser grid
 * is cut to BACKLOG Parked (the crusher is the trap with a rhythm). Not geometry.
 */
const traps = [
  { id: 'cargo-crusher', room: 'R2', kind: 'crusher', box: [-6, 2, 0, 10, 22, 24], note: 'Fixed rhythm. Cross in the gap, or blue-slide under. The walkway passes beside it.' },
  { id: 'laser-grid', planned: true, room: 'R2', kind: 'laser', box: [-6, 6, 0, 3, 0, 1], note: 'Never through. Red bounce over (4.33 > 3), or the walkway at 4 m passes above it.' },
];

/**
 * Props — the Corp prop kit (#56, polish pass 1), built by prop-kit.js. Not
 * geometry: no collision, no paint, so enemies path exactly as before. Grey
 * machinery; the amber lamps are the one colour. Keep-outs are tested: off
 * every strip and route point, and nothing on an arena floor above 1.2 m.
 * Each room is dressed differently, so the three read as three places:
 *   hangar    crate stacks and jersey barriers — a cargo bay
 *   corridor  pipe runs on both walls and a rail on the walkway — a service duct
 *   Core      lamps over every bay gate, overhead pipes, barriers at the mouths
 */
const props = [
  // --- R1 The Hangar: cargo ------------------------------------------------
  ...[[-17, 46], [-17, 47.3], [-15.7, 46], [16, 66], [16, 67.3], [-17, 70], [14.6, 74]].map(([x, z], i) => ({
    id: `hangar-crate-${i + 1}`, room: 'R1', kind: 'crate', box: [x, x + 1.2, 0, 1.2, z, z + 1.2],
  })),
  { id: 'hangar-barrier-w', room: 'R1', kind: 'barrier', box: [-14, -11, 0, 0.9, 76, 76.6] },
  { id: 'hangar-barrier-e', room: 'R1', kind: 'barrier', box: [11, 14, 0, 0.9, 76, 76.6] },
  { id: 'hangar-barrier-n', room: 'R1', kind: 'barrier', box: [-4, -1, 0, 0.9, 43, 43.6] },
  { id: 'hangar-pipe-w', room: 'R1', kind: 'pipe', box: [-23.9, -23.3, 9, 9.6, 40, 78] },
  { id: 'hangar-pipe-e', room: 'R1', kind: 'pipe', box: [23.3, 23.9, 9, 9.6, 40, 78] },

  // --- R2 The Corridor: a service duct --------------------------------------
  { id: 'corridor-pipe-e-lo', room: 'R2', kind: 'pipe', box: [5.5, 5.9, 7, 7.4, -8, 38] },
  { id: 'corridor-pipe-e-hi', room: 'R2', kind: 'pipe', box: [5.3, 5.9, 8.2, 8.8, -8, 38] },
  { id: 'corridor-pipe-w-s', room: 'R2', kind: 'pipe', box: [-5.9, -5.3, 8.2, 8.8, 20, 38] },
  { id: 'corridor-pipe-w-n', room: 'R2', kind: 'pipe', box: [-5.9, -5.3, 8.2, 8.8, -8, 10] },
  { id: 'walkway-rail', room: 'R2', kind: 'rail', box: [2.05, 2.15, 4.95, 5.05, -4, 31] },

  // --- R3 The Core: lamps over the bay gates are the waves' tell ------------
  // West and east bays: blink through wave three's 8 s breath.
  { id: 'lamp-bay-w-n', room: 'R3', kind: 'light', rule: 'cleared:R3.2+8', box: [-26, -25.5, 10.5, 11.3, -43.2, -42.4] },
  { id: 'lamp-bay-w-s', room: 'R3', kind: 'light', rule: 'cleared:R3.2+8', box: [-26, -25.5, 10.5, 11.3, -29.6, -28.8] },
  { id: 'lamp-bay-e-n', room: 'R3', kind: 'light', rule: 'cleared:R3.2+8', box: [25.5, 26, 10.5, 11.3, -43.2, -42.4] },
  { id: 'lamp-bay-e-s', room: 'R3', kind: 'light', rule: 'cleared:R3.2+8', box: [25.5, 26, 10.5, 11.3, -29.6, -28.8] },
  // North bay: blinks with Big Arm's 12 s gate pulse.
  { id: 'lamp-bay-n-w', room: 'R3', kind: 'light', rule: 'cleared:R3.3+12', box: [-7.2, -6.4, 12, 12.8, -62, -61.5] },
  { id: 'lamp-bay-n-e', room: 'R3', kind: 'light', rule: 'cleared:R3.3+12', box: [6.4, 7.2, 12, 12.8, -62, -61.5] },
  { id: 'core-pipe-n-w', room: 'R3', kind: 'pipe', box: [-26, -6, 11, 11.6, -61.9, -61.3] },
  { id: 'core-pipe-n-e', room: 'R3', kind: 'pipe', box: [6, 26, 11, 11.6, -61.9, -61.3] },
  { id: 'core-pipe-s-w', room: 'R3', kind: 'pipe', box: [-26, -6, 11, 11.6, -10.7, -10.1] },
  { id: 'core-pipe-s-e', room: 'R3', kind: 'pipe', box: [6, 26, 11, 11.6, -10.7, -10.1] },
  { id: 'core-barrier-w', room: 'R3', kind: 'barrier', box: [-18, -17.4, 0, 0.9, -39, -36] },
  { id: 'core-barrier-e', room: 'R3', kind: 'barrier', box: [17.4, 18, 0, 0.9, -36, -33] },
  { id: 'core-crate-w', room: 'R3', kind: 'crate', box: [-17.4, -16.2, 0, 1.2, -48.6, -47.4] },
  { id: 'core-crate-e', room: 'R3', kind: 'crate', box: [16.2, 17.4, 0, 1.2, -48.6, -47.4] },
];

/**
 * Not walkable: things to see. The Siphon's three phase targets are markers
 * for #100 — where the intake, the arms and the core will be.
 */
const landmarks = [
  // The Siphon's mast and beacon, 27 m up. The Siphon itself (22 m) is in view
  // from the lift only down the corridor's axis, 120 m off, where it reads as
  // nothing (massing review, 29 Oct). The beacon clears the hangar's 12 m wall
  // from anywhere on the landing (tested) — the overlook shows the goal over
  // the wall. From the hangar floor it is down the corridor axis only.
  { id: 'siphon-mast', box: [-1, 1, 22, 26, -37, -35], beacon: [0, 27, -36] },
];
const targets = [
  { id: 'siphon-intake', pos: [0, 3, -30.8], note: 'Phase 1 — blue freezes it' },
  { id: 'siphon-arm-w', pos: [-5.2, 8, -36], note: 'Phase 2 — green pins it' },
  { id: 'siphon-arm-e', pos: [5.2, 8, -36], note: 'Phase 2 — green pins it' },
  { id: 'siphon-arm-n', pos: [0, 8, -41.2], note: 'Phase 2 — green pins it' },
  { id: 'siphon-core', pos: [0, 16, -30.8], note: 'Phase 3 — red knocks it into the machine' },
];

/** Enemies. `planned` ones (Big Arm) are placed but not spawned until they exist. */
const enemies = [
  // Wave one — the hangar: six Drainers, nothing else (#96).
  ...[[-12, 70], [12, 70], [-14, 48], [14, 46], [-6, 58], [6, 62]].map(([x, z], i) => ({
    id: `w1-drainer-${i + 1}`, type: 'drainer', pos: [x, 0, z], room: 'R1', wave: 1, wake: 'enter:R1',
  })),
  // The corridor: two turrets and one Charger, no waves (#97).
  { id: 'c-turret-1', type: 'turret', pos: [-4, 3, -8], room: 'R2', wave: 1, wake: 'always' },
  { id: 'c-turret-2', type: 'turret', pos: [-10, 0, 15], room: 'R2', wave: 1, wake: 'always' },
  { id: 'c-charger', type: 'charger', pos: [0, 0, 30], room: 'R2', wave: 1, wake: 'enter:R2' },
  // Wave two — the Core: eight Drainers, two Chargers, the first Stalker (#98).
  // Split across the west and east bays; the Stalker comes from the east alone.
  ...[[-28, -40], [-28, -37], [-28, -34], [-28, -31]].map(([x, z], i) => ({
    id: `w2-drainer-w${i + 1}`, type: 'drainer', pos: [x, 0, z], room: 'R3', wave: 2, wake: 'enter:R3',
  })),
  ...[[28, -40], [28, -37], [28, -34], [28, -31]].map(([x, z], i) => ({
    id: `w2-drainer-e${i + 1}`, type: 'drainer', pos: [x, 0, z], room: 'R3', wave: 2, wake: 'enter:R3',
  })),
  { id: 'w2-charger-w', type: 'charger', pos: [-30, 0, -36], room: 'R3', wave: 2, wake: 'enter:R3' },
  { id: 'w2-charger-e', type: 'charger', pos: [30, 0, -38], room: 'R3', wave: 2, wake: 'enter:R3' },
  { id: 'w2-stalker', type: 'stalker', pos: [30, 0, -33], room: 'R3', wave: 2, wake: 'enter:R3' },
  // Wave three — waiting, visible, at the back of the same bays; plus two
  // turrets on the north balcony that take the high ground's safety away.
  ...[[-33, -40], [-33, -36], [-33, -32]].map(([x, z], i) => ({
    id: `w3-drainer-w${i + 1}`, type: 'drainer', pos: [x, 0, z], room: 'R3', wave: 3, wake: 'cleared:R3.2+8',
  })),
  ...[[33, -40], [33, -36], [33, -32]].map(([x, z], i) => ({
    id: `w3-drainer-e${i + 1}`, type: 'drainer', pos: [x, 0, z], room: 'R3', wave: 3, wake: 'cleared:R3.2+8',
  })),
  { id: 'w3-charger-w', type: 'charger', pos: [-31, 0, -41], room: 'R3', wave: 3, wake: 'cleared:R3.2+8' },
  { id: 'w3-charger-e', type: 'charger', pos: [31, 0, -31], room: 'R3', wave: 3, wake: 'cleared:R3.2+8' },
  { id: 'w3-turret-nw', type: 'turret', pos: [-23, 5, -59], room: 'R3', wave: 3, wake: 'cleared:R3.2+8' },
  { id: 'w3-turret-ne', type: 'turret', pos: [23, 5, -59], room: 'R3', wave: 3, wake: 'cleared:R3.2+8' },
  // Big Arm (#99, a cut candidate): its bay is built, it is not.
  { id: 'big-arm', type: 'bigArm', pos: [0, 0, -68], room: 'R4', wave: 1, wake: 'cleared:R3.3+12', planned: true },
];

/** Routes. The main route walks the floor; the flank takes the walkway. */
const routes = {
  main: [
    [0, 3, 86], [0, 3, 79], [0, 0, 74], [0, 0, 41], [0, 0, 30], [0, 0, 0], [0, 0, -9.5],
    [0, 0, -24], [0, 0, -29],
  ],
  flank: [[0, 0, 38], [1.5, 0, 34], [4, 4, 34], [4, 4, -5], [3, 0, -8]],
};

/**
 * Rooms. Big Arm and the Siphon are beats in the Core, listed so the pacing
 * chart shows them; both are `planned` (their mechanics are #99 and #100).
 * Travel is MEASURED from routes; fight and dwell seconds are ESTIMATES.
 */
const rooms = [
  { id: 'R0', name: 'Lift Landing', act: 1, intensity: 1, fightSeconds: 0, dwellSeconds: 5,
    eye: { pos: [0, 4.5, 86], target: [0, 8, -36] },
    question: 'Where is it?' },
  { id: 'R1', name: 'The Hangar', act: 1, intensity: 7, fightSeconds: 75,
    eye: { pos: [0, 4.5, 78.6], target: [0, 0, 52] },
    question: 'Why is my ground disappearing?' },
  { id: 'R2', name: 'The Corridor', act: 2, intensity: 6, fightSeconds: 45,
    eye: { pos: [0, 1.5, 39], target: [0, 3, -8] },
    question: 'Can I fight without room to repaint?' },
  // dwell: the 8 s breath between waves two and three (decision 1).
  { id: 'R3', name: 'The Core', act: 2, intensity: 9, fightSeconds: 180, dwellSeconds: 8,
    eye: { pos: [0, 1.5, -9.5], target: [0, 8, -36] },
    question: 'Can I hold ground and fight at the same time?' },
  // dwell: the 12 s warning while Big Arm's gate pulses (decision 1).
  { id: 'R4', name: 'Big Arm', act: 3, intensity: 10, fightSeconds: 90, dwellSeconds: 12, planned: true,
    eye: { pos: [-23, 6.5, -20], target: [0, 2, -66] },
    question: 'Can you beat it by understanding it, not by shooting it?' },
  { id: 'R5', name: 'The Siphon', act: 3, intensity: 8, fightSeconds: 60, planned: true,
    eye: { pos: [0, 1.5, -24], target: [0, 10, -36] },
    question: 'Do you know the order?' },
];

/**
 * The win. PLACEHOLDER until the Siphon's phases exist (#100): reach the
 * intake once the Core is clear. #100 replaces this with "phase three done".
 */
const win = { box: [-3, 3, -0.5, 3, -31, -28], requires: 'R3' };

/** What the design tools need that is not geometry (see ascent.js). */
const doc = {
  planBounds: [-40, 40, -80, 94],
  goal: { label: 'the Siphon', point: [0, 11, -31] },
  sections: [
    { id: 'a', axis: 'x', at: 0, from: 94, to: -78, top: 26, title: 'SECTION A — north–south through x 0: lift, hangar, corridor, the Core, the Siphon, the Big Arm bay' },
    { id: 'b', axis: 'z', at: -36, from: -38, to: 38, top: 26, title: 'SECTION B — west–east through z −36: the wave bays, the balconies, the Siphon' },
    { id: 'c', axis: 'z', at: 20, from: -16, to: 12, top: 14, title: 'SECTION C — west–east through z 20: the corridor, its alcove, the flanking walkway' },
  ],
  views: [
    { name: 'overview', label: 'Overview (from the south-east)', pos: [70, 75, 115], target: [0, 2, 12], fov: 55, caption: 'One axis, south to north: lift, hangar, corridor, the Core — and the Siphon at the end of it.' },
    { name: 'top', label: 'Top-down plan', pos: [0, 260, 8.01], target: [0, 0, 8], fov: 40, caption: 'Plan view. Floors are coloured by room.' },
    { name: 'core', label: 'The Core from above', pos: [46, 48, -2], target: [0, 2, -36], fov: 55, caption: 'The Core: the Siphon in the middle, the ring balcony, the three wave bays behind their gates.' },
    { name: 'corridor', label: 'The corridor from above', pos: [22, 26, 48], target: [0, 2, 14], fov: 55, caption: 'The corridor: the alcove turret, the pillars, the flanking walkway over the laser grid.' },
  ],
};

export const LAST_COLOUR = {
  id: 'last-colour', name: 'Last Colour', cells: PAINT_GRID.level3Cells,
  solids, slabs: [], strips, kerbs: [], landmarks, gates, traps, props, targets, enemies, routes, rooms, win, doc,
};
