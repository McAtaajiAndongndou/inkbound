**Lane:** levels (Renda)
**Priority:** COULD
**PRD:** F3
**Cost:** S
**Depends on:** 029, 021 (the chain room it lives in)

### Context

The chase hazard in the Ascent: a boulder that comes down the safe switchback on room entry, so the "safe" route is not free. It is the reason a player takes the risky red-pad chain instead of walking up the easy path.

Design: `docs/levels/02-the-ascent.md`, room R5.

### Scope — files you may touch

- `src/levels/level-02-ascent.js` — the boulder and its path
- `src/config.js` — speed and trigger distance

### Out of scope — do not touch

- The chain or the switchback geometry
- The wall-crawler on the cliff

### Acceptance criteria

- [ ] The boulder triggers once, when the player enters the room
- [ ] It travels the switchback at a speed that a moving player can outrun
- [ ] Contact damages and pushes, it does not instantly kill
- [ ] It despawns at the bottom rather than rolling forever
- [ ] It is audible before it is visible
- [ ] A player on the chain is never hit by it

### Manual check

Enter the room and walk the switchback slowly — you should be caught. Then do it again at a run and you should escape. Both outcomes need to be achievable.

### Design note

Its purpose is persuasion, not lethality. It exists so the player chooses the chain, and a trap that kills people who chose the intended route is the wrong trap.

### Definition of done

- [ ] `npm test` green
- [ ] No files touched outside the lane
