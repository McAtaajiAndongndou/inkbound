**Lane:** ui (Moses), who owns audio
**Priority:** SHOULD. Quality plan §10.2 ("check what's still silent"); Gameplay & Experience asks for immersive sound
**PRD:** rubric, Gameplay & Experience
**Cost:** S
**Depends on:** nothing

### Context

In QA on 30 Oct, Renda heard **nothing** from the Primer's spike pit or Last Colour's cargo crusher, while gunfire and jumps played fine.

The Levels side is not the cause. Run outside the browser, with `audio.play` stubbed, both traps call their sounds exactly as designed:

| Trap | Calls | Gain near the player |
|---|---|---|
| Spike pit (`src/levels/spike-pit.js` → `TrapVolume`) | `spike` on every hit | 1.0 |
| Cargo crusher (`src/levels/crusher.js` → `playAt`) | `tick` per tell blink, `crush` on the drop, `hiss` on the rise | 1.0 within `TRAP.hearing.near` (6 m) |

So the recipes in `src/audio/audio-manager.js` are too small to survive the mix:

- `spike`: a 0.07 s high-passed burst at gain 0.12, plus a 0.04 s square at 0.05. It plays at the same moment as `hurt` (0.16 s at 0.26), which buries it.
- `tick`: 0.025 s at 0.05. Inaudible under music at 0.6.
- `crush`: 0.32 s at 0.2. The loudest of them, and still not heard over music.

### The design

**A trap you cannot hear does not exist for you** (polish audit, Traps). Each trap sound has to be readable *on its own*, under music and over the hurt sound.

Recommended: **louder, longer, heavier recipes, tuned against the music**, not a new pipeline.

| Sound | Now | Target |
|---|---|---|
| `spike` | 0.07 s, gain 0.12 | ~0.2 s: a metallic *shing* (two detuned high squares) with a low thud under it; gain ~0.3. Clearly different from `hurt` |
| `crush` | 0.32 s, gain 0.2 | ~0.5 s: a low sine thump (80 → 40 Hz) under the clank; gain ~0.4. It is the beat of the level |
| `tick` | 0.025 s, gain 0.05 | ~0.05 s, gain ~0.15. The warning must be heard before the slam |
| `hiss` | 0.45 s, gain 0.07 | gain ~0.12 |

Alternative: recorded clips (Kenney's *Impact Sounds*, CC0). Truer metal, but it adds a loader for audio files, which the game doesn't have yet. Only worth it if §10.1 (recorded music) builds that loader anyway.

Keep the per-call `gain` (distance fade) and the pitch variance exactly as they are. The levels lane relies on `playAt` returning the same gain for the camera shake.

### Scope — files you may touch

- `src/audio/audio-manager.js` (the `spike`, `crush`, `tick` and `hiss` recipes only)
- `tests/audio-manager.test.js`

Nothing in `src/levels/`: the call sites are correct.

### Acceptance criteria

- [ ] `spike`, `crush`, `tick` and `hiss` each schedule at least one node with peak gain ≥ the target above (assert through the stubbed WebAudio, as the existing tests do).
- [ ] `spike` lasts ≥ 0.15 s, so it outlasts `hurt`'s attack.
- [ ] A call with `{ gain: 0.5 }` still halves every node's peak (the distance fade still works).
- [ ] `npm test` passes.

### Manual check

Music on at its default. Primer R6: walk onto grey spikes. You hear a metallic snap that is clearly not the hurt thud. Last Colour corridor: stand 3 m from the crusher with your eyes shut, and you can count the tick-tick-tick-SLAM rhythm.
