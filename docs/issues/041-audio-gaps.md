**Lane:** ui (Moses)
**Priority:** SHOULD
**PRD:** I2, I3, I4
**Cost:** S
**Depends on:** nothing

### Context

Audio is the project's quietest success: everything is synthesised in `audio-manager.js`, so there are no files, nothing to dispose, and it works offline on lab machines. Seven sounds exist.

The gap is everything that is not combat. Combat has fire, splat, hit, kill and a windup whine; the world around it is silent.

### Scope — files you may touch

- `src/audio/audio-manager.js` — new recipes in the `SFX` table
- The call sites that play them

### Out of scope — do not touch

- Adding audio files or a music track
- The volume/mute plumbing, which works
- Enemy behaviour

### Acceptance criteria

- [ ] **Gate opening** plays when an encounter gate clears
- [ ] **Painting has a sound** — the floor being claimed, not just the shot
- [ ] Every enemy's windup telegraph is audible, not only visible
- [ ] Trap triggers are audible: spike pit, collapsing segment, blade
- [ ] Jump and land have a sound
- [ ] No sound plays while the pause menu is open
- [ ] Every new sound is a synthesised recipe with no asset file

### Manual check

Play a level with your eyes closed for thirty seconds. You should be able to tell when you are painting, when an enemy is about to attack, and when a gate opens.

### Design note

Keep them short and quiet. The existing palette is sparse and dry, and a loud world would fight the visuals rather than support them. If a new sound is the loudest thing on screen, it is wrong.

### Definition of done

- [ ] `npm test` green
- [ ] PRD status for I2, I3 and I4 updated
- [ ] No files touched outside the lane
