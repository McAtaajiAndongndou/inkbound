// OWNER: E (Levels)
import * as THREE from 'three';
import { audio } from '../audio/audio-manager.js';

/**
 * A trap is a region that hurts whatever stands in it.
 *
 * That is the whole abstraction (`docs/DECISIONS.md`, 2026-10-24): no trap base
 * class, no registry, no triggering system. The level authors the mesh, this
 * class owns the part that is identical every time -- "is the thing inside the
 * box, and has it been long enough since the last hit".
 *
 * WHAT A TARGET MUST EXPOSE
 *
 *   position    THREE.Vector3 -- where it is, right now
 *   takeDamage(n)             -- apply `n` damage. The return value is ignored
 *                                deliberately: `Player.takeDamage` returns false
 *                                while its own hurt cooldown is running, and that
 *                                is still a frame in which the trap should start
 *                                its own cooldown rather than poll again.
 *   alive       optional       -- `false` means a corpse. The enemy controller
 *                                sets this and leaves the enemy in the level's
 *                                array, so without the check a trap would keep
 *                                hurting a body that is not on screen.
 *   dead        optional       -- the player's equivalent flag.
 *
 * BOTH TARGETS NOW HAVE `takeDamage`. `Enemy` only had `takeColourHit`, which
 * applies a blue/red/green proc; a trap must not invent a colour, so `Enemy`
 * grew a colourless `takeDamage(n)` (added from this lane on 24 Oct for PRD F1 —
 * the enemies lane owns that file and should review it). Before that, enemies
 * were skipped here on purpose. Nothing in this file changed to switch them on.
 */
export class TrapVolume {
  /**
   * @param {object} spec
   * @param {THREE.Box3} spec.region   world-space region that hurts
   * @param {number} spec.damage       per hit
   * @param {number} [spec.cooldown]   seconds between hits on one target
   * @param {string} [spec.sound]      audio.play name for when it fires —
   *                                   'spike' for the pit (#113); none by default
   * @param {number} [spec.spare]      if set, a hit never takes a target's
   *                                   `health` below this: the trap hurts and
   *                                   cannot kill (the Primer's pit, issue #79).
   *                                   A target with no `health` takes full damage.
   */
  constructor({ region, damage, cooldown = 1, sound = null, spare = null }) {
    if (!(region instanceof THREE.Box3)) {
      throw new TypeError('TrapVolume: region must be a THREE.Box3');
    }
    if (!(damage > 0)) {
      throw new TypeError('TrapVolume: damage must be greater than zero');
    }

    this.region = region;
    this.damage = damage;
    this.cooldown = cooldown;
    this.sound = sound;
    this.spare = spare;

    // One timer per target, and weak so a target that dies and is dropped from
    // the level cannot be kept alive by this map. No per-frame allocation.
    this._until = new WeakMap();
  }

  /** Is a world point inside the hurting region? */
  contains(position) {
    return this.region.containsPoint(position);
  }

  /**
   * Damage everything inside that has not been hit recently.
   *
   * `dt` advances each target's cooldown even when it has left the region, so
   * stepping out and back in does not immediately re-trigger a trap the player
   * just escaped.
   */
  update(dt, targets) {
    for (let i = 0; i < targets.length; i++) {
      const target = targets[i];
      if (!target || target.alive === false || target.dead === true) continue;

      const cooling = this._until.get(target) ?? 0;
      if (cooling > 0) {
        this._until.set(target, cooling - dt);
        continue;
      }

      // See "THE ENEMY GAP" above. A target that cannot take colourless damage
      // is skipped rather than being hit with a proc it did not earn.
      if (!target.position || typeof target.takeDamage !== 'function') continue;
      if (!this.region.containsPoint(target.position)) continue;

      let n = this.damage;
      if (this.spare !== null && typeof target.health === 'number') {
        n = Math.min(n, target.health - this.spare);
        if (n <= 0) continue;   // already at the floor: nothing left to take
      }
      target.takeDamage(n);
      this._until.set(target, this.cooldown);
      if (this.sound) audio.play(this.sound);
    }
  }
}
