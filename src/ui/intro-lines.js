// OWNER: E (UI & Audio)
// Mission intros (docs/mission-intro.md, PRD G4), keyed by the level ids in the
// ONE list (levels/index.js).
//
//   card   the title card: level, location, day · time, objective. DRAFT text —
//          Renda and Moses rewrite it. The objective is one sentence and names
//          a place the intro shows.
//   from   the camera's start shot, { pos, target } in world metres, or null for
//          no camera move. It frames the level's goal FROM THE PLAYER'S SIDE —
//          facing the way the player faces at spawn — so the move is a pull-back
//          to the player's shoulder, never a turn. The end shot is the play
//          camera itself (main.js), so it is not listed here.
//   goal   the objective marker: { label, point } — a pulsing diamond pinned to
//          the goal for the length of the intro, so the shot says WHICH thing
//          is the goal (Outskirts' ledge read as "some grey blocks" without it).
//          The points are each level's own goal or win volume.
//
// The Primer has no camera move: its briefing still (#111) carries its card, so
// the tutorial still starts moving inside 8 s.

export const INTROS = {
  primer: {
    card: { name: 'The Primer', location: 'Rebel training yard', when: 'Day 1 · 05:40', objective: 'Learn the colours.' },
    from: null,
  },
  outskirts: {
    card: { name: 'Outskirts', location: 'The drained forest', when: 'Day 3 · 06:10', objective: 'Cross the islands. Get out alive.' },
    // Over Island C, on the Ledge and its extraction (z −38, 14 m up).
    from: { pos: [4, 20, -20], target: [0, 13, -40] },
    goal: { label: 'Extraction', point: [0, 13.5, -43.75] },   // L1.extraction, on the ledge (y 12)
  },
  ascent: {
    card: { name: 'The Ascent', location: 'The mountain road', when: 'Day 4 · 14:20', objective: 'Climb to the supply lift.' },
    // In front of the lift tower on the summit (box x ±3, y 43–56, z 12–18).
    from: { pos: [0, 54, 32], target: [0, 50, 15] },
    goal: { label: 'Supply lift', point: [0, 50.8, 18] },       // ASCENT.goal
  },
  'last-colour': {
    card: { name: 'Last Colour', location: 'Corrupt Corp base', when: 'Day 4 · 23:50', objective: 'Find the Siphon. Shut it down.' },
    // Up the corridor, on the Siphon and its beacon (x 0, z −36, 22–27 m).
    from: { pos: [0, 24, -8], target: [0, 14, -36] },
    goal: { label: 'The Siphon', point: [0, 11, -31] },         // LAST_COLOUR.goal
  },
};
