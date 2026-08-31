// ALL tuning numbers live here. If you are about to type a magic number
// into a system file, it belongs in this file instead.

export const PLAYER = {
  moveSpeed: 6,
  jumpImpulse: 7,
  maxHealth: 100,
};

// Colour -> physics. This is the whole game in one object.
export const SURFACE = {
  grey:  { friction: 0.8,  restitution: 0.0, climbable: false },
  blue:  { friction: 0.02, restitution: 0.0, climbable: false }, // ice
  red:   { friction: 0.8,  restitution: 1.6, climbable: false }, // bounce
  green: { friction: 1.0,  restitution: 0.0, climbable: true  }, // grip
};

export const AMMO = {
  level1: { tank: 100, refillRate: 12 }, // learning  — plentiful
  level2: { tank: 60,  refillRate: 2  }, // rationing — scarce
  level3: { tank: 80,  refillRate: 6  }, // drowning  — contested
};

export const ENEMY = {
  sprayer:     { hp: 40, speed: 2.5, canShoot: true,  canMove: true,  climbsGreen: false, drainsPaint: false },
  charger:     { hp: 30, speed: 5.0, canShoot: false, canMove: true,  climbsGreen: false, drainsPaint: false },
  wallCrawler: { hp: 45, speed: 3.0, canShoot: true,  canMove: true,  climbsGreen: true,  drainsPaint: false },
  turret:      { hp: 70, speed: 0,   canShoot: true,  canMove: false, climbsGreen: false, drainsPaint: false },
  drainer:     { hp: 20, speed: 4.0, canShoot: false, canMove: true,  climbsGreen: false, drainsPaint: true  },
};

// Difficulty comes from NEW RULES, not bigger health bars.
// null requiredColour = anything hurts it. Empty comboSequence = no combo.
export const DEFENCE = {
  level1: { requiredColour: null,   comboSequence: [] },
  level2: { requiredColour: 'red',  comboSequence: [] },
  level3: { requiredColour: null,   comboSequence: ['blue', 'red'] },
};

export const WAVES = {
  level3: { count: 8, baseEnemies: 6, growthPerWave: 3, hpGrowthPerWave: 0.12 },
};
