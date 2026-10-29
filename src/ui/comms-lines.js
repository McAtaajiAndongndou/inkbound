// OWNER: E (UI & Audio)
// The sergeant's comms-bar lines (#112): one per level, at a calm, scripted beat.
// Levels ask for these by id through `game.say(id)` and never hold the text.
//
// The wording is Renda and Moses's to write together (#112 keeps it out of
// scope). Until a line has text it is silent: the trigger fires, the bar logs
// "no line written", and nothing shows. Keep each line short — one line on
// screen, read in a few seconds.

export const COMMS_LINES = {
  // Outskirts: the extraction ledge, after island C is won (docs/levels/01-outskirts.md).
  'outskirts-ledge': { who: 'Sergeant', text: null },
  // The Ascent: the summit, R7 — no enemies, the base on the horizon (docs/levels/02-the-ascent.md).
  'ascent-summit': { who: 'Sergeant', text: null },
  // Last Colour: entering the base (docs/levels/03-last-colour.md).
  'last-colour-base': { who: 'Sergeant', text: null },
};
