// OWNER: A (Core)
// Single source of truth for keyboard + mouse. Nothing else adds key listeners.
// Rubric requires BOTH keyboard and mouse to work.
export class Input {
  constructor() { throw new Error('TODO: A'); }
  // isDown(action) -> bool     e.g. 'forward', 'jump', 'ads'
  // consumePressed(action)     one-shot, cleared after read
  // get lookDelta()            {x, y} pointer-lock mouse movement this frame
}
