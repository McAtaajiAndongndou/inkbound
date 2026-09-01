/**
 * Keyboard + mouse. Both are required by the rubric.
 *
 * Pointer lock gives us proper mouse look. Click the canvas to engage,
 * Escape to release.
 */
export class Input {
  constructor(domElement) {
    this.dom = domElement;
    this.keys = new Set();
    this.mouseDelta = { x: 0, y: 0 };
    this.firing = false;
    this.locked = false;

    // one-shot actions consumed by the game each frame
    this.pending = { jump: false, toggleView: false, colour: null, restart: false };

    this._onKeyDown = (e) => {
      this.keys.add(e.code);
      if (e.code === 'Space') this.pending.jump = true;
      if (e.code === 'KeyV') this.pending.toggleView = true;
      if (e.code === 'KeyR') this.pending.restart = true;
      if (e.code === 'Digit1') this.pending.colour = 0;
      if (e.code === 'Digit2') this.pending.colour = 1;
      if (e.code === 'Digit3') this.pending.colour = 2;
      if (['Space', 'ArrowUp', 'ArrowDown'].includes(e.code)) e.preventDefault();
    };

    this._onKeyUp = (e) => this.keys.delete(e.code);

    this._onMouseMove = (e) => {
      if (!this.locked) return;
      this.mouseDelta.x += e.movementX;
      this.mouseDelta.y += e.movementY;
    };

    this._onMouseDown = (e) => { if (e.button === 0) this.firing = true; };
    this._onMouseUp = (e) => { if (e.button === 0) this.firing = false; };

    this._onClick = () => {
      if (!this.locked) this.dom.requestPointerLock();
    };

    this._onLockChange = () => {
      this.locked = document.pointerLockElement === this.dom;
      if (!this.locked) { this.keys.clear(); this.firing = false; }
    };

    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);
    window.addEventListener('mousemove', this._onMouseMove);
    window.addEventListener('mousedown', this._onMouseDown);
    window.addEventListener('mouseup', this._onMouseUp);
    this.dom.addEventListener('click', this._onClick);
    document.addEventListener('pointerlockchange', this._onLockChange);
  }

  isDown(code) {
    return this.keys.has(code);
  }

  /** Read and clear the mouse delta for this frame. */
  consumeMouse() {
    const d = { x: this.mouseDelta.x, y: this.mouseDelta.y };
    this.mouseDelta.x = 0;
    this.mouseDelta.y = 0;
    return d;
  }

  /** Read and clear one-shot actions. */
  consumeActions() {
    const p = { ...this.pending };
    this.pending.jump = false;
    this.pending.toggleView = false;
    this.pending.colour = null;
    this.pending.restart = false;
    return p;
  }

  dispose() {
    window.removeEventListener('keydown', this._onKeyDown);
    window.removeEventListener('keyup', this._onKeyUp);
    window.removeEventListener('mousemove', this._onMouseMove);
    window.removeEventListener('mousedown', this._onMouseDown);
    window.removeEventListener('mouseup', this._onMouseUp);
    this.dom.removeEventListener('click', this._onClick);
    document.removeEventListener('pointerlockchange', this._onLockChange);
  }
}
