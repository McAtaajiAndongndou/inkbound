// OWNER: E (Levels)
import * as THREE from 'three';
import { COMBO_RACK, PAINT } from '../config.js';

/**
 * The combo rack: Big Arm's combo taught in the world (QA 30 Oct, quality plan
 * §4.3). A board — header, then FREEZE · PIN · KNOCK in blue, green, red —
 * and three lamps above it, one per step, that light as each step lands on the
 * Big Arm it watches and go dark when the chain breaks. Dead Space's rule: the
 * read lives in the world, so it works before any HUD does.
 *
 * It reads the boss's public `combo` ('open' | 'frozen' | 'pinned' | 'down');
 * it sets no hook, so main.js's hit stop on `onComboStep` is untouched.
 *
 * Everything is MeshBasic (no `uLightDir` pass, AGENTS rule 5) under the level
 * root (rule 6). The board's words are a CanvasTexture bound as `map`, which
 * dispose frees; under `node --test` there is no `document`, so the board is a
 * plain face and the lamps still work.
 */
const STEPS = [
  { word: 'FREEZE', colour: 'blue', state: 'frozen' },
  { word: 'PIN', colour: 'green', state: 'pinned' },
  { word: 'KNOCK', colour: 'red', state: 'down' },
];
const LIT = { open: 0, frozen: 1, pinned: 2, down: 3 };

export class ComboRack {
  /**
   * @param {THREE.Object3D} parent  the level root
   * @param {object} spec
   * @param {number[]} spec.at      the board's centre [x, y, z]
   * @param {number} [spec.facing]  yaw in radians; 0 faces +z
   * @param {string} spec.header    the line over the steps
   */
  constructor(parent, { at, facing = 0, header }) {
    const C = COMBO_RACK;
    this.group = new THREE.Group();
    this.group.name = 'combo-rack';
    this.group.position.set(...at);
    this.group.rotation.y = facing;
    parent.add(this.group);

    const face = new THREE.MeshBasicMaterial({ color: C.board, map: boardTexture(header) });
    if (face.map) face.color.setHex(0xffffff);
    this.board = new THREE.Mesh(new THREE.PlaneGeometry(C.width, C.height), face);
    this.group.add(this.board);

    this.lamps = STEPS.map((s, i) => {
      const mat = new THREE.MeshBasicMaterial({ color: PAINT[s.colour].hex });
      const lamp = new THREE.Mesh(new THREE.BoxGeometry(C.lamp, C.lamp, C.lamp), mat);
      lamp.position.set((i - 1) * C.width / 3, C.height / 2 + C.lampGap + C.lamp / 2, 0);
      lamp.userData.full = new THREE.Color(PAINT[s.colour].hex);
      this.group.add(lamp);
      return lamp;
    });
    this.lit = -1;
    this._show(0);
  }

  /** Steps landed so far: 0-3. */
  get steps() { return this.lit; }

  /** Watch a Big Arm (null or dead: all dark). */
  update(boss) {
    this._show(boss?.alive ? LIT[boss.combo] ?? 0 : 0);
  }

  _show(n) {
    if (n === this.lit) return;
    this.lit = n;
    this.lamps.forEach((lamp, i) => {
      lamp.material.color.copy(lamp.userData.full).multiplyScalar(i < n ? 1 : COMBO_RACK.dim);
    });
  }
}

/** The board's words, or null with no DOM (node --test). */
function boardTexture(header) {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = Math.round(1024 * COMBO_RACK.height / COMBO_RACK.width);
  const g = canvas.getContext('2d');
  if (!g) return null;
  const hex = (c) => `#${new THREE.Color(PAINT[c].hex).getHexString()}`;
  g.fillStyle = `#${new THREE.Color(COMBO_RACK.board).getHexString()}`;
  g.fillRect(0, 0, canvas.width, canvas.height);
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  // Each line shrinks to fit its slot, so a longer header or word never clips.
  const fit = (text, size, width) => {
    g.font = `bold ${size}px sans-serif`;
    const w = g.measureText(text).width;
    if (w > width) g.font = `bold ${Math.floor(size * width / w)}px sans-serif`;
  };
  g.fillStyle = COMBO_RACK.ink;
  fit(header, 54, canvas.width * 0.92);
  g.fillText(header, canvas.width / 2, canvas.height * 0.25);
  const third = canvas.width / 3;
  STEPS.forEach((s, i) => {
    g.fillStyle = hex(s.colour);
    fit(s.word, 70, third * 0.8);
    g.fillText(s.word, third * (i + 0.5), canvas.height * 0.58);
    g.font = 'bold 36px sans-serif';
    g.fillText(s.colour.toUpperCase(), third * (i + 0.5), canvas.height * 0.83);
    if (i < 2) {
      g.fillStyle = COMBO_RACK.ink;
      g.font = 'bold 60px sans-serif';
      g.fillText('›', third * (i + 1), canvas.height * 0.58);
    }
  });
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
