// OWNER: E (Levels)
import * as THREE from 'three';
import { LAST_COLOUR, TRAP, PAINT_IDS } from '../config.js';
import { TrapVolume } from './trap-volume.js';

/**
 * Last Colour's cargo crusher (#33): a press across the corridor floor that
 * slams on a fixed rhythm. "Can I fight without room to repaint?" — and now
 * with a clock running too.
 *
 * It is a TrapVolume that only hurts on the beat, with one rule on top:
 *   - blue is safe: a target on BLUE paint slides under the head. The same rule
 *     as the Primer's spike pit, so blue means one thing across the campaign.
 * Two other answers need no code: cross in the gap between beats, or take the
 * flanking walkway beside it (the press stops at x 2, the walkway starts there).
 *
 * THE TELL is the amber lamp on the head: it blinks for `warnFor` seconds
 * before every drop and is lit while the head is down. The rhythm is fixed so
 * the lamp can be learnt, not reacted to.
 *
 * The head is MeshToonMaterial (reads scene lights, so no `uLightDir` wiring,
 * AGENTS rule 5) and the lamp is unlit. Both live under `parent`, so the
 * level's dispose walk frees them. No collision: the head is above you or on
 * you, never a wall.
 */
export class CargoCrusher {
  /**
   * @param {object} spec
   * @param {THREE.Object3D} spec.parent   the level root
   * @param {object} spec.floor            the PaintSurface under the press
   * @param {number[]} spec.box            the layout trap box [x0,x1,y0,y1,z0,z1]
   */
  constructor({ parent, floor, box }) {
    const [x0, x1, y0, y1, z0, z1] = box;
    const cfg = LAST_COLOUR.crusher;
    this.cfg = cfg;
    this.floor = floor;
    this.clock = 0;
    this.trap = new TrapVolume({
      region: new THREE.Box3(new THREE.Vector3(x0, y0 - 0.5, z0), new THREE.Vector3(x1, y0 + cfg.hurtHeight, z1)),
      damage: cfg.damage,
      cooldown: cfg.cooldown,
    });
    this._exposed = [];
    this._y0 = y0;
    this._yUp = y1 - cfg.headHeight;

    this.group = new THREE.Group();
    this.group.position.set((x0 + x1) / 2, 0, (z0 + z1) / 2);
    parent.add(this.group);

    // The head: a grey slab, with an amber stripe and lamp on its face.
    this.head = new THREE.Mesh(
      new THREE.BoxGeometry(x1 - x0, cfg.headHeight, z1 - z0),
      new THREE.MeshToonMaterial({ color: LAST_COLOUR.props.pipe }),
    );
    this.head.geometry.translate(0, cfg.headHeight / 2, 0);
    this.group.add(this.head);
    this.lamp = new THREE.Mesh(
      new THREE.BoxGeometry(x1 - x0 + 0.04, 0.25, z1 - z0 + 0.04),
      new THREE.MeshBasicMaterial({ color: LAST_COLOUR.props.lightOff }),
    );
    this.lamp.position.y = 0.3;
    this.head.add(this.lamp);

    // The dark bed under the press: where not to stand, readable from above.
    const bed = new THREE.Mesh(
      new THREE.PlaneGeometry(x1 - x0, z1 - z0),
      new THREE.MeshBasicMaterial({ color: TRAP.bed, transparent: true, opacity: 0.45, depthWrite: false }),
    );
    bed.rotation.x = -Math.PI / 2;
    bed.position.y = y0 + 0.01;
    this.group.add(bed);
    this._place();
  }

  /** Where in the cycle we are: 'up', 'warn' (the tell) or 'down' (the beat). */
  get state() {
    const { period, downFor, warnFor } = this.cfg;
    const t = this.clock % period;
    if (t >= period - downFor) return 'down';
    if (t >= period - downFor - warnFor) return 'warn';
    return 'up';
  }

  /** Is the floor under `position` blue? Blue slides under the head. */
  onBlue(position) {
    return this.floor.paintIdAtWorld(position) === PAINT_IDS.blue;
  }

  _place() {
    const state = this.state;
    this.head.position.y = state === 'down' ? this._y0 : this._yUp;
    const lit = state === 'down' || (state === 'warn' && Math.sin(this.clock * 4 * Math.PI * 2) > 0);
    this.lamp.material.color.setHex(lit ? TRAP.amber : LAST_COLOUR.props.lightOff);
  }

  update(dt, targets) {
    this.clock += dt;
    this._place();
    this._exposed.length = 0;
    if (this.state === 'down') {
      for (let i = 0; i < targets.length; i++) {
        const t = targets[i];
        if (t && t.position && !this.onBlue(t.position)) this._exposed.push(t);
      }
    }
    // Always called, so cooldowns keep running between beats.
    this.trap.update(dt, this._exposed);
  }
}
