**Lane:** shaders (Lethabo)
**Priority:** MUST
**PRD:** AN4, AN5
**Cost:** M
**Depends on:** nothing — and #82 and #122 are blocked on it

### Context

The player model has 62 joints and 24 clips, but **none of them are jump, fall, land or climb**. Those four states are the most visible gaps in the build.

`docs/ASSETS.md` already lists the source: the **Quaternius Universal Animation Library**, which shares the rig family. It has never been downloaded or tested.

This issue is the integration: get the library in, prove it maps onto the existing rig, and register the clips so #82 and #122 can just ask for them.

### Scope — files you may touch

- `public/assets/` — the library or the extracted clips
- `src/shaders/avatar.js` — clip registration and name mapping
- `docs/ASSETS.md`, `src/ui/credits.js` — attribution
- `src/config.js` — blend durations if needed

### Out of scope — do not touch

- The state machine that decides *when* to play them — that is #82 and #122
- Enemy animation
- The model itself

### Acceptance criteria

- [ ] Jump, fall, land and climb clips are available to `Avatar.play()`
- [ ] They drive the **existing** rig — no second skeleton, no re-import of the player mesh
- [ ] Clip names are mapped in one place, not scattered as string literals
- [ ] If a clip is missing from the library, that is recorded here rather than discovered later
- [ ] Loading failure degrades to the current clips instead of breaking the avatar
- [ ] Attribution recorded

### Manual check

Force each of the four clips to play in isolation and watch the model. If a clip rotates the character 90 degrees or drags them through the floor, the retarget is wrong and every issue downstream inherits it.

### Design note

**Record what the library does not have.** If there is no climb clip, say so in this issue and let #122 fall back to a borrowed clip — that is a far better outcome than #122 silently inventing one.

### Definition of done

- [ ] `npm test` green
- [ ] `docs/ASSETS.md` and `credits.js` updated
- [ ] A note added here listing which of the four clips exist
- [ ] No files touched outside the lane
