// OWNER: E (Levels)
// L2 — "THE ASCENT". A spiral climb round one peak; paint is scarce.
// WHAT THIS LEVEL DOES THAT THE OTHERS DO NOT: paint is scarce, so every shot
// is a choice between traversal and combat. The player is RATIONING.
// Enemies: Wall-crawler, Turret, Charger (13). Trap: the collapsing catwalk
// (catwalk.js); boulders and pendulum blades are parked.
//
// Status: BLOCKOUT of design v2, plus polish pass 1 (cold dawn, the catwalk,
// the chain's scaffold landmark, the base on the horizon). Every number comes
// from the layout DATA — src/levels/layouts/ascent.js — the same file the
// design doc's plan, sections and 3D massing model are generated from
// (docs/levels/02-the-ascent.md). The behaviour (wake rules, the win) is
// LayoutLevel's, shared with Last Colour. To change the level, change the data
// and run its tests.
import * as THREE from 'three';
import { LayoutLevel } from './layout-level.js';
import { ASCENT } from './layouts/ascent.js';
import { ASCENT as TUNING, TRAP, CURVES, PLACED_LIGHTS } from '../config.js';
import { cables } from './curves.js';
import { buildDressing } from './dressing.js';
import { Decor, ASCENT_KINDS, createDecorPalette } from './decor.js';
import * as kit from './level-kit.js';
import { applyMood } from './mood.js';
import { buildProps } from './prop-kit.js';
import { CollapsingCatwalk } from './catwalk.js';

export class Level02 extends LayoutLevel {
  // Viewer shots: the design doc's "what you see" frames, one per room, from
  // the same eye points — so a viewer screenshot of the BUILT level can be put
  // side by side with the doc's massing frame and compared — plus the catwalk
  // from the vista.
  static SHOTS = [
    ...ASCENT.rooms.map((r) => ({
      name: `eye-${r.id}`, label: `${r.id} ${r.name}`, position: r.eye.pos, target: r.eye.target, fog: true,
    })),
    { name: 'catwalk', label: 'R3 span 2 from the vista', position: [34, 13.6, 36], target: [32, 12, 10], fog: true },
  ];

  get layout() { return ASCENT; }

  async load() {
    await super.load();
    applyMood(this, TUNING.mood);
    // #198: the supply lift's haul cables (one draw call), and the lift
    // beacon's marker-white light in the pool.
    this.cables = cables(this, ASCENT.curves.cables, CURVES.colour);
    const beacon = this.root.getObjectByName('lift-tower-beacon');
    if (beacon) kit.placeLight(this, PLACED_LIGHTS.beacon, beacon.position.clone());
    this.props = buildProps(this, ASCENT.props);
    this._silhouettes();
    this._dressing();
    this.catwalk = new CollapsingCatwalk(
      this.surfaces
        .filter((s) => s.catwalk)
        .map((floor) => ({ floor, slab: floor.underside, data: ASCENT.slabs.find((d) => d.id === floor.layoutId) })),
    );
    // A segment falling next to you shakes the camera (polish audit, P1-2).
    this.catwalk.onFall = (gain) => this.game?.shake?.(TRAP.shake.catwalk * gain);
  }

  /**
   * The dressing pass (docs/levels/dressing-pass.md): the distant range and the
   * rock strata (dressing.js), and the MegaKit trees (decor.js), hand-placed
   * from the layout's `dressing.trees`. The trees' toon materials are custom-
   * shaded, so they join the light-direction pass here (AGENTS rule 5).
   */
  _dressing() {
    const D = ASCENT.dressing;
    this.dressing = buildDressing(this, D.items);
    this.palette = createDecorPalette();
    this.decor = {};
    for (const [kind, config] of Object.entries(ASCENT_KINDS)) {
      const hand = (D.trees[kind] ?? []).map(([x, y, z, scale]) => ({ x, y, z, scale }));
      const trees = new Decor(this.root, { kind, config, palette: this.palette, hand });
      trees.build([]);   // no floors: hand-placed only, and never re-coloured
      if (this.game?.loadGLB) trees.loadModels(this.game.loadGLB);
      this.decor[kind] = trees;
    }
    const materials = [this.palette.base, ...Object.values(this.palette.tint)];
    kit.aimCustomShading([], materials, this.sunDir.toArray());
  }

  /** The base: unfogged, dark, a shape against the sky (config ASCENT.base). */
  _silhouettes() {
    for (const lm of ASCENT.landmarks.filter((l) => l.silhouette)) {
      const mesh = this.root.getObjectByName(lm.id);
      mesh.material.dispose();
      mesh.material = new THREE.MeshBasicMaterial({ color: TUNING.base.silhouette, fog: false });
    }
  }

  update(dt, player) {
    super.update(dt, player);
    this.catwalk.update(dt, player);
    for (const trees of Object.values(this.decor)) trees.update(dt, player.position);
    // #112 — the sergeant's one line on the summit (R7): no enemies, the base
    // on the horizon (docs/levels/02-the-ascent.md).
    if (!this._saidSummit && this.inRoom('R7', player.position)) {
      this._saidSummit = true;
      this.game.say?.('ascent-summit');
    }
  }

  dispose() {
    // A late model load must not land in a dead level, and the palette's
    // painted colours are on no mesh, so the root walk cannot see them.
    for (const trees of Object.values(this.decor ?? {})) trees.dispose();
    if (this.palette) for (const m of [this.palette.base, ...Object.values(this.palette.tint)]) m.dispose();
    super.dispose();
  }
}
