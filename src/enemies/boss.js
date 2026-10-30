// OWNER: D (Enemies & Combat) — built from the levels lane with Lethabo's agreement (#99).
//
// BIG ARM, Last Colour's arena boss. Its job is TERRITORY, not damage: every
// slam greys the floor round it, so the arena shrinks the longer you take
// (docs/levels/03-last-colour.md, R4; docs/enemies/algorithms.md).
//
// DAMAGE DOES NOT KILL IT. It dies to one combo, landed three times — once per
// phase — and the combo is three effects every enemy already has, in order:
//
//   1. BLUE  three hits freeze it         the game's own freeze (BLUE_FREEZE)
//   2. GREEN while frozen, pins its arm   on one knee for `pinFor`, green shackles
//   3. RED   while pinned, knocks it flat down for `downFor`; the phase ends
//
// Miss a window and the chain breaks: the frost melts or the shackles snap and
// it gets back up. Outside the chain, green and red are only a tint — a plain
// hit staggers nothing and kills nothing.
//
//   phase 1  slow advance, slam (1.0 s tell) that greys `slamRadius` of floor
//   phase 2  faster, adds a GRAB, calls two Drainers (`onSummon`)
//   phase 3  enraged: back-to-back slams, paint no longer changes its speed
//
// Everything else — awareness, steering, walls, the telegraph's swell and amber,
// the freeze and its frost shell, the model, the death sink — is `Enemy`'s, so
// it moves and reads like every other enemy in the game.
//
// HOOKS the level sets (the slam's own hit goes through `onAttack`, as all
// attacks do, but only when the player is inside the slam):
//   onGrab(boss)        the grab landed: damage and pull the player
//   onSummon(boss, n)   phase 2 began: wake n Drainers
//   onPhase(boss, p)    a new phase began (1-based)
import * as THREE from "three";
import { ENEMY, PAINT, PAINT_IDS } from "../config.js";
import { Enemy } from "./enemy.js";

const CFG = ENEMY.bigArm;
// The model is fitted to MODEL_HEIGHTS.bigArm (2.4 m) against the shared 1.6 m;
// the frost shell, the shackles and the box fallback are sized for that.
const SCALE = 1.5;
const ID_TO_NAME = ["grey", "blue", "red", "green"];

export class BigArm extends Enemy {
  constructor(opts) {
    super({ ...opts, config: CFG });
    this.type = "bigArm";
    this._floors = opts.floors ?? [];
    this.phase = 1;
    this._phaseConfigs = CFG.phases.map((p) => ({ ...CFG, ...p }));
    this.config = this._phaseConfigs[0];

    this._comboPin = 0;      // > 0: step 2 done, waiting for red
    this._down = 0;          // > 0: step 3 done, flat on its back
    this._grabTimer = 0;     // > 0: the grab's tell
    this._grabCooldown = 0;
    this._slamPoint = new THREE.Vector3();
    this._scratch = new THREE.Vector3();

    // A boss is a size before it is a health bar (M8). The GLB is already
    // fitted to 2.4 m; the box fallback (tests, a failed download) is not.
    if (!this._model) {
      for (const child of this.mesh.children) {
        if (child === this._frostShell) continue;
        child.scale.multiplyScalar(SCALE * 2);
        child.position.multiplyScalar(SCALE * 2);
      }
    }
    this._frostShell.scale.multiplyScalar(SCALE);
    this._frostShell.position.y *= SCALE;

    // Step 2's tell: green shackles, hidden until the pin.
    this._shackles = new THREE.Group();
    const ring = new THREE.TorusGeometry(0.75 * SCALE, 0.07 * SCALE, 6, 20);
    const mat = new THREE.MeshBasicMaterial({ color: PAINT.green.hex });
    for (const y of [0.35, 0.9]) {
      const r = new THREE.Mesh(ring, mat);
      r.rotation.x = Math.PI / 2;
      r.position.y = y * SCALE;
      this._shackles.add(r);
    }
    this._shackles.visible = false;
    this.mesh.add(this._shackles);

    this.onGrab = null;
    this.onSummon = null;
    this.onPhase = null;
  }

  /** Where the chain stands: 'open' | 'frozen' | 'pinned' | 'down'. */
  get combo() {
    if (this._down > 0) return "down";
    if (this._comboPin > 0) return "pinned";
    if (this._frozenTimer > 0) return "frozen";
    return "open";
  }

  get grabbing() { return this._grabTimer > 0; }

  /**
   * Paint hit. The combo is the ONLY way to hurt it; nothing here takes `hp`
   * except step 3.
   */
  takeColourHit(colourId, damage = 10, sourcePos = null) {
    if (!this.alive || !ID_TO_NAME[colourId] || colourId === PAINT_IDS.grey) return false;
    this.sleeping = false;
    const state = this.combo;
    if (state === "down") { this._tint(colourId); return true; }

    if (colourId === PAINT_IDS.blue && state === "open") {
      // Step 1 is the ordinary freeze, so it reads exactly as it does on any
      // enemy — but it may not cost hp. The base hit always takes at least 1
      // and checks for death before returning, so hp is lifted out of reach for
      // the call, not just put back after it (with 1 combo left, blue killed it).
      const hp = this.hp;
      this.hp = Infinity;
      super.takeColourHit(colourId, 0, sourcePos);
      this.hp = hp;
      this._knockback.set(0, 0, 0);
      return true;
    }
    if (colourId === PAINT_IDS.green && state === "frozen") {
      // Step 2: frozen → pinned. The frost gives way to the shackles.
      this._clearFreeze();
      this._comboPin = this.config.pinFor;
      this._shackles.visible = true;
      this._windupTimer = 0;
      this._grabTimer = 0;
      this.mesh.scale.setScalar(1);
      this._tint(colourId);
      return true;
    }
    if (colourId === PAINT_IDS.red && state === "pinned") {
      // Step 3: knocked flat. The phase is over.
      this._comboPin = 0;
      this._shackles.visible = false;
      this._lastColour = "red";
      this.hp -= 1;
      this._tint(colourId);
      if (this.hp <= 0) {
        this._die("red", "knockback");
        return true;
      }
      this._down = this.config.downFor;
      return true;
    }
    // Anything else — green on a free boss, red on a frozen one, blue on a
    // pinned one — is a tint and nothing more.
    this._tint(colourId);
    return true;
  }

  takeDamage() { return false; }   // traps and falls do not touch it either

  _tint(colourId) {
    this._tintTarget.setHex(PAINT[ID_TO_NAME[colourId]].hex);
    this._tintTimer = 1;
    this._setColour(this._tintTarget);
  }

  _tick(dt, playerPos) {
    if (!this.alive) return;
    if (this._down > 0) {
      // Flat on its back: the tell that the combo landed.
      this._down -= dt;
      this.mesh.rotation.z = Math.PI / 2 * Math.min(1, (this.config.downFor - this._down) * 4);
      this._vel.set(0, 0, 0);
      if (this._down <= 0) {
        this._down = 0;
        this.mesh.rotation.z = 0;
        this._nextPhase();
      }
      return;
    }
    if (this._comboPin > 0) {
      this._comboPin -= dt;
      this._fadeTint(dt);
      this._vel.set(0, 0, 0);
      if (this._comboPin <= 0) {
        // Too slow: the shackles snap. Back to the start of the chain.
        this._comboPin = 0;
        this._shackles.visible = false;
      }
      return;
    }
    if (this._grabTimer > 0) {
      this._updateGrab(dt, playerPos);
      return;
    }
    if (this._grabCooldown > 0) this._grabCooldown -= dt;
    if (this.config.grabs && this._windupTimer <= 0 && this._grabCooldown <= 0 && this._frozenTimer <= 0 && playerPos) {
      const dx = playerPos.x - this.position.x;
      const dz = playerPos.z - this.position.z;
      if (dx * dx + dz * dz <= this.config.grab.range ** 2) {
        this._grabTimer = this.config.grab.windup;
        this._vel.set(0, 0, 0);
        return;
      }
    }
    super._tick(dt, playerPos);
  }

  _nextPhase() {
    this.phase = Math.min(this._phaseConfigs.length, this.phase + 1);
    this.config = this._phaseConfigs[this.phase - 1];
    this._attackCooldown = 0;
    this.onPhase?.(this, this.phase);
    if (this.phase === 2) this.onSummon?.(this, 2);
  }

  /** The grab's tell (amber, a lean in), then it lands if you are still close. */
  _updateGrab(dt, playerPos) {
    const cfg = this.config.grab;
    this._grabTimer -= dt;
    const p = 1 - this._grabTimer / cfg.windup;
    this._tintBlend.copy(this._baseColour).lerp(this._telegraphColour, 0.5 + 0.5 * Math.sin(p * 30));
    this._setColour(this._tintBlend);
    if (this._grabTimer > 0) return;
    this._grabTimer = 0;
    this._grabCooldown = cfg.cooldown;
    this._setColour(this._baseColour);
    if (!playerPos) return;
    const dx = playerPos.x - this.position.x;
    const dz = playerPos.z - this.position.z;
    if (dx * dx + dz * dz <= (cfg.range + 0.5) ** 2) this.onGrab?.(this);
  }

  /** Phase 3 ignores paint: its speed is its speed, on any ground. */
  _moveSpeed(rules, ground, speedMult, dt) {
    if (this.config.ignoresPaint) return this.config.speed * speedMult;
    return super._moveSpeed(rules, ground, speedMult, dt);
  }

  /**
   * The slam lands: grey the floor round the impact, and hurt the player only
   * if they are inside it. (main.js's `onAttack` damages unconditionally — a
   * ranged shot always lands — so a melee slam has to check its own reach.)
   */
  _fireShot(playerPos) {
    const cfg = this.config;
    this._slamPoint.copy(this.position);
    if (playerPos) {
      this._scratch.subVectors(playerPos, this.position).setY(0);
      if (this._scratch.lengthSq() > 1e-6) this._slamPoint.addScaledVector(this._scratch.normalize(), cfg.slamReach);
    }
    this.slam(this._slamPoint);
    if (playerPos) {
      const dx = playerPos.x - this._slamPoint.x;
      const dz = playerPos.z - this._slamPoint.z;
      const dy = Math.abs(playerPos.y - this.position.y);
      if (dx * dx + dz * dz <= cfg.slamRadius ** 2 && dy < 1.5) this.onAttack?.(this);
    }
  }

  /**
   * Grey `slamRadius` of floor round `point`, on floors at Big Arm's own height
   * only: the 5 m balconies are out of its reach, so raised paint stays safe
   * (the hangar's lesson, and the refill plan for the fight).
   */
  slam(point) {
    const r = this.config.slamRadius;
    const p = this._scratch;
    for (let x = -r; x <= r; x += 1) {
      for (let z = -r; z <= r; z += 1) {
        if (x * x + z * z > r * r) continue;
        p.set(point.x + x, this.position.y, point.z + z);
        for (const f of this._floors) {
          if (Math.abs(f.mesh.position.y - this.position.y) > 0.6) continue;
          if (f.worldToCell(p)) { f.splat(p, "grey", 0.8); break; }
        }
      }
    }
  }

}

/** Enemy classes by layout type, for the level kit's spawner. */
export const ENEMY_CLASSES = { bigArm: BigArm };
