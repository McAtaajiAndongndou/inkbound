// OWNER: E (Levels)
// L1 — "THE BRIEFING". Linear corridor mission, objective markers, extraction point.
// WHAT THIS LEVEL DOES THAT THE OTHERS DO NOT: it is the only level with
// generous paint. The player is LEARNING that colour changes physics.
// Enemies: Sprayer, Charger. No armour. Low count.
import * as THREE from 'three';
import { LevelBase } from './level-base.js';
import { PaintSurface } from '../paint/paint-surface.js';
import { PAINT, ENEMY, PAINT_GRID } from '../config.js';
import { Enemy } from '../enemies/enemy.js';

/**
 * Layout numbers, named so the blockout is iterable — tune here, re-test.
 * Full-width corridor (x −8…8) so no gate can be bypassed sideways.
 *
 * Route (z runs +18 → −30): start island → jump Gap 1 → island B (Charger,
 * blue run-up) → [gate B: clear island B] → blue + RED PAD super jump over
 * Gap 2 → island C (Sprayer + Charger, red pad) → red launch onto the
 * platform → [gate C: clear island C] → green climb the wall → extraction.
 */
const L1 = {
  corridorHalf: 8,            // full width 16
  cells: PAINT_GRID.level1Cells,
  spawn: { x: 0, y: 2, z: 13 },

  islands: {
    A: { zMin: 8,   zMax: 18  },  // start — spawn + fall respawn land here
    B: { zMin: -7,  zMax: 4.5 },  // middle — deep: Charger fight + blue run-up
    C: { zMin: -24, zMax: -16 },  // red pad → platform
  },

  platform: { zMin: -23, zMax: -17, y: 4, width: 8 },  // red required (jump apex 1.39m)
  wall:     { yBase: 4, yTop: 9, z: -24 },             // green required, full width
  ledge:    { zMin: -30, zMax: -19, y: 9 },            // walkable; protrudes so the wall jump-off lands
  extraction: { zMin: -30, zMax: -24 },                // win zone (back of the ledge, past the wall)

  // Encounter gates (#37 island B, #56 island C): an arena's exit stays sealed
  // until that arena is clear, so the fight has to be won rather than run past.
  //
  // Both are full-width VERTICAL panels — the only barrier the engine stops
  // (see `_gate()`), which is why island C's sits on the platform lip rather
  // than over the launch. `yTop` is taller than a red bounce
  // (minBounce 15 -> apex ≈4.3 m) so neither can be hopped.
  gates: {
    B: { yTop: 6 },    // island B's front edge — seals the way to Gap 2
    C: { yTop: 10 },   // the platform lip, from y 4 — seals the way to the wall
  },

  beacons: [                  // colour-coded to the paint each gate asks for
    { colour: 'blue',  x: 0, y: 2,    z: -4.5 },   // island B — the blue run-up
    { colour: 'red',   x: 0, y: 2,    z: -11.5 },  // Gap 2 — the launch colour
    { colour: 'red',   x: 0, y: 5,    z: -17 },    // platform
    { colour: 'green', x: 0, y: 10.5, z: -24 },    // wall
  ],

  // DESIGN.md teaching beats, not just spawn points:
  //   Charger  — island B. 5 m/s, 25 contact. The answer is paint BLUE: it
  //              slides straight past. That patch is also the Gap 2 run-up.
  //   Sprayer  — island C. Slower (10 damage) pressure while you paint red.
  //   Charger  — island C, a second one (#36). A 2.5 m/s enemy is not pressure
  //              — you outrun it without trying — so the red paint both island C
  //              tasks need was free. This one asks island B's question again:
  //              paint blue, or eat 25 while you stand still?
  // Spawns are a starting hint, not a hold: there is no aggro radius, so enemies
  // walk at the player from load and freeze where the next step would fall off.
  // Where they start only sets the line they take to that edge — which is how
  // the two on island C end up flanking it.
  spawns: [
    { x: 4,  y: 0, z: -1,  type: 'charger' },
    { x: -4, y: 0, z: -21, type: 'sprayer' },
    { x: 5,  y: 0, z: -22, type: 'charger' },
  ],
};

export class Level01 extends LevelBase {
  async load() {
    for (const { zMin, zMax } of Object.values(L1.islands)) {
      this._floor(zMin, zMax, 0);
    }
    this._floor(L1.platform.zMin, L1.platform.zMax, L1.platform.y, L1.platform.width);
    this._floor(L1.ledge.zMin, L1.ledge.zMax, L1.ledge.y);

    this._wall();
    this._beacons();
    this._extraction();

    this.spawn.set(L1.spawn.x, L1.spawn.y, L1.spawn.z);

    this.spawnPoints = L1.spawns.map((p) => new THREE.Vector3(p.x, p.y, p.z));
    this._spawnEnemies();

    // Gates go up after the enemies exist so each one can take its own watch
    // list. A gate waits only on the enemies that SPAWN inside its own arena:
    // island C's pair must not hold island B's gate shut, or the other way
    // round. `z` and `yBase` come from the layout, never repeated as numbers.
    this.gateB = this._gate({
      arena: 'B', z: L1.islands.B.zMin, yBase: 0, yTop: L1.gates.B.yTop,
    });
    this.gateC = this._gate({
      arena: 'C', z: L1.platform.zMin, yBase: L1.platform.y, yTop: L1.gates.C.yTop,
    });
    this.gates = [this.gateB, this.gateC];

    for (let i = 0; i < this.gates.length; i++) {
      const gate = this.gates[i];
      gate.watch = this.enemies.filter((e) => this._inIsland(gate.arena, e.position));
    }
  }

  update(dt, player) {
    // Pass the position, not the player: Enemy.update does arithmetic on what
    // it receives, and a Player object has no x/y/z.
    // indexed loop: `for...of` allocates an iterator object per call until V8
    // optimises it away, and this runs every frame.
    for (let i = 0; i < this.enemies.length; i++) {
      this.enemies[i].update(dt, player.position);
    }

    // Encounter gates: an arena's exit opens the moment that arena is clear.
    for (let i = 0; i < this.gates.length; i++) {
      const gate = this.gates[i];
      if (!gate.open && this._arenaCleared(gate)) this._openGate(gate);
    }

    // Extraction fires the win exactly once, guarded by `_complete` — and only
    // once island C is clear. Its panel can be green-climbed over (see
    // `_gate()`), so the panel alone cannot be the enforcement; this can.
    if (!this._complete && this.extraction && this.extraction.containsPoint(player.position)
        && this._arenaCleared(this.gateC)) {
      this._complete = true;
      this.game.onWin?.();
    }
  }

  /**
   * Attach enemies under `this.root`, not `game.scene`, so the base traverse
   * in dispose() frees them along with everything else.
   *
   * Still guarded: a throw here would silently produce an empty `enemies`
   * array, which looks exactly like "the enemies are just not there yet".
   */
  _spawnEnemies() {
    try {
      // Only walkable surfaces — the probe treats every entry as a floor to
      // stand on, and a wall in that list would be a floor you stand on top of.
      const floors = this.surfaces.filter((s) => s.isFloor);

      for (const { x, y, z, type } of L1.spawns) {
        const config = ENEMY[type] ?? ENEMY.sprayer;
        this.enemies.push(
          new Enemy({
            position: new THREE.Vector3(x, y, z),
            config,
            parent: this.root,
            floors,
          }),
        );
      }
    } catch (err) {
      console.error('[Level01] enemy spawn failed, running without enemies:', err);
      this.enemies = [];
    }
  }

  dispose() {
    // Enemies may own GPU resources not attached to `root` — free them first,
    // then let the base traverse dispose every mesh/material/texture under root.
    for (const enemy of this.enemies) enemy.dispose?.();
    super.dispose();
  }

  /** A flat, walkable paint surface on the XZ plane. `height` is world Z depth. */
  _floor(zMin, zMax, y = 0, width = L1.corridorHalf * 2) {
    const s = new PaintSurface({ width, height: zMax - zMin, cells: L1.cells });
    s.mesh.rotation.x = -Math.PI / 2;
    s.mesh.position.set(0, y, (zMin + zMax) / 2);
    s.mesh.receiveShadow = true;
    s.isFloor = true;
    this.root.add(s.mesh);
    this.surfaces.push(s);
    return s;
  }

  /** The hard gate: a full-width vertical panel, climbable only when green. */
  _wall() {
    const { yBase, yTop, z } = L1.wall;
    const s = new PaintSurface({ width: L1.corridorHalf * 2, height: yTop - yBase, cells: L1.cells });
    s.mesh.position.set(0, (yBase + yTop) / 2, z);
    s.isFloor = false;
    this.root.add(s.mesh);
    this.surfaces.push(s);
    return s;
  }

  /**
   * One encounter gate (#37 island B, #56 island C): a full-width vertical panel
   * seals its arena's exit until the arena is clear, so the fight has to be won
   * rather than run past.
   *
   * It is a paint surface because that is the only thing that collides (see
   * `_resolveWalls`). It is deliberately NOT a paint puzzle: painting it
   * changes nothing that gets you through. That is the L1 version of "not
   * every obstacle is a colour answer" (cf. the L2 turret).
   *
   * VERTICAL on purpose, and that is a hard constraint, not a preference:
   * `_resolveWalls` (player.js) pushes the player out along x/z and never
   * resolves y, so a horizontal panel is pass-through and seals nothing. A gate
   * can therefore only block a *horizontal* route. Consequence here: the red
   * launch off island C is vertical, so it cannot be gated at all — island C's
   * gate has to sit one step further along, on the platform lip.
   *
   * Corollary worth knowing before moving either gate: a panel is climbable
   * once it is painted green (climbing only needs `rules.climbable`, and
   * `PaintSurface` has no unpaintable option), so a determined player can go
   * over the top. #37 was allowed that — it leads nowhere. Island C's gate is
   * the first whose far side is the win, which is why the win also waits on
   * `_arenaCleared(this.gateC)`: a check that cannot be climbed.
   */
  _gate({ arena, z, yBase, yTop }) {
    const s = new PaintSurface({ width: L1.corridorHalf * 2, height: yTop - yBase, cells: L1.cells });
    s.mesh.position.set(0, (yBase + yTop) / 2, z);
    s.isFloor = false;
    this.root.add(s.mesh);
    this.surfaces.push(s);

    // Lock light above the door. A wide bar, not the 0.7x2.2x0.7 beacon shape:
    // the beacons mean "paint this colour", and this is not one of those.
    const light = new THREE.Mesh(
      new THREE.BoxGeometry(6, 0.4, 0.4),
      new THREE.MeshBasicMaterial({ color: PAINT.red.hex }),
    );
    light.position.set(0, yTop + 1, z);
    this.root.add(light);

    return { arena, surface: s, light, open: false, watch: [] };
  }

  /**
   * An arena releases its gate when every enemy in it is dead OR has left it.
   *
   * The second case is the soft-lock guard #37 asks for: a red hit flings an
   * enemy with no gravity (`enemy.js` `_applyKnockback`), so a Charger knocked
   * into a gap floats out there alive forever. Waiting only on `alive` would
   * shut the level down permanently.
   */
  _arenaCleared(gate) {
    return gate.watch.every((e) => !e.alive || !this._inIsland(gate.arena, e.position));
  }

  /** Is a world point on island `key` (A, B, C)? Slack at the edges so "on the lip" counts. */
  _inIsland(key, p) {
    const { zMin, zMax } = L1.islands[key];
    return p.z >= zMin - 0.5 && p.z <= zMax + 0.5 && Math.abs(p.x) <= L1.corridorHalf + 0.5;
  }

  /**
   * Open the door by dropping it below the world. Collision is positional —
   * `_resolveWalls` reads the mesh's current transform every frame — so moving
   * the panel is what opens it; hiding it would not. y=-100 is below
   * `PLAYER.killY`, so no player can ever be inside the panel's height range.
   */
  _openGate(gate) {
    gate.open = true;
    gate.surface.mesh.position.y = -100;
    gate.light.material.color.setHex(PAINT.green.hex);
  }

  /** Minimal unlit beacons, colour-coded to the paint they ask for. Shared geo + material. */
  _beacons() {
    const geo = new THREE.BoxGeometry(0.7, 2.2, 0.7);
    const mats = {
      blue:  new THREE.MeshBasicMaterial({ color: PAINT.blue.hex }),
      red:   new THREE.MeshBasicMaterial({ color: PAINT.red.hex }),
      green: new THREE.MeshBasicMaterial({ color: PAINT.green.hex }),
    };
    for (const { colour, x, y, z } of L1.beacons) {
      const m = new THREE.Mesh(geo, mats[colour]);
      m.position.set(x, y, z);
      this.root.add(m);
    }
  }

  /** The win volume (Box3) + a faint white marker box on the extraction ledge. */
  _extraction() {
    const { zMin, zMax } = L1.extraction;
    const y = L1.ledge.y;
    const min = new THREE.Vector3(-L1.corridorHalf, y - 1, zMin);
    const max = new THREE.Vector3(L1.corridorHalf, y + 2, zMax);
    this.extraction = new THREE.Box3(min, max);

    const marker = new THREE.Mesh(
      new THREE.BoxGeometry(max.x - min.x, max.y - min.y, max.z - min.z),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.18, depthWrite: false }),
    );
    marker.position.set(
      (min.x + max.x) / 2,
      (min.y + max.y) / 2,
      (min.z + max.z) / 2,
    );
    this.root.add(marker);
  }
}
