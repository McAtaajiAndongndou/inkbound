// OWNER: B (Paint)
// Translates a sampled colour into physics values, using config/colours.js.
// Player asks: "I'm standing here, what's my friction?" -> this answers.
import { SURFACE_RULES, PAINT } from '../config/colours.js';

export function rulesAt(colourId) {
  return SURFACE_RULES[colourId] ?? SURFACE_RULES[PAINT.GREY.id];
}
