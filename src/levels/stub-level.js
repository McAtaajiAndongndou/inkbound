// OWNER: E (Levels)
import * as THREE from 'three';
import { LevelBase } from './level-base.js';
import { PaintSurface } from '../paint/paint-surface.js';
import { PAINT_GRID } from '../config.js';

/**
 * A flat pad that exists so a level can be SELECTED before it is DESIGNED.
 *
 * This is not a level and it is not a template -- delete it from a level the
 * moment that level has real geometry. Its whole job is the thing #006 and the
 * marker both need: every name in `src/levels/index.js` builds a `LevelBase`
 * package you can stand in, paint, and win, instead of throwing "implement
 * load()" the moment someone picks it.
 *
 * Nothing here is tuned. Do not build a fight on it.
 */
export class StubLevel extends LevelBase {
  async load() {
    const floor = new PaintSurface({ width: 30, height: 30, cells: PAINT_GRID.level1Cells });
    floor.mesh.rotation.x = -Math.PI / 2;
    floor.mesh.position.set(0, 0, 0);
    floor.mesh.receiveShadow = true;
    floor.isFloor = true;
    this.root.add(floor.mesh);
    this.surfaces.push(floor);

    this.spawn.set(0, 1.5, 10);

    // A win volume at the far end, so "select it and reach the end" is testable
    // before there is anything worth reaching.
    this.extraction = new THREE.Box3(
      new THREE.Vector3(-3, -1, -14.5),
      new THREE.Vector3(3, 3, -12),
    );

    const marker = new THREE.Mesh(
      new THREE.BoxGeometry(6, 4, 2.5),
      new THREE.MeshBasicMaterial({
        color: 0xffffff, transparent: true, opacity: 0.18, depthWrite: false,
      }),
    );
    marker.position.set(0, 1, -13.25);
    this.root.add(marker);
  }

  update(dt, player) {
    // Same one-shot win rule as a real level, so selecting a stub and walking to
    // the marker proves the level→main.js→HUD path end to end.
    if (!this._complete && this.extraction.containsPoint(player.position)) {
      this._complete = true;
      this.game.onWin?.();
    }
  }
}
