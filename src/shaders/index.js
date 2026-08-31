// OWNER: C (Shaders)
// Central registry. Import GLSL as strings via Vite's ?raw suffix so the
// .glsl files stay real files we can syntax-highlight and explain in the demo.
//
// RUBRIC: every team member must be able to explain the shader code.
// C writes it, C teaches it in a 20-minute session before the beta.

import splatVert from './splat/splat.vert.glsl?raw';
import splatFrag from './splat/splat.frag.glsl?raw';

export const SHADERS = {
  splat: { vertex: splatVert, fragment: splatFrag },
};
