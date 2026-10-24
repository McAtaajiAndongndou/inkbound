**Lane:** shaders (Lethabo)
**Priority:** SHOULD
**PRD:** M6, M7, M8
**Cost:** M
**Depends on:** 042 — **do not start if the spike failed**

### Context

Three zombies and a boss remain: the Drainer, the Charger zombie, and Big Arm. All three are chosen and sourced in `docs/ASSETS.md`; none is in the build.

They are grouped because they share one rig family and one loading path. If 042 proved the pipeline, this is mechanical; if it did not, this issue should not be opened.

### Scope — files you may touch

- `public/assets/` — three GLBs
- `src/enemies/enemy.js` — model attachment for the three types
- `docs/ASSETS.md`, `src/ui/credits.js`

### Out of scope — do not touch

- Their behaviours
- The Drainer's territory eating, which is issue 008
- Big Arm's phases, which are issue 027

### Acceptance criteria

- [ ] Drainer, Charger zombie and Big Arm each load, scale and stand on the floor
- [ ] Drainer uses both postures: crawl while feeding, upright while hunting
- [ ] Big Arm reads as a boss by silhouette alone, from across the arena
- [ ] Each has a death reaction — clip if one exists, a rigged fall if not
- [ ] The box fallback still works for each
- [ ] CC-BY attribution recorded for all three

### Manual check

Put all three in one room and look at them from 30 m. You should be able to tell which is the boss without being told.

### Design note

**Silhouette before detail.** Big Arm's whole job is to read as a threat from across the arena. If it needs a health bar to communicate its importance, the model choice was wrong and `docs/ASSETS.md` needs revisiting.

### Definition of done

- [ ] `npm test` green
- [ ] PRD status for M6, M7 and M8 updated
- [ ] `docs/ASSETS.md` and `credits.js` updated
- [ ] No files touched outside the lane
