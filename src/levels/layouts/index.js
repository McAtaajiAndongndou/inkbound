// OWNER: E (Levels)
//
// Every layout that is data, by registry id (src/levels/index.js). The design
// tools in docs/levels/massing/ read this list, so a new layout gets a massing
// model, a plan, sections and a pacing chart by being added here.
import { ASCENT } from './ascent.js';
import { LAST_COLOUR } from './last-colour.js';

export const LAYOUTS = {
  [ASCENT.id]: ASCENT,
  [LAST_COLOUR.id]: LAST_COLOUR,
};
