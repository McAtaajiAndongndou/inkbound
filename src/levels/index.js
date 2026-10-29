// OWNER: E (Levels)
//
// The ONE level list. If a second copy of this exists anywhere -- a menu array,
// a switch in main.js, a test fixture -- then adding a level will work in one
// place and be missing in another, and the missing one is always the menu.
//
// The contract is deliberately tiny: an id, the name the player sees, and a
// factory. Names are the ones fixed in `docs/DECISIONS.md` ("Level names"), not
// invented per screen.
import { Level00 } from './level-00-the-primer.js';
import { Level01 } from './level-01-mission.js';
import { Level02 } from './level-02-ascent.js';
import { Level03 } from './level-03-horde.js';

export const LEVELS = [
  { id: 'primer',      name: 'The Primer',  create: (game) => new Level00(game) },
  { id: 'outskirts',   name: 'Outskirts',   create: (game) => new Level01(game) },
  { id: 'ascent',      name: 'The Ascent',  create: (game) => new Level02(game) },
  { id: 'last-colour', name: 'Last Colour', create: (game) => new Level03(game) },
];

// The level a new player lands in. Still `outskirts`, not `primer`: the Primer
// is a blockout now (29 Oct), but without its sergeant (#111/#112) or its trap
// (#101) it does not teach yet. Switching the start is a campaign decision for
// when it does -- and main.js has always started here.
export const DEFAULT_LEVEL_ID = 'outskirts';

/** The registry entry for `id`, falling back to the default rather than throwing. */
export function levelEntry(id) {
  const entry = LEVELS.find((l) => l.id === id);
  if (entry) return entry;

  // A bad id (a stale bookmark, a typo in `?level=`) must not leave a dead page.
  // The menu issue (#006) asks for the same guarantee one layer up.
  console.warn(`[levels] unknown level "${id}" — loading ${DEFAULT_LEVEL_ID}`);
  return levelEntry(DEFAULT_LEVEL_ID);
}

/** Build a level instance. Callers then `await level.load()`. */
export function createLevel(id, game) {
  return levelEntry(id).create(game);
}
