**Lane:** core (Ozuko) for the camera cue; ui/audio (Moses) for the sound; shaders (Lethabo) for the footfall splash
**Priority:** MUST. Renda's loop-pass QA, 30 Oct: the grey slow is invisible
**PRD:** rubric, Gameplay & Experience (feedback), Interaction
**Cost:** S–M (three small pieces, one per lane)
**Depends on:** nothing

### Context

Renda, playing loop-pass step 5 (grey's slow 0.6 → 0.85): *"I don't feel the difference. This entire time I didn't notice that I was slower on grey compared to on green. It felt the same."*

The slow **is** applied (`player.js`, `standSlow`): before step 5 the player walked at 4.2 m/s on grey and 7 m/s on paint, a 40% cut, and nobody felt it. The only cue is the `sludge` footstep (`src/ui/feedback.js`). Like the trap sounds (#215), its recipe is tiny: a 0.12 s low-pass burst at gain 0.07. Nothing visual changes.

**A speed change the player can't perceive does no design work.** It doesn't say "paint ahead"; it only makes the whole game feel slow (QA: "this game is slow"). Splatoon makes enemy ink unmistakable: you sink to your ankles, the footsteps squelch, and movement visibly drags.

### The design: make the contrast felt, both ways

| Piece | Lane | What |
|---|---|---|
| **Camera** | core | On grey, a slightly heavier walk bob and FOV a touch narrower (about −3°); on your own paint, back to normal. The FOV pair reads as speed even without looking at your feet. Numbers in `CAMERA`. |
| **Sound** | ui/audio | `sludge` long and loud enough to hear under music (about 0.2 s, gain 0.2 or more), wet and heavy; paint footsteps stay light and quick. |
| **Feet** | shaders | A small grey splash or drag at each footfall on grey, and a colour splash on your paint (the avatar already knows the colour underfoot for the swim pass). |

Do the camera piece first: it's the cheapest, and it's felt even with the sound off.

### Scope

- core: `src/core/camera-rig.js`, `src/config.js` (`CAMERA`)
- ui/audio: `src/audio/audio-manager.js` (the `sludge` recipe only), `src/ui/feedback.js`
- shaders: `src/shaders/avatar.js`
- `tests/` for each

### Acceptance criteria

- [ ] Standing on grey vs your own paint changes the camera (bob and/or FOV) by configured amounts, easing between them.
- [ ] The `sludge` step is audible under music at its default volume.
- [ ] Footfalls on grey show a grey splash; on paint, a colour splash.
- [ ] `npm test` passes.

### Manual check

Outskirts: walk from your paint onto grey and back, sound off first, then on. Without being told, a new player should say grey is slower.
