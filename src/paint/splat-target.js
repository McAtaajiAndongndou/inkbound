// OWNER: B (Paint)
// Manages the WebGLRenderTarget(s) the splats accumulate into.
// PERFORMANCE: one shared target per level, not one per mesh.
// MEMORY: dispose() this on level teardown or the tab dies on playthrough 3.
export class SplatTarget {
  constructor() { throw new Error('TODO: B'); }
}
