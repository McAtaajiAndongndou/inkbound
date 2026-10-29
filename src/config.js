// Every colour and tuning number lives here.
// If you are about to type a magic number into another file, it belongs here.

// Paint ids are ALSO the indices written into the paint data texture.
// 0 = grey (unpainted). Do not reorder without updating the shader.
export const PAINT_IDS = { grey: 0, blue: 1, red: 2, green: 3 };

// `grey` is not a paint colour, it is the ABSENCE of one: the colour of the
// world before the player paints it. It is read by the ground shader
// (uColours[0]) and by the HUD's ammo bar, so it is one value with one meaning.
//
// It used to be 0x5a5a66 -- a blue-violet grey -- which was fine in isolation
// and wrong the moment the level had a forest in it: the drained decor is a
// grey-GREEN (DECOR.tint, 0x4f5a4d), so the floor read as a different world
// from the things standing on it. The plan flagged this in step 1 ("that is
// blue-grey, not forest grey") and it sat unaddressed because the instanced
// props were not rendering, so there was nothing for the floor to disagree with.
//
// 0x585e54 is the same drained family as the foliage, a little LIGHTER, so a
// rock slab (which uses the decor tint) still separates from the floor it lies
// on rather than disappearing into it.
export const PAINT = {
  grey: { id: 0, hex: 0x585e54, name: "Grey" },
  blue: { id: 1, hex: 0x3aa7ff, name: "Ice" },
  red: { id: 2, hex: 0xff4d5a, name: "Bounce" },
  green: { id: 3, hex: 0x4ee08a, name: "Grip" },
};

// Colour -> physics. This object IS the game.
//   friction    how fast ground speed bleeds away (per second)
//   traction    multiplier on PLAYER.accel while standing here (low = can't turn)
//   speedScale  how much extra speed this surface grants. You keep a BOOST after
//               you leave, and a lower value never takes a boost away (red's 1.0
//               means "no boost", not "back to base"). See #52.
//   standSlow   LIVE speed multiplier, applied only while standing on this
//               surface. Unlike speedScale this is not sticky: it applies this
//               frame and drops the moment you leave. This is how grey penalises
//               you without being erased by the first blue patch you touch (#74).
//               1.0 = no penalty.
//   restitution > 0 makes the surface a trampoline (see PLAYER.minBounce)
//   climbable   walls of this colour can be climbed
export const SURFACE = {
  grey: { friction: 10.0, traction: 1.0, speedScale: 1.0, restitution: 0.0, climbable: false, standSlow: 0.6 }, // Corrupt Corp's territory — live penalty (#74)
  blue: { friction: 0.4, traction: 0.5, speedScale: 1.6, restitution: 0.0, climbable: false, standSlow: 1.0 }, // ice: slide, hard to steer
  red: { friction: 10.0, traction: 1.0, speedScale: 1.0, restitution: 0.9, climbable: false, standSlow: 1.0 }, // bounce
  green: { friction: 14.0, traction: 1.0, speedScale: 1.0, restitution: 0.0, climbable: true, standSlow: 1.0 }, // grip + climb
};

export const PLAYER = {
  radius: 0.4,
  height: 1.7,
  accel: 55, // ground acceleration
  airAccel: 12,
  maxSpeed: 7,
  jumpSpeed: 8.5,
  gravity: -26,
  climbSpeed: 4.5,
  climbPushThreshold: 0.25, // how directly you must push into a green wall to climb (0..1)
  wallJumpPush: 3.5, // jumping off a climb pushes you this fast away from the wall
  eyeHeight: 1.5,
  minBounce: 15, // red is a trampoline: standing on it launches you (~4.3m)
  lookSensitivity: 0.0022,
  killY: -20, // fall below this and you respawn
  adsSensitivityMultiplier: 0.6,
  adsSpeedMultiplier: 0.5,

  // jump feel (#33)
  coyoteTime: 0.1,        // seconds after leaving a ledge you can still jump (~6 frames at 60fps)
  jumpBufferTime: 0.12,   // seconds before landing a jump press is remembered

  // collision tolerances
  groundProbeLift: 0.5, // ground probe starts this far above the feet
  groundProbeRange: 6, // how far below that it looks for a floor
  groundSnap: 0.02, // within this of the floor counts as landed
  bounceClearance: 0.05, // lift off red by this so the bounce does not re-hit
};

// Avatar animation state machine (#82).
//
// The blends are deliberately short. The pose has to swap on the FRAME the
// physics does, or the avatar spends the first tenth of a jump still running —
// which is the bug this exists to fix, reintroduced as a fade. 0.1 s is the
// ceiling the issue sets; the air blend goes under it because falling has no
// anticipation to it.
export const ANIM = {
  blend: 0.1,     // ground transitions: idle <-> run
  airBlend: 0.08, // into and out of jump / fall / land
  riseSpeed: 0.1, // m/s of upward velocity that counts as RISING, not falling
  climbBlend: 0.12,
  climbCycle: 0.9,
  landMinTime: 0.18,

  // #124 — the combat poses. Three fades, each for a different job:
  //   aimBlend  raising and lowering the gun. Slower than a step so the body does
  //             not snap, fast enough that the pose still tracks the button.
  //   fireBlend short on purpose: a shot that faded in over 0.1 s would read as a
  //             pose change rather than as a reaction to the trigger.
  //   hitBlend  a flinch arrives faster than it leaves, which is the reason only
  //             the way IN is here — the way out reuses `blend`.
  aimBlend: 0.12,
  fireBlend: 0.04,
  hitBlend: 0.06,

  // #124 — the viewmodel bob. The first-person gun sways sideways as the player
  // walks; the numbers are deliberately small, because a viewmodel that swings
  // reads as the camera being loose rather than as the player having weight.
  viewBob: 0.012,       // metres at full stride
  viewBobSpeed: 9,      // radians of sway per second
};

// Camera rig (#34). TPV is the default; FPV is the V toggle / ADS target.
export const CAMERA = {
  tpvDistance: 5.0,        // how far behind the player the third-person camera sits
  tpvShoulder: 0.9,        // right-vector offset, so the player does not block the view
  tpvHeight: 0.45,         // vertical offset above the player's chest

  // Tightened for #39 #8 — Renda: "I look at the sky or floor too easily".
  //
  // HOW THE RIG USES PITCH, because it is not the usual sign convention and it is
  // why the old range felt wrong: the camera's own height is
  // `(sin(pitch) + tpvHeight) * tpvDistance`, and the aim point is
  // `eyeHeight + tan(pitch) * 12`. So NEGATIVE pitch (looking down) puts the camera
  // BELOW the player while the aim point dives at the floor.
  //
  //   old max  1.20 rad = +69 deg up    -> the camera is flung 6.9 m overhead
  //                                        aiming nearly straight up
  //   old min -0.60 rad = -34 deg down  -> the camera is at foot level (the
  //                                        minHeightAboveFeet clamp below caught
  //                                        it) aiming steeply into the ground
  //
  // Both extremes degenerated, and 69 degrees up is far more sky than a
  // third-person shooter needs. The new range is a shooter's: roughly 24 degrees
  // down and 31 degrees up, which keeps the camera behind and above the player at
  // every angle instead of throwing it over the top or dropping it to the floor.
  pitchMin: -0.42,         // how far down the camera can look (radians, ~-24 deg)
  pitchMax: 0.55,          // how far up (radians, ~+31 deg)

  // Raised from 0.3 for the same reason, and this one is the bigger half of the
  // fix: 0.3 above the feet is a floor-skimming camera, and it is where a
  // look-down shot always ended up because the offset above goes negative long
  // before pitchMin does. 1.1 only ever engages on those extremes — at neutral
  // pitch the camera sits 2.25 m up — so it changes the down-look and nothing else.
  minHeightAboveFeet: 1.1, // camera never dips below player.position.y + this

  adsFov: 45,
  normalFov: 70,
  adsTransitionSpeed: 10,
};

// Player health. Enemies deal their ENEMY.*.contactDamage on touch.
export const HEALTH = {
  max: 100,
  hurtCooldown: 0.8,  // seconds of invulnerability after a hit, so contact is not 60 hits/sec
  contactRange: 1.0,  // enemy centre within this (horizontal) distance of the player = touching
  contactHeight: 1.7, // ...and within this vertical distance
};

// Traps: authored meshes plus ONE damage-volume helper (`docs/DECISIONS.md`,
// 2026-10-24). This block is not a trap table -- each level still owns the shape
// it hurts you with. It holds only the numbers a hazard would otherwise hardcode,
// and the colours that make a hazard legible.
export const TRAP = {
  // Amber is the only danger colour in the game (DECISIONS.md), because it is not
  // one of the three paint colours: nothing you are able to paint is a warning.
  amber: 0xd98a2b,
  bed: 0x1c1a17,       // the dark recess, so the spikes read against the floor

  spike: {
    damage: 15,        // a hit, not a kill: seven of them at full health
    cooldown: 1.0,     // seconds between hits on the SAME target, not per frame
  },

  // The paint vent (Outskirts, island C): erupts on grey, goes dead on your paint.
  // One eruption is one hit: the cooldown only runs while the column stands, so
  // it equals `erupt`.
  vent: {
    damage: 20,
    cooldown: 1.0,
    rest: 2.0,         // seconds idle between eruptions
    tell: 0.8,         // seconds of amber pulse before it erupts — the tell
    erupt: 1.0,        // seconds the column stands and hurts
    height: 3.0,       // the column, and the hurting region above the grate
    coverage: 0.5,     // share of the grate that must be player paint to kill it
  },
};

// Outskirts' grey-world mood (polish pass 1). DRAINED, NOT DARK: a pale, bleached
// overcast with low contrast, so the grey reads as colour taken away rather than
// as a night scene. The level file explains what each band does.
export const OUTSKIRTS = {
  mood: {
    horizon: 0x9ba1a6,   // the haze; matches the sky's horizon band and the mist
    zenith:  0x4d5560,   // overhead: washed out, not navy
    void:    0x1a1c21,   // below the horizon: the pits stay dark
    fogNear: 8,
    fogFar:  46,
    fillColour: 0xb4bcc2,
    fillIntensity: 0.55,
  },

  // The toxic waste. Muted from lime (0x86b32d) in polish pass 1: lime was the
  // most saturated colour in an unpainted frame and sat close to green paint
  // (PAINT.green), so the poison out-shouted the player's paint. A sickly olive
  // reads as poison, not as paint.
  waste: {
    colour: 0x7a7d34,
    emissive: 0x1b1c06,  // a little self-lit, so it still reads as something not to touch
  },

  // The Ledge reveal: reaching the extraction ledge re-reads every prop in the
  // level, and a prop within `radius` of the player's paint takes that colour.
  reveal: {
    radius: 2.5,         // metres from the prop to the nearest paint that counts
    ring: 8,             // samples on that circle, plus the prop's own spot
  },
};

export const PAINT_GUN = {
  range: 30,
  radius: 1.4,
  cost: 4,
  fireDelay: 0.14,
  hipSpread: 0.025,
  adsSpread: 0.005,
  refillRate: 8,

  damage: 10,
  splashRadius: 1.4,
  splashFraction: 0.5,
};

// Starting master volume (0..1). The options menu overrides it per player.
export const AUDIO = {
  volume: 0.6,
};

// Options-menu ranges. Sensitivity is a multiplier on PLAYER.lookSensitivity.
export const OPTIONS = {
  sensitivityMin: 0.25,
  sensitivityMax: 3,
};

export const PAINT_GRID = {
  level0Cells: 4,   // the Primer: the same density every level uses
  level1Cells: 4,
  level2Cells: 4,   // the Ascent: same density, so a splat is the same size on every face
  level3Cells: 4,   // Last Colour: same again — a Drainer eats the same cells everywhere
};

/**
 * Enemy movement rules that are not about one enemy type.
 *
 * `maxStepDown` — how far an enemy will step DOWN without refusing the move.
 *
 * The probe already refuses a step with NO floor under it, which is what keeps an
 * enemy on its island. It does not refuse a step onto a floor that happens to be
 * much lower, and that is a real hole: an enemy standing on a raised platform walks
 * straight off the edge and drops to whatever is below. Renda, on the two shooters
 * on island C's pillar: "yeah the shooters do walk off".
 *
 * One metre allows a kerb and refuses a storey, which is the distinction that
 * matters — and knockback still bypasses the probe entirely, so a red hit can still
 * fling an enemy off a ledge. That is deliberate (the environmental kill the design
 * asks for) and it is why this is a rule on WALKING rather than a leash.
 */
export const ENEMY_NAV = {
  maxStepDown: 1.0,
  // How fast an enemy falls when it is over a floor far below its feet — i.e.
  // something (knockback, a blue slip) carried it off a ledge. Not a physics
  // system: enemies have no gravity, and this only runs when the ground under
  // them is more than `maxStepDown` below, which normal walking never allows.
  fallSpeed: 18,
};

// Awareness (#109). The shared substrate from `docs/enemies/algorithms.md`
// § Awareness — Dormant / Alert / Search, and the numbers that separate them.
//
// These are DETECTION numbers, not attack numbers. `ENEMY.*.attackRange` still
// decides when a shot is fired; this decides whether the enemy knows there is
// anything to shoot at, which is why the radii here are larger than every
// attack range in the game.
//
// Every enemy uses this. The turret is the one exception and it is declared as
// data (`ENEMY.turret.ignoresStealth`) rather than checked by name, because a
// machine that tracks you through a wall for a reason is a rule, and a rule
// spelled `type === 'turret'` is a rule hidden in a conditional.
export const AWARENESS = {
  radius: 16,          // m, against a standing (dry or wet) player
  submergedRadius: 7,  // m, against a submerged player — halved, not zero
  fireAlert: 3,        // s of Alert bought by firing, regardless of submerge
  forget: 6,           // s a last known position is remembered, then Dormant
  arrive: 1.2,         // m: close enough to the last known position to stop
  eyeHeight: 1.4,      // m above the feet — the height a sight line is drawn at
};

// Wall-crawler climbing (#115). From `docs/enemies/algorithms.md` § Wall-crawler.
//
// The two speeds are the whole feature: a wall-crawler on a face you painted
// green is FASTER than the 4.5 m/s you climb at, and on bare grey it is slower.
// That is the design's "your route is its route" — painting green to get up
// somewhere is always a decision with a cost, because the thing that follows you
// up the same face does it quicker.
//
// The speeds live here rather than on `ENEMY.wallCrawler` because they are read
// off the PAINT under the crawler every frame, not off the enemy. It can start a
// climb on grey and finish it on green: the face is the object being read, which
// is the same rule the player's own climb follows.
export const CLIMB = {
  grey: 3.5,        // m/s up, down or sideways on an unpainted face
  green: 5.0,       // m/s on green — faster than the player's PLAYER.climbSpeed
  reach: 1.6,       // m: how far in front of itself it can grab a face
  gap: 0.4,         // m kept between the body and the face, so it is not inside it
  verticalGap: 1.0, // m: the player has to be this much higher/lower to be worth climbing to
  dropRange: 2.5,   // m: close enough to the player (and above) to let go
  gravity: 18,      // m/s² accelerating a fallen crawler — its own, not the player's
  maxFall: 14,      // m/s cap, so a long drop cannot tunnel through a floor in one step
};

// Stalker (#120). The second enemy whose speed is a property of the GROUND
// rather than of itself — the wall-crawler above was the first, for climbing.
//
// WHY THE GROUND: the Stalker punishes you for being WET. Every other enemy in
// the game punishes you for being dry; this one is fast inside the territory you
// painted and slow on grey, so the counterplay is to give up your own ground and
// walk on the boring stuff. That only works if the difference is brutal rather
// than a tweak — a stalker merely "slightly slower" on grey reads as noise, and
// the player never deduces the rule (the design note is explicit: never tell
// them).
//
// The speeds live here, not on `ENEMY.stalker`, for the same reason CLIMB does:
// they are read off the paint under the crawler every frame. It can start a
// chase on green and finish it on grey.
//
// `lungeWindup` is the telegraph, and it is the whole counterplay: the heading is
// captured when the telegraph ENDS, so a sidestep during those 0.4 s makes it
// commit to empty ground. `lungeRecovery` is what that miss costs it.
//
// Ratios worth checking against PLAYER.maxSpeed (7.0): 6.0 on your paint means a
// SPRINTING player still outruns it, and 2.0 on grey means a WALKING one does.
// If the manual check reads wrong, this pair is the dial.
export const STALKER = {
  paintSpeed: 6.0,      // m/s on anything the player has painted
  greySpeed: 2.0,       // m/s on unpainted ground
  lungeWindup: 0.4,     // s of telegraph before it commits
  lungeSpeed: 7.5,      // m/s during the commitment — faster than it can run
  lungeTime: 0.5,       // s committed; reach is speed x time, 3.75 m
  lungeRecovery: 0.8,   // s planted after a MISS. A hit costs it nothing but time
  lookahead: 2.5,       // m: how far ahead it sniffs the ground for paint
  fan: [0, 0.3, -0.3, 0.6, -0.6, 0.9, -0.9], // rad, in preference order
};

// Level 1 plentiful, level 2 starved, level 3 contested.
export const AMMO = {
  1: 100,
  2: 60,
  3: 80,
};

// One enemy class, five configs. Not five systems. (Week 2.)
//
// windup / attackRange / attackCooldown drive the attack telegraph (#40).
//
// attackRange is for enemies that ATTACK FROM RANGE. `_updateAttack` starts a
// windup as soon as the player is inside it, and `startTelegraph` PLANTS the
// enemy while it winds up — which is right for a shooter and fatal for a
// charger. See the note on `charger` below.
export const ENEMY = {
  sprayer: {
    hp: 40,
    speed: 2.5,
    canShoot: true,
    canMove: true,
    climbsGreen: false,
    drainsPaint: false,
    // The ground it turns grey, in metres, WHERE ITS SHOT LANDS (#107).
    // Zero/absent means it never touches the grid — which is every other
    // enemy here except the Drainer, whose grey comes from eating instead.
    greyRadius: 1.5,
    contactDamage: 10,
    attackDamage: 10,   // per shot; wired to player.takeDamage in main.js
    windup: 0.6,
    attackRange: 12,
    attackCooldown: 2.5,
    stopDistance: HEALTH.contactRange + 0.2,
  },

  // NO attackRange, deliberately — and this is the one stat here that is not a
  // taste call.
  //
  // The Charger's attack IS its charge: `canShoot` is false, it deals
  // `contactDamage` on touch, and DESIGN.md's teaching beat for island B is
  // "paint blue and it slides straight past you". Giving it an attackRange of 8
  // meant it began winding up the moment the player got within 8m, and a windup
  // PLANTS the enemy (`this._vel.set(0, 0, 0)` in startTelegraph) — so it stood
  // still at range and never charged at all. Island B's Charger fight, the
  // level's main teaching beat, silently stopped happening.
  //
  // That was caught by `tests/level-contract.test.js` -> "on blue a Charger
  // commits to its heading and slides past a sidestep", which was failing on
  // main. The test drives the Charger for 30 frames and then reads its heading;
  // with the plant it never had one, so the heading was the zero vector.
  //
  // The Charger still telegraphed in spirit: a fast grey soldier in a committed
  // straight line is its own tell. If #40 wants a windup on it, the windup must
  // not stop the charge — a plant that discards momentum is the wrong primitive
  // for a chaser. windup/attackCooldown are left in place for that.
  charger: {
    hp: 30,
    speed: 5.0,
    canShoot: false,
    canMove: true,
    climbsGreen: false,
    drainsPaint: false,
    contactDamage: 25,
    windup: 0.5,
    attackCooldown: 3,
    // Melee: walk up and STOP at contact range rather than continuing through the
    // player and turning round. See the `holding` note in _tick (#39).
    stopDistance: HEALTH.contactRange + 0.2,
    // #76: the third beat. A charge ends by arriving on the player, by a wall or
    // ledge, by 8 m travelled or by 2 s committed (enemy.js), and then the
    // Charger stands still and takes full damage for this long. That turns the
    // fight into bait -> dodge -> punish. If the window feels too generous,
    // shorten THIS before touching anything else; if it still feels unfair, the
    // windup is too short — not the recovery.
    recovery: 1.2,
  },
  wallCrawler: {
    hp: 45,
    speed: 3.0,
    canShoot: true,
    canMove: true,
    climbsGreen: true,
    drainsPaint: false,
    contactDamage: 10,
    attackDamage: 10,   // same as the Sprayer: one wound-up shot
    windup: 0.6,
    attackRange: 12,
    attackCooldown: 2.5,
    stopDistance: HEALTH.contactRange + 0.2,
  },
  turret: {
    hp: 70,
    speed: 0,
    canShoot: true,
    canMove: false,
    climbsGreen: false,
    drainsPaint: false,
    // A machine does not get fooled by paint (#109). It never searches, never
    // goes dormant, and is not halved by submerging: it tracks you whenever you
    // are inside its attackRange. Out of scope for the enemies lane to change —
    // this flag is how the rule is stated, not how the turret is built.
    ignoresStealth: true,
    contactDamage: 0,
    attackDamage: 12,   // the hardest single shot: it is the positioning tax
    windup: 0.8,
    attackRange: 15,
    attackCooldown: 3,
    // #77 — THE MATRIX GAP (ENEMIES.md). The turret is the one enemy that paint
    // does not solve: freeze, pin and knockback do nothing to it and the three
    // colours are just damage. The answer is line of sight and flanking, and
    // that only holds if the procs GENUINELY do nothing — a turret you can
    // freeze is just another enemy with a slower answer.
    //
    // `canMove: false` alone was not enough. Red's knockback is applied in the
    // windup branch too, so a red hit shoved a turret sideways mid-telegraph;
    // the flag is what makes the promise unconditional.
    noProcs: true,
  },
  // THE TERRITORY EATER (#80). `drainsPaint` was a flag with no behaviour until
  // the drain below it existed; these are the numbers behind it.
  //
  // WHY IT EXISTS AT ALL: paint is positive feedback — the player paints, gets
  // faster and better armed, and the arena becomes theirs. Left alone that makes
  // the climax trivial, so one enemy has to take it back.
  //
  //   drainRadius    how far it reaches. A cell outside this is a cell it is NOT
  //                  touching, which is a rule, not an optimisation: the manual
  //                  check is "watch the patch shrink from the enemy outward".
  //                  1.6 m is one paint splat (PAINT_GUN.radius 1.4) plus a step.
  //   drainRate      painted cells per second, at 4 cells/m (PAINT_GRID.level1Cells)
  //                  that is 16 / 16 = 1 m² of painted ground per second. This is
  //                  the difficulty dial for the whole final level: tune it LAST,
  //                  once the waves exist, and write the number down in ENEMIES.md.
  //   huntRadius     the player this close interrupts the feed: it stands up.
  //   resumeRadius   ...and it only lies back down past this. The 6 m gap between
  //                  the two is deliberate hysteresis — one threshold would flip
  //                  the posture every other frame on the boundary.
  drainer: {
    hp: 20,
    speed: 4.0,
    canShoot: false,
    canMove: true,
    climbsGreen: false,
    drainsPaint: true,
    drainRadius: 1.6,   // metres it can reach into the grid
    drainRate: 16,      // painted cells eaten per second (1 m²/s at 4 cells/m)
    huntRadius: 8,      // player closer than this -> stands up and hunts
    resumeRadius: 14,   // player further than this -> back down to feed
    contactDamage: 5,
    windup: 0.5,
    attackRange: 3,
    attackCooldown: 2.5,
    stopDistance: HEALTH.contactRange + 0.2,
  },

  // THE STALKER (#120). The only enemy that attacks the loop from the other
  // side: it is fast on YOUR paint and slow on grey, so the escape is to give up
  // your own territory. See the STALKER block above for the speeds and the lunge.
  //
  // Three flags carry the whole identity:
  //   surfaceSpeed  its speed comes from the ground, not from `speed` below
  //   prefersPaint it steers to stay inside your territory, even when a grey
  //                 line would be shorter — the preference has to be visible or
  //                 the speed rule looks like a random fast thing
  //   lunges        its telegraph is a lunge, not a shot (`_commitLunge`)
  //
  // `speed` is only a fallback for anything reading a single number (gait, the
  // charge tracker); the walk speed is `_moveSpeed`.
  //
  // NO `noProcs`: freeze, pin and knockback all work on it, as they do on
  // everything except the turret — tests/turret-no-procs.test.js pins that
  // turret-only exemption and would fail if this block opted out.
  //
  // NO stealth or fade anywhere: the design note is that an enemy which is both
  // faster than you and invisible where you feel safe is unfairness, not tension.
  stalker: {
    hp: 30,
    speed: STALKER.greySpeed,
    canShoot: false,
    canMove: true,
    climbsGreen: false,
    drainsPaint: false,
    surfaceSpeed: true,
    prefersPaint: true,
    lunges: true,
    contactDamage: 20,
    // The telegraph IS the lunge windup, and the range is exactly "close enough
    // to arrive": reach (speed x time) plus contact range. Bigger and it commits
    // from a distance it cannot cover, which reads as a bug rather than a miss.
    windup: STALKER.lungeWindup,
    attackRange: STALKER.lungeSpeed * STALKER.lungeTime + HEALTH.contactRange,
    attackCooldown: 1.8,
    stopDistance: HEALTH.contactRange + 0.2,
  },
};
// Enemy grey conversion (#107).
//
// Grey is a FACTION COLOUR (ADR-0002), not the absence of paint: an enemy taking
// ground is the gun's operation run in reverse. This block is the shape of that
// operation for enemies that do it at RANGE. The radius is NOT here — it is per
// enemy (`ENEMY.sprayer.greyRadius`) because a rifle and a slam should not share
// one number, and Big Arm's slam will carry its own wider one in its own entry
// when `boss.js` stops being a stub.
//
// HOW THE IMPACT IS FOUND, because that is the whole of the issue: the shot is a
// RAY from the enemy's muzzle to the ground the player is standing on, and the
// FIRST surface that ray reaches is the one that greys. That single "first hit
// wins" rule is what stops the conversion passing through a wall or through a
// raised floor — and it means an unpaintable gate in the way eats the shot
// instead of letting it through to the ground behind it.
//
// RATE: there is no separate timer. The enemy already has an attack cooldown
// (2.5 s for the Sprayer), so one attack is one splat and nothing here can
// outpace the thing that triggers it.
export const GREY_IMPACT = {
  muzzleHeight: 1.2, // metres above the enemy's feet the ray starts at
  reach: 2,          // metres past the target it keeps looking, so the target cell is tested
};

// Difficulty = new rules, not bigger health bars.
export const DEFENCE = {
  1: { requiredColour: null, combo: [] },
  2: { requiredColour: "red", combo: [] },
  3: { requiredColour: null, combo: ["blue", "red"] },
};

export const BLUE_FREEZE = {
  hitsToFreeze: 3,
  buildupWindow: 2.0,
  critWindow: 2.0,
  armDelay: 0.25,
  criticalMultiplier: 3,
  buildupDamageScale: 0.4,
  shellRadius: 0.72,
  shellHeight: 0.95,
  shellOpacity: 0.55,
  buildupOpacity: 0.12,
};

// Dry out (#75). The player is dry when the tank is empty and no cell under
// them is theirs. This declares the loss rather than leaving them stuck.
export const DRY_OUT = {
  warningBelow: 0.25,   // tank % under which the HUD pulses the ammo bar
  graceTime: 1.0,       // seconds of continuous dry state before the run ends
};

// Submerge (#108). The commitment half of the loop: standing on your own paint
// refills you slowly and you can still fire; submerging is faster to move
// through, faster to refill, and you CANNOT FIRE.
//
// The trade is the whole feature. Without it, paint is just a resource. With
// it, "do I stay standing or do I commit?" is the question every fight asks.
//
// All numbers live here so the tuning dial is one file.
export const SUBMERGE = {
  key: 'ShiftLeft',          // hold this key to submerge (coordinate with team)
  speedMultiplier: 1.4,      // faster than normal walking — the reward for committing
  refillMultiplier: 3,       // 3× the base PAINT_GUN.refillRate
  cameraOffset: 0.9,         // metres the TPV camera drops, so you read as "in" the paint
  maxAngle: 1.1,             // radians — how far the camera tilts down while submerged
};