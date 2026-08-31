// OWNER: B (Paint)
// The heart of the game. Owns the splat render target and answers the
// question every other system asks: "what colour is this point on this surface?"
//
// Design: each paintable mesh has a UV-space paint texture. Splats are drawn
// into it with an orthographic camera + additive quad. Reading back is done on
// the CPU from a low-res mirror of the same buffer (do NOT readPixels per frame).
export class PaintSystem {
  constructor() { throw new Error('TODO: B'); }
  // splat(worldPos, normal, colourId, radius)
  // sampleAt(worldPos) -> colourId
  // coverage() -> 0..1   (drives killstreaks + level 3 drain)
  // dispose()
}
