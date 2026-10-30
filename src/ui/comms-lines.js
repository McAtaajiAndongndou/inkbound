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
  // The Primer, on climbing into R6, BEFORE the spike pit (#217): the rule
  // before the tell before the danger — Half-Life 2 and Portal's order. R6's
  // entry is 12 m from the pit, and nothing in R6 starts a fight.
  'primer-trap': { who: 'Sergeant', text: 'Watch the boards — that floor bites. Blue slides over it.' },
  // The Primer, once you are past R6's spike pit (B5): R7's Charger ahead,
  // still asleep. Its wake waits 3 s after R7's doorway (`enter:R7+3`), so the
  // line is read before the fight clears the bar.
  'primer-theirs': { who: 'Sergeant', text: "One of theirs. It won't stop. Make the ground stop it instead." },
  // The Primer, R7's second wave: the chained Big Arm (QA 30 Oct). Wording
  // Renda's, added from the levels lane with Moses's OK.
  'primer-combo': { who: 'Sergeant', text: "That's a Big Arm. Bullets won't do it. Blue to freeze, green to pin, red to knock it flat." },
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
  // Last Colour: Big Arm leaves its bay (QA 30 Oct — the combo, said again).
  'last-colour-big-arm': { who: 'Sergeant', text: 'Big Arm. Same drill: freeze it, pin it, knock it flat. Three times.' },
  // Last Colour: the Siphon's first plate opens (its exam).
  'last-colour-siphon': { who: 'Sergeant', text: "It's a machine. Paint each plate the colour it's flashing." },
};
