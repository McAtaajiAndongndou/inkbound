// OWNER: E (UI & Audio)
// The sergeant's comms-bar lines (#112): one per level, at a calm, scripted beat.
// Levels ask for these by id through `game.say(id)` and never hold the text.
//
// The wording is Renda and Moses's. The Primer's three are the level doc's own
// (docs/levels/00-the-primer.md); the other three are a FIRST DRAFT (30 Oct)
// for them to rewrite. A line with `text: null` is silent: the trigger fires,
// the bar logs "no line written", and nothing shows. Keep each line short —
// one line on screen, read in a few seconds.

export const COMMS_LINES = {
  // The Primer, R2: the first paintable wall.
  'primer-splat': { who: 'Sergeant', text: "That's colour. It changes what you can do, not just what you see." },
  // The Primer, R2's pool (polish audit): the refill verb, which no room taught.
  'primer-submerge': { who: 'Sergeant', text: "That's your ammo too. Hold Shift to sink into it and refill fast." },
  // The Primer, on climbing into R6: R7's Charger ahead, still asleep. Asked a
  // room early, because walking into R7 wakes it and a fight clears the bar.
  'primer-theirs': { who: 'Sergeant', text: "One of theirs. It won't stop. Make the ground stop it instead." },
  // The Primer, R9: extraction.
  'primer-ready': { who: 'Sergeant', text: "You're ready. Outskirts — go." },
  // Outskirts: the extraction ledge, after island C is won — the view back over
  // the trail you painted (the decor reveal; docs/levels/01-outskirts.md).
  'outskirts-ledge': { who: 'Sergeant', text: 'Look back. Every colour down there is yours. The mountain is next.' },
  // The Ascent: the summit, R7 — no enemies, the base on the horizon, its stack
  // the Siphon (docs/levels/02-the-ascent.md).
  'ascent-summit': { who: 'Sergeant', text: "See that stack on the horizon? That's the Siphon. That's where the colour goes." },
  // Last Colour: arriving at the base, the Siphon's beacon over the hangar
  // (docs/levels/03-last-colour.md).
  'last-colour-base': { who: 'Sergeant', text: 'This is where they drain it. Shut the Siphon down and it all comes back.' },
};
