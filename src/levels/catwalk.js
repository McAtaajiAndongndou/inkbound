// OWNER: E (Levels)
import * as THREE from 'three';
import { ASCENT, TRAP } from '../config.js';

/**
 * The Ascent's collapsing catwalk (#102): "can you cross before it drops?"
 *
 * Each catwalk segment is its own trap. The first time the player stands on
 * it, a clock starts; after `delay` the segment falls, whether or not they are
 * still there. A run always makes it (the delay is longer than a 4 m segment
 * takes at full speed), a stop to shoot never does, and turning back means
 * stepping onto something that is already going. That is the commitment the
 * room asks for, with the same answers the doc gives: blue to cross fast, or
 * nerve.
 *
 * THE TELL is the campaign's trap language: while a segment is going it shakes
 * and its underside flashes DANGER amber, the same amber as the spike pit, the
 * vent and the crusher.
 *
 * FAIL FORWARD: a fall lands on the scree 8 m down (the layout test proves
 * every segment has a catch floor), and the segment is back after
 * `reformAfter`, so the scree-return climb always leads to a crossing.
 *
 * Collision is positional, so a segment falls by moving its floor below the
 * world — the same trick as the gates. The slab underneath (built by
 * layout-builder.js) is what the player watches fall. Both are under the
 * level root, so the dispose walk frees them, including the per-segment
 * material this clones for the flash (AGENTS rule 6). MeshToonMaterial reads
 * scene lights, so nothing joins the `uLightDir` pass (rule 5).
 */
export class CollapsingCatwalk {
  /**
   * @param {object[]} segments  { floor, slab, data } — the PaintSurface, its
   *                             underside mesh, and the layout slab it came from
   */
  constructor(segments) {
    this.cfg = ASCENT.catwalk;
    this.segments = segments.map(({ floor, slab, data }) => {
      slab.material = slab.material.clone();
      // The flash on the WALKING surface — the slab's amber edge alone is
      // 0.3 m tall and out of sight from on top, where the player looks.
      const flash = new THREE.Mesh(
        new THREE.PlaneGeometry(data.x[1] - data.x[0], data.z[1] - data.z[0]),
        new THREE.MeshBasicMaterial({ color: TRAP.amber, transparent: true, opacity: this.cfg.flashOpacity, depthWrite: false }),
      );
      flash.rotation.x = -Math.PI / 2;
      flash.position.set((data.x[0] + data.x[1]) / 2, data.y + 0.02, (data.z[0] + data.z[1]) / 2);
      flash.visible = false;
      slab.parent.add(flash);
      return {
        id: data.id, data, floor, slab, flash,
        y: floor.mesh.position.y,
        slabY: slab.position.y,
        colour: slab.material.color.getHex(),
        state: 'solid',   // solid → going → fallen → solid
        t: 0,
      };
    });
  }

  /** Is `p` (feet) standing on segment `s`? */
  _on(s, p) {
    const { x, z } = s.data;
    return p.x >= x[0] && p.x <= x[1] && p.z >= z[0] && p.z <= z[1]
      && p.y >= s.y - 0.05 && p.y <= s.y + this.cfg.standBand;
  }

  /** Could `p` be inside the segment if it came back now? */
  _inside(s, p) {
    const { x, z } = s.data;
    return p.x >= x[0] - 0.5 && p.x <= x[1] + 0.5 && p.z >= z[0] - 0.5 && p.z <= z[1] + 0.5
      && Math.abs(p.y - s.y) < 2;
  }

  get(id) { return this.segments.find((s) => s.id === id); }

  update(dt, player) {
    const cfg = this.cfg;
    const p = player.position;
    for (const s of this.segments) {
      s.t += dt;
      if (s.state === 'solid') {
        if (this._on(s, p)) { s.state = 'going'; s.t = 0; }
      } else if (s.state === 'going') {
        if (s.t >= cfg.delay) {
          s.state = 'fallen';
          s.t = 0;
          s.floor.mesh.position.y = -100;   // below PLAYER.killY: out of every floor test
        }
      } else if (s.state === 'fallen' && s.t >= cfg.reformAfter && !this._inside(s, p)) {
        s.state = 'solid';
        s.t = 0;
        s.floor.mesh.position.y = s.y;
      }
      this._draw(s);
    }
  }

  _draw(s) {
    const cfg = this.cfg;
    const { slab } = s;
    if (s.state === 'going') {
      // The tell: a shake and an amber flash, faster as it nears the drop.
      const k = s.t / cfg.delay;
      const jitter = cfg.shake * Math.sin(s.t * (40 + 60 * k));
      slab.position.y = s.slabY + jitter;
      s.floor.mesh.position.y = s.y + jitter;
      const lit = Math.sin(s.t * (14 + 30 * k)) > 0;
      slab.material.color.setHex(lit ? TRAP.amber : s.colour);
      s.flash.visible = lit;
      s.flash.position.y = s.y + 0.02 + jitter;
      slab.visible = true;
    } else if (s.state === 'fallen') {
      const t = Math.min(s.t, cfg.fallFor);
      slab.position.y = s.slabY - 0.5 * cfg.fallGravity * t * t;
      slab.visible = s.t < cfg.fallFor;
      slab.material.color.setHex(s.colour);
      s.flash.visible = false;
    } else {
      slab.position.y = s.slabY;
      slab.visible = true;
      slab.material.color.setHex(s.colour);
      s.flash.visible = false;
    }
  }
}
