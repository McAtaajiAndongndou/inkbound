**Lane:** ui (Moses), who owns audio
**Priority:** MUST. The Gameplay & Experience A band (25%) says "immersive sound/music", and the game has no music
**PRD:** rubric, Gameplay & Experience; Innovation ("Sound?")
**Cost:** M
**Depends on:** nothing

### Context

A rubric check on 30 Oct found **no music anywhere in `src/`**. The game has a rich set of synthesised effects (`src/audio/audio-manager.js`, and more after the polish PRs), but between fights it's silent.

Gameplay & Experience is the biggest band, at 25%, and its A band asks for "immersive sound/music". Innovation lists "Sound?" as an example too.

### The design

**Synthesised, adaptive music that tells the theme: the world is drained, and you put colour back. No downloaded track, so no licence, and the team made all of it.**

Three layers, all WebAudio, all built from the same oscillators and filters the effects already use:

| Layer | What it is | Driven by |
|---|---|---|
| **Drone** (Corp) | A low, detuned, slowly beating pad through a low-pass filter. Cold and grey. | Always on; its filter closes as territory grows |
| **Colour** | A bright arpeggio in the level's key. Each paint colour adds a voice: blue a high bell, red a plucked bass, green a mid marimba. | Its gain follows **territory**: the same coverage value the HUD shows (#127) |
| **Combat** | A drum loop: kick and noise-snare. | Fades in while `inCombat` is true (the comms bar already computes it, #112), and out 3 s after |

Splatoon's music is the reference for tone: it changes with the match state, and the last minute is unmistakable. Ape Out and Rez are the references for a soundtrack built from the game's own state.

**Per level:** each level gets its own key and tempo (`MUSIC.levels[id]`), so the four levels sound different. That supports the brief's "each level introduces something new".

**Stingers:**
- a short rising chord on an arena clear
- a falling one on death
- a full cadence on the win screen

### Rules

- **Volume:** a separate **Music** slider in the options menu, next to Volume; default 0.6. Music ducks by 30% under the sergeant's lines.
- **Config:** a `MUSIC` block with tempo and key per level, layer gains, fade times and duck amount.
- **Performance:** schedule notes ahead with the WebAudio clock, using a look-ahead scheduler that is not driven per frame by `setTimeout`. No allocation per note beyond the oscillator nodes WebAudio requires.
- **Credits:** "Music: synthesised in-game by the Inkbound team". No third-party entry needed.

### Scope — files you may touch

- `src/audio/music.js` (new)
- `src/audio/audio-manager.js`
- `src/ui/menu.js` (the slider)
- `src/ui/credits.js`
- `src/config.js`
- `tests/`

The two inputs, territory and `inCombat`, are already computed in `main.js` and the HUD. Pass them through `hud.update`'s existing state, or ask Ozuko for one line in `main.js`.

### Acceptance criteria

- [ ] At territory 0, the colour layer's gain is 0; at territory ≥ `MUSIC.fullAt`, it's the configured maximum.
- [ ] The combat layer fades in within `MUSIC.combatFadeIn` of `inCombat` going true, and out `MUSIC.combatHold` seconds after it goes false.
- [ ] The Music slider at 0 silences music but not effects.
- [ ] Each level has its own key and tempo entry, and switching level switches them.
- [ ] Ducking: music gain drops while a comms line plays.
- [ ] `npm test` passes (WebAudio stubbed as in `tests/audio-manager.test.js`).

### Manual check

Outskirts: the opening is a cold drone. Paint island A and a melody starts. Wake island B's arena and the drums come in; clear it and they go, followed by the clear stinger.
