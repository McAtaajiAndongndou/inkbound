// OWNER: E (Levels)
// Every level extends this. The dispose() contract is not optional —
// it is what stops the tab dying during a three-level demo in front of a marker.
export class LevelBase {
  constructor(game) { this.game = game; this.root = null; }

  async load()   { throw new Error('implement load()'); }
  update(dt)     { throw new Error('implement update()'); }

  dispose() {
    // Traverse and .dispose() every geometry, material and texture,
    // then remove root from the scene. See docs/conventions.md.
    throw new Error('implement dispose()');
  }
}
