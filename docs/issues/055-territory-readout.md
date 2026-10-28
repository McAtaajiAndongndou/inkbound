**Lane:** ui (Moses)
**Priority:** SHOULD
**PRD:** B3
**Cost:** S
**Depends on:** #73 (the number should reflect the shared-tank world, not per-colour ammo)

### Context

The HUD prints `Coverage: 34%`. It is a debug counter — it does not tell the player whether they are safe, whether they can refill, or what they are losing when a Sprayer shoots the floor.

Territory is the game's core resource and the HUD barely mentions it.

### Scope — files you may touch

- `src/ui/hud.js` — the readout
- `src/ui/style.css`

### Out of scope — do not touch

- The minimap's rendering — it already draws painted ground correctly
- The scorecard, which is issue #110
- The paint shader

### Acceptance criteria

- [ ] The readout is relabelled from **Coverage** to **Territory**
- [ ] It is tinted with the player's current colour, so it reads as ground held
- [ ] When enemy grey is eating the level, the number falling is noticeable without staring at it
- [ ] The minimap is understood to be the primary territory view; the number is a summary
- [ ] The readout does not update more than a few times a second — it is a grid scan

### Manual check

Play a wave in Last Colour and watch the number while the Drainers work. You should notice it dropping without looking directly at it. If you have to hunt for it, the readout is in the wrong place or the wrong size.

### Design note

Do not add a second bar. The HUD already carries ammo, health and four colour swatches; a fifth element makes all of them harder to read. Rewrite the existing one instead.

### Definition of done

- [ ] `npm test` green
- [ ] PRD status for B3 updated
- [ ] No files touched outside the lane
