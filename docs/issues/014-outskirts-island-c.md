**Lane:** levels (Renda)
**Priority:** MUST
**PRD:** E2
**Cost:** M
**Depends on:** #84, #101 for the trap volume, #103 for the blade

### Context

The trap room, and the level's best teaching moment: **will you use the hazard, or just avoid it?**

Four enemies, a swinging blade between cover blocks, and a back edge that overhangs the waste. Red knockback can put a Charger into the chasm — the room rewards the player who understands their own kit.

Design: `docs/levels/01-outskirts.md`, "Island C — the trap room".

### Scope — files you may touch

- `src/levels/level-01-mission.js` — Island C, its deck, its spawns, the blade
- The waste edge geometry

### Out of scope — do not touch

- The blade's swing behaviour
- The waste surface itself
- The return loop, which is issue #87

### Acceptance criteria

- [ ] Two Chargers on the floor, two Sprayers with one elevated
- [ ] An elevated Sprayer that only aggroes when the player climbs
- [ ] A swinging blade between two cover blocks, denying the middle of the room on a rhythm
- [ ] A waste edge close enough that a red knockback can send a Charger over it
- [ ] Environmental kills get a distinct sound and hit confirmation
- [ ] The room is the tightest paint budget in the level — a careless player can run dry

### Manual check

Fight it normally and confirm the blade forces you off the middle. Then deliberately knock a Charger into the waste. If you smile, it works; if it is hard to arrange, the edge is too far from the fight.

### Design note

**This is the minute to test.** The whole level's claim to being more than a tutorial rests on the player discovering that the hazard is a weapon. If nobody finds it unprompted, put a Charger nearer the edge.

### Definition of done

- [ ] `npm test` green
- [ ] No files touched outside the lane
