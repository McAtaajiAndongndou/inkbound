**Lane:** levels (Renda)
**Priority:** MUST
**PRD:** J2
**Cost:** S
**Depends on:** nothing

### Context

Only Outskirts has atmosphere. The Ascent and Last Colour use the scene's default fog and nothing else, so two of the four levels have no mood and the campaign arc has no visual shape.

`docs/DECISIONS.md`: **the Ascent is cold dawn, Last Colour is sickly amber interior.** Outdoors and exposed, then inside the machine that did it.

### Scope — files you may touch

- `src/levels/level-02-ascent.js` — sky, fog, light
- `src/levels/level-03-horde.js` — sky, fog, light
- `src/config.js` — colours if they need a home

### Out of scope — do not touch

- The paint shader
- Outskirts' existing mood
- Geometry

### Acceptance criteria

- [ ] **Ascent:** pale blue-white haze, low sun, long shadows, a cold sky
- [ ] **Last Colour:** warm amber haze, hard shadows, near-black ceiling
- [ ] Fog colour matches each level's horizon, not its zenith — the mistake `level-01` documents at length
- [ ] Both levels hide their atmosphere from the minimap pass, as Outskirts does
- [ ] Neither mood makes an enemy harder to see than on Outskirts
- [ ] The change is level-owned and disposed with the level

### Manual check

Load each level and look at the sky, then at a distant surface. The distance should dissolve into the horizon colour. If the sky looks like a flat plate, the fog colour and the background colour have been set to the same value.

### Design note

`level-01-mission.js` contains a long comment on why fog must match the horizon and never the background. **Read it before starting** — it is the one documented mistake in this codebase that two people have already made.

### Definition of done

- [ ] `npm test` green
- [ ] PRD status for J2 updated
- [ ] No files touched outside the lane
