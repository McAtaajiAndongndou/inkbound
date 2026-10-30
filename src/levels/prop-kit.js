// OWNER: E (Levels)
import * as THREE from 'three';
import { LAST_COLOUR, DANGER } from '../config.js';

/**
 * The Corp prop kit (#56): procedural crates, jersey barriers, pipes, rails and
 * amber warning lamps, built from a layout's `props` list.
 *
 * Rules (polish pass 1, docs/levels/polish-pass-1.md §3):
 *   - procedural, grey only; amber lamps are the one colour
 *   - no collision: a prop is never added to `level.surfaces`, so enemies path
 *     exactly as before and the paint grid is untouched
 *   - one InstancedMesh per kind (and per lamp rule), to keep draw calls down
 *   - MeshToonMaterial / MeshBasicMaterial only: built-in materials read scene
 *     lights, so nothing joins the `uLightDir` pass (AGENTS rule 5)
 *   - under `level.root`, so the dispose walk frees them (AGENTS rule 6)
 *
 * A `floodlight` is a cold-white Corp work light: unlit, never blinks, and
 * marks a route rather than a danger (amber stays the danger colour). The
 * Ascent's chain scaffold uses it.
 *
 * A prop is `{ kind, box: [x0,x1,y0,y1,z0,z1], room, rule? }`. Pipes and rails
 * are cylinders along their box's longest axis; everything else is a box. A
 * lamp's `rule` is a wake/open rule (layout-level.js): the lamp blinks while
 * that rule is counting down, so a wave or a gate has a tell.
 */
const ROUND = new Set(['pipe', 'rail']);

export function buildProps(level, props) {
  const cfg = LAST_COLOUR.props;
  const groups = new Map();
  for (const p of props) {
    const key = p.kind === 'light' ? `light|${p.rule ?? ''}` : p.kind;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(p);
  }

  const built = { meshes: [], lamps: [] };
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const pos = new THREE.Vector3();
  const scale = new THREE.Vector3();
  const zAxisToY = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2);
  const xAxisToY = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.PI / 2);

  for (const [key, list] of groups) {
    const kind = list[0].kind;
    const geo = ROUND.has(kind) ? new THREE.CylinderGeometry(0.5, 0.5, 1, 10) : new THREE.BoxGeometry(1, 1, 1);
    const mat = kind === 'light'
      ? new THREE.MeshBasicMaterial({ color: list[0].rule ? cfg.lightOff : DANGER.amber })
      : kind === 'floodlight'
        ? new THREE.MeshBasicMaterial({ color: cfg.floodlight })
        : new THREE.MeshToonMaterial({ color: cfg[kind] });
    const mesh = new THREE.InstancedMesh(geo, mat, list.length);
    list.forEach((p, i) => {
      const [x0, x1, y0, y1, z0, z1] = p.box;
      const sx = x1 - x0;
      const sy = y1 - y0;
      const sz = z1 - z0;
      pos.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
      if (ROUND.has(kind)) {
        // A unit cylinder runs along y: turn it onto the box's long axis.
        if (sz >= sx && sz >= sy) { q.copy(zAxisToY); scale.set(sx, sz, sy); }
        else if (sx >= sy) { q.copy(xAxisToY); scale.set(sy, sx, sz); }
        else { q.identity(); scale.set(sx, sy, sz); }
      } else {
        q.identity();
        scale.set(sx, sy, sz);
      }
      mesh.setMatrixAt(i, m.compose(pos, q, scale));
    });
    mesh.name = `props:${key}`;
    level.root.add(mesh);
    built.meshes.push(mesh);
    if (kind === 'light' && list[0].rule) built.lamps.push({ rule: list[0].rule, mesh });
  }
  return built;
}

/** Light a lamp group: blinking while `state` is 'pending', dark otherwise. */
export function setLamp(lamp, state, clock) {
  const cfg = LAST_COLOUR.props;
  const on = state === 'pending' && Math.sin(clock * cfg.blinkRate) > 0;
  lamp.mesh.material.color.setHex(on ? DANGER.amber : cfg.lightOff);
}
