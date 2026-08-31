// OWNER: shared — but ONE person merges changes to avoid conflicts.
// All balance numbers live here so tuning never touches logic files.

export const TUNING = {
  player: { moveSpeed: 6.0, jumpImpulse: 7.5, health: 100 },

  paint: {
    tankMax: 100,
    costPerShot: 4,
    // Per-level refill rate. This is the knob that makes L2 feel different.
    refillPerSecond: { 1: 12, 2: 2, 3: 6 },
  },

  // Difficulty progression is by RULE, not by HP inflation.
  // See docs/rubric-map.md — "numbers turned up" is explicitly penalised.
  enemies: {
    baseHealth: 40,
    healthScale: { 1: 1.0, 2: 1.25, 3: 1.4 },
    // null = any colour damages it
    // a colour id = must break the shell with that colour first
    // an array = must be hit in that exact sequence
    armour: { 1: null, 2: 'requiredColour', 3: 'comboSequence' },
  },

  streaks: { thresholds: [25, 50, 80] }, // % of arena painted
};
