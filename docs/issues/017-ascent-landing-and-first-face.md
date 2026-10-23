**Lane:** levels (Renda)
**Priority:** MUST
**PRD:** E3
**Cost:** S
**Depends on:** 002 — the level's whole pressure is that grey is slow, so it lands better once grey actually is

### Context

The Ascent begins the way it should: the player arrives, looks up, and the mountain is clearly not jumpable. Then a rock face with one paintable strip teaches the level's entire idea — **vertical routes are paint routes** — without a word.

Design: `docs/levels/02-the-ascent.md`, rooms R0 and R1.

### Scope — files you may touch

- `src/levels/level-02-ascent.js` — the landing and the first face
- Its `spawn`

### Out of scope — do not touch

- Terraces, catwalks, the chain, the summit — all separate issues
- `config.js` surface physics
- Level 1

### Acceptance criteria

- [ ] The landing is flat, wide and safe, with a clear sightline up the mountain
- [ ] The face is taller than any jump can reach
- [ ] Exactly one strip of the face accepts paint; the rest refuses it
- [ ] Green on that strip is climbable; blue and red do nothing there, and the player is allowed to discover that
- [ ] There are no enemies and no hazards in either room
- [ ] Falling off the face lands the player back on the landing, not into a death

### Manual check

Hand it to someone who has not read the design. If they try to jump the face before trying to paint it, that is fine. If they never try paint, the strip is not legible enough.

### Design note

No signposting. The strip should read as *the part of the wall that is not rock* — a stain, a drain pipe, or simply a different material. A floating coloured marker here would undo the lesson.

### Definition of done

- [ ] `npm test` green
- [ ] No files touched outside the lane
