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

// #126 — ONE danger colour for the whole game (DECISIONS.md): attack
// telegraphs, trap warnings, incoming fire. Amber is chosen precisely because
// it is not a paint colour, so nothing the player can paint is ever a warning
// and nothing dangerous ever shares a colour with something helpful.
export const DANGER = {
  amber: 0xffe600,
};

// #156 — how a SEALED (unpaintable) face reads before anyone shoots it.
//
// A wall that refuses paint and a wall that takes it used to be drawn
// identically: the same grey grid, so the only way to find a climb was to shoot
// and see where the green stuck. The difference is TEXTURE, never colour
// (issue #156 design note, ADR-0002 "grey is Corrupt Corp's"): a sealed face
// keeps the same grey, but its grid is broken into panels with dark seams and
// a rivet at every seam corner. Nothing here introduces a hue, so nothing here
// can ever be mistaken for a paint colour or for the danger amber.
//
// All four numbers live in PANEL space, where one unit is one panel — a panel
// is `panelsPerSquare` to a visible grid square. Tune here.
export const SEALED = {
  panelsPerSquare: 2,   // panels across one visible grid square
  seamDepth: 0.22,      // fraction a seam line darkens the panel face
  seamWidth: 0.06,      // seam line half-width, panel space
  rivetRadius: 0.05,    // rivet dot radius, panel space
  rivetLift: 0.12,      // fraction a rivet brightens the panel face
};

// Traps: authored meshes plus ONE damage-volume helper (`docs/DECISIONS.md`,
// 2026-10-24). This block is not a trap table -- each level still owns the shape
// it hurts you with. It holds only the numbers a hazard would otherwise hardcode,
// and the colours that make a hazard legible.
export const TRAP = {
  // The trap warning IS the game-wide danger amber -- one value, defined once
  // in DANGER, not a second amber chosen per system.
  amber: DANGER.amber,
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

  // The Primer's spike pit (R6, #101). It teaches "this place is dangerous"
  // without killing (issue #79): a hit never takes the last `spare` health.
  pit: {
    spare: 1,          // health a pit hit always leaves behind
    spikeHeight: 0.3,  // how far a spike pokes through the floor
    spikeRows: 4,      // across the pit's depth (z), a spike every ~1 m
    sag: 0.07,         // radians the edge boards tilt toward the pit: the tell
    bedOpacity: 0.45,  // the dark recess; see-through so blue paint still reads
  },
};

// Outskirts' grey-world mood (polish pass 1). DRAINED, NOT DARK: a pale, bleached
// overcast with low contrast, so the grey reads as colour taken away rather than
// as a night scene. The level file explains what each band does.
export const OUTSKIRTS = {
  // The goal you can see (campaign flow, 30 Oct): a mast and beacon just past
  // the back of the extraction ledge (y 12, z −45), the same landmark the
  // Ascent's lift tower and Last Colour's Siphon carry. Behind the ledge, so it
  // is never in the walk; it has no collider.
  beacon: { x: 0, z: -46.5, mastFrom: 0, top: 19.5, mastColour: 0x4a5058, colour: 0xffd23f },
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

// The Primer's mood and dressing (polish pass 1). Borrowed from Outskirts'
// drained overcast and nudged WARM: this is the rebels' own course, so its air
// is dusty daylight, not the Corp's bleach. Same rules as OUTSKIRTS.mood: fog
// matches the horizon band, never the whole sky (see src/levels/mood.js).
export const PRIMER = {
  mood: {
    horizon: 0xa59f94,   // warm dust haze
    zenith:  0x56606b,
    void:    0x1c1b1a,
    fogNear: 10,         // clears the TPV camera; a room is ~12-30 m deep
    fogFar:  58,         // the next room is hazy, the one after is gone
    fillColour: 0xc4bdb0,
    fillIntensity: 0.55,
  },
  // Training-course dressing: lane markings are chalk, NOT paint — cream is
  // none of the three paint colours, so a marking never reads as ice or bounce.
  dressing: {
    chalk: 0xd9cfb6,
    lineWidth: 0.15,
    crate: 0x8a6a45,     // rebel timber
  },
};

// Last Colour (polish pass 1): the Corp facility's mood, prop kit and crusher.
export const LAST_COLOUR = {
  // Sickly amber interior (#125): the haze is the colour of old warning lamps.
  mood: {
    horizon: 0x6e5c3c,   // amber haze, dimmed: the far end of a room goes brown
    zenith:  0x2b2721,
    void:    0x141210,
    fogNear: 14,         // clears the TPV camera; the hangar is 38 m deep
    fogFar:  72,         // the Core's far wall (52 m) is hazy, never gone
    fillColour: 0xd9a650,
    fillIntensity: 0.5,
  },
  // Props are GREY ONLY: colourless machinery nobody maintains. Colour belongs
  // to the player; the one exception is the amber warning light (DANGER.amber).
  props: {
    crate: 0x5d5f62,
    barrier: 0x8a8c8f,
    pipe: 0x46494d,
    rail: 0x6c6f73,
    lightOff: 0x4a4430,  // an amber lamp that is not lit
    // A Corp work light: cold white, NOT amber. Amber means "this hurts"
    // across the campaign; a floodlight only says "here", so it marks a route.
    floodlight: 0xe6eeff,
    blinkRate: 6,        // rad/s: the warning lamps' on/off rhythm
    maxFloorHeight: 1.2, // no prop on an arena floor hides a Drainer at 20 m
  },
  // The cargo crusher in the corridor (#33): a fixed rhythm, read off the lamp.
  crusher: {
    period: 3.6,         // seconds per cycle
    downFor: 1.2,        // seconds of each cycle the head is down (the beat)
    warnFor: 0.7,        // seconds before the drop the lamp blinks (the tell)
    damage: 40,          // a hard hit, not a kill: three beats from full
    cooldown: 1.0,
    headHeight: 2.4,     // the head's own height; it rises to the box's top
    hurtHeight: 2.2,     // the hurting region, from the floor up
  },
  // The Siphon (#100): the final exam. Three phases, one colour each, read by
  // the share of a plate in that colour — never by damage (docs/levels/03-last-colour.md, R5).
  siphon: {
    revealFor: 2.0,      // seconds a target shows its colour and refuses paint: the tell before the test
    need: 0.5,           // share of a plate's samples in the right colour that solves it
    samples: 4,          // a samples x samples grid per plate; one centred shot covers 12 of 16
    pulseRate: 8,        // rad/s: the frame's pulse while a target is open
    frameMargin: 0.35,   // metres the coloured frame shows round each plate
    intake: { size: 3, vaneSpin: 6 },
    arm: { size: 2, reach: 3, beam: 0.5, thrashAmp: 1.6, thrashRate: 2.2 },
    core: { size: 2.5, shutterRise: 3.2 },
    spillRadius: 3.5,    // the pool of the phase's colour it leaks at its foot (the refill, and a second tell)
    finaleFor: 2.5,      // seconds the core takes to sink into the machine before the win
    knockDepth: 2.5,     // metres it sinks
    frost: 0xe8f6ff,     // a frozen intake's frame
    dim: 0x3a3d42,       // a frame between pulses, and a solved arm's
    vane: 0x2e3135,
  },
};

// The Ascent (polish pass 1): cold dawn, the collapsing catwalk (#102), and the
// base on the horizon.
export const ASCENT = {
  // Cold dawn (#125): thin, clear mountain air. The fog is FAR, because this
  // level is about seeing the goal — the lift beacon is 76 m from the trailhead
  // and has to read the whole climb. Same sun as every level (the scene light is
  // core's), so the dawn is the sky and the fill, not a moved sun.
  mood: {
    horizon: 0xc9c2c4,   // pale rose-grey: first light, nothing warm yet
    zenith:  0x4c5c74,   // cold slate blue overhead
    void:    0x1d2129,   // the drop below the ridges
    fogNear: 30,         // the room you are in is crisp
    fogFar:  170,        // the far side of the mountain is haze, the tower is not
    fillColour: 0x9fb4d6,
    fillIntensity: 0.6,
    skyRadius: 450,      // past the base (~245 m), so the dome is behind it
  },
  // The collapsing catwalk (#102): "can you cross before it drops?"
  catwalk: {
    // A segment goes this long after you first step on it, whether or not you
    // are still there. At PLAYER.maxSpeed a 4 m segment takes 0.57 s, so a run
    // always makes it and a stop to shoot never does.
    delay: 0.9,
    reformAfter: 5,      // seconds until a fallen segment is back (the scree-return climb takes longer)
    shake: 0.05,         // metres of jitter while it is going: the tell
    flashOpacity: 0.55,  // the amber flash over the walking surface; see-through so paint still reads
    fallGravity: 26,     // m/s² the falling slab drops with (PLAYER.gravity's size)
    fallFor: 1.2,        // seconds the falling slab is drawn before it hides
    standBand: 0.35,     // feet within this above a segment count as standing on it
  },
  // The base: a silhouette on the summit horizon, unfogged so it stays a shape
  // against the dawn instead of dissolving into it.
  base: { silhouette: 0x262b35 },
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

// Level tank sizes, keyed by REGISTRY ID (#155) — the same string a level uses
// everywhere else (`primer`, `outskirts`, `ascent`, `last-colour`). A numeric
// key is how this bug happened: `1` looked like "the default" rather than
// "Outskirts", and every level got Outskirts' 100.
//
// A fifth level must add its own entry — `tests/tank-per-level.test.js` walks
// `LEVELS` and fails if one is missing, so a new level cannot ship with an
// accidental fallback.
export const AMMO = {
  primer: 100,          // tutorial: same as Outskirts, explicitly
  outskirts: 100,       // plentiful
  ascent: 60,           // starved — 15 shots, every room tuned against it
  'last-colour': 80,    // contested
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
    attackCooldown: 2.5,  // unused while `reload` is set below — the reload IS the gap
    // #118 — the THIRD beat, and this enemy's whole counterplay
    // (docs/enemies/algorithms.md § Sprayer): AIM 0.6 s -> FIRE a burst of 3 ->
    // RELOAD 1.2 s, and the reload is the window that makes it punishable
    // rather than merely survivable.
    //
    // The Sprayer is also the territory enemy — each shot greys the ground —
    // so the reload is the moment you can safely step onto grey and repaint.
    // If the window is shorter than one splat plus a step back to cover, the
    // Drainer and the Sprayer together become a death spiral (the design note,
    // verbatim).
    //
    // For an enemy that declares `reload`, it REPLACES `attackCooldown` as the
    // gap: both would stack into a second wait with no tell on it, and the
    // point is one readable opening, not two silent ones.
    burst: 3,           // shots per burst
    burstGap: 0.12,     // s between shots INSIDE a burst (a burst, not a trickle)
    reload: 1.2,        // s of opening after the burst — THE window to repaint
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

  // BIG ARM (#99): Last Colour's arena boss (DECISIONS 2026-10-06: "L3 = zombies
  // + Big Arm"; 2026-10-30 for the design). Built in src/enemies/boss.js.
  //
  // DAMAGE DOES NOT KILL IT. `hp` counts COMBOS LEFT: blue freeze → green pin →
  // red knockdown, landed three times, one per phase. Each phase entry below
  // overrides the top-level numbers while that phase runs.
  bigArm: {
    hp: 3,
    speed: 1.6,
    canShoot: false,
    canMove: true,
    climbsGreen: false,
    drainsPaint: false,
    contactDamage: 20,
    attackDamage: 30,     // a slam that lands
    windup: 1.0,          // the slam's tell (algorithms.md: 1.0 s)
    attackRange: 4.0,     // it starts a slam with you inside this
    attackCooldown: 2.5,
    stopDistance: 2.6,
    slamRadius: 4.0,      // the grey it leaves, and the reach of the hit
    slamReach: 1.5,       // metres in front of it the slam lands
    pinFor: 3.0,          // combo step 2: seconds on one knee, waiting for red
    downFor: 2.5,         // combo step 3: seconds flat before the next phase
    grab: { range: 2.6, windup: 0.6, cooldown: 4.0, damage: 15, pull: 9 },
    phases: [
      {},                                                                   // 1: slow, the slam
      { speed: 2.6, windup: 0.9, attackCooldown: 2.0, grabs: true },        // 2: faster, the grab, two Drainers
      { speed: 3.2, windup: 0.7, attackCooldown: 0.4, grabs: true, ignoresPaint: true }, // 3: enraged
    ],
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
  refillMultiplier: 4,       // 4× the base PAINT_GUN.refillRate: 32/s, a full tank in 3.1 s (polish audit; was 3)
  cameraOffset: 0.9,         // metres the TPV camera drops, so you read as "in" the paint
  maxAngle: 1.1,             // radians — how far the camera tilts down while submerged
};
// Hit-stop (polish audit P1-1): seconds the simulation freezes, rendering on.
export const HIT_STOP = {
  kill: 0.04,       // any kill
  shatter: 0.08,    // the blue freeze-shatter crit: the game's best combo
  combo: 0.12,      // a Big Arm combo step landing
};

// Camera shake as trauma (polish audit P1-2): events add trauma 0..1, the
// shake is trauma squared, decaying linearly. Never on firing.
export const SHAKE = {
  decay: 1.6,          // trauma per second
  frequency: 22,       // how fast the shudder moves
  maxOffset: 0.3,      // metres, at full trauma
  maxRoll: 0.06,       // radians of roll at full trauma
  maxAngle: 0.035,     // radians of pitch wobble at full trauma
  kickDecay: 14,       // the hurt flinch's exponential decay, per second
  hurt: 0.35,          // medium: you were hit
  hurtKick: 0.045,     // radians the camera flinches up on a hit (P0-4)
  redBounce: 0.18,     // small: a hard landing on red flings you
  redBounceFall: 6,    // m/s of fall before a red landing counts as hard
  slam: 0.85,          // large: Big Arm's slam, at its centre
  slamRange: 16,       // metres over which the slam's shake fades to nothing
};

// Death returns colour (polish audit P1-4): a killed enemy bursts into a splat
// of the colour that killed it, as player paint — a kill becomes a refill pool.
export const DEATH_SPLAT = {
  radius: 1.8,
};

// Mantle (#157). A green climb ends by pulling the player onto the top
// surface — the missing move every climbing game has. Automatic, not a
// button: the player is already pushing into the wall, and a second input at
// the top is the clumsy moment this removes.
//
// Green stays the gate. A mantle replaces only the last ~0.85 m of a climb
// (the wall-contact test is at chest height, so the feet stop ~0.85 m short
// of the top), so it makes climbing SMOOTHER, not easier — the paint cost is
// unchanged. The reach below is the tune that decides how forgiving the
// last metre is.
export const MANTLE = {
  reach: 1.0,       // how far below the wall's top edge the feet must be for mantle to fire
  inward: 0.6,      // how far onto the top surface the player ends up
  duration: 0.25,   // seconds of the lift; instant enough that it never feels slow
};

// --- PAINTSTREAK (#131, PRD C7) ----------------------------------------------
// The reward for playing the loop well. New ground and kills fill a gauge, in
// that order of weight; doing several kinds of thing at once fills it faster
// than repeating one. A full gauge is spent (never auto-fired) on one large
// splat at your feet that claims the zone and stuns what stands in it.
//
// Target: a full gauge in ~90-120 s of normal varied play. Under a minute and
// it is a spammable button; much over three and nobody ever sees it. These are
// first numbers from arithmetic, not from a playtest — tune them here.
export const PAINTSTREAK = {
  key: 'KeyQ',               // spend. Unbound elsewhere (input.js, menu controls)
  max: 100,                  // the gauge; only a FULL gauge can be spent

  // Fill sources. Coverage is counted in newly painted cells: one splat claims
  // ~25 cells of fresh ground, so ~0.5 points a splat before variety.
  cellsPerPoint: 50,
  pointsPerKill: 3,          // a kill is worth ~6 splats of new ground: less than painting overall
  sampleInterval: 0.25,      // s between coverage scans — it is a grid scan, like the HUD's

  // Variety. Each channel — paint, kill, traverse — counts as "active" for
  // varietyWindow seconds after it last happened. Fill is multiplied by
  // 1 + varietyBonus × (active channels − 1): ×1 for one thing, ×2 for all three.
  // Traversal only ever counts toward variety; it fills nothing by itself.
  varietyWindow: 8,
  varietyBonus: 0.5,
  traverseSpeed: 3,          // m/s of horizontal movement that counts as traversing

  // The spend.
  zoneRadius: 6,             // m — the splat at your feet
  zoneHeight: 2.5,           // m above/below your feet a floor or enemy must be to count
  stunTime: 2.5,             // s an enemy in the zone stands still and cannot attack
  stunColour: DANGER.amber,  // the one danger amber (#126), not a second value
};

// ---------------------------------------------------------------------------
// Mission intro (docs/mission-intro.md, PRD G4). One eased camera move from the
// level's goal back to the player's own view while the title card types out.
// The camera lands ON the play camera, so handover has no cut.
export const MISSION_INTRO = {
  moveTime: 5,       // s, goal → player
  fadeOut: 0.4,      // s, the card fades as control lands (matches style.css)
  cap: 6,            // s, never longer than this from load to control
  typeSpeed: 40,     // characters per second
  linePause: 0.15,   // s between title-card lines
  frameClamp: 0.1,   // s, the longest frame the intro counts in full (real time, not the game's 0.05)
};
