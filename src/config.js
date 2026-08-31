// Every colour and every tuning number lives here.
// If you are about to type a magic number into another file, it belongs here.

export const PAINT = {
  blue:  { hex: 0x3aa7ff, name: 'Ice'    },
  red:   { hex: 0xff4d5a, name: 'Bounce' },
  green: { hex: 0x4ee08a, name: 'Grip'   },
  grey:  { hex: 0x6b6b78, name: 'Dead'   },
};

// Colour -> physics. This is the whole game in one object.
export const SURFACE = {
  grey:  { friction: 0.8,  restitution: 0.0, climbable: false },
  blue:  { friction: 0.02, restitution: 0.0, climbable: false },
  red:   { friction: 0.8,  restitution: 1.6, climbable: false },
  green: { friction: 1.0,  restitution: 0.0, climbable: true  },
};

export const PLAYER = { moveSpeed: 6, jumpImpulse: 7, maxHealth: 100 };

// Level 1 plentiful, level 2 starved, level 3 contested.
export const AMMO = {
  1: { tank: 100, refillRate: 12 },
  2: { tank: 60,  refillRate: 2  },
  3: { tank: 80,  refillRate: 6  },
};

// One enemy class, five configs. Not five systems.
export const ENEMY = {
  sprayer:     { hp: 40, speed: 2.5, canShoot: true,  canMove: true,  climbsGreen: false, drainsPaint: false },
  charger:     { hp: 30, speed: 5.0, canShoot: false, canMove: true,  climbsGreen: false, drainsPaint: false },
  wallCrawler: { hp: 45, speed: 3.0, canShoot: true,  canMove: true,  climbsGreen: true,  drainsPaint: false },
  turret:      { hp: 70, speed: 0,   canShoot: true,  canMove: false, climbsGreen: false, drainsPaint: false },
  drainer:     { hp: 20, speed: 4.0, canShoot: false, canMove: true,  climbsGreen: false, drainsPaint: true  },
};

// Difficulty = new rules, not bigger health bars.
// null = anything hurts it. [] = no combo needed.
export const DEFENCE = {
  1: { requiredColour: null,  combo: [] },
  2: { requiredColour: 'red', combo: [] },
  3: { requiredColour: null,  combo: ['blue', 'red'] },
};

export const WAVES = { count: 8, baseEnemies: 6, growthPerWave: 3 };
