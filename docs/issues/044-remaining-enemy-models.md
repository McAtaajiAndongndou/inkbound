**Lane:** shaders (Lethabo)
**Priority:** SHOULD
**PRD:** M6, M7, M8, M14
**Cost:** M
**Depends on:** #114 — **do not start if the spike failed**

### Context

Four enemies have no model at all: the **Drainer**, the **Charger zombie**, **Big Arm**, and the **Stalker**.

Three are chosen and sourced in `docs/ASSETS.md`. The **Stalker is not** — it was invented after that file was written, so nothing has ever been picked for it. Sourcing it is part of this issue.

They are grouped because they share one rig family and one loading path. If #114 proved the pipeline, this is mechanical; if it did not, this issue should not be opened.

### Scope — files you may touch

- `public/assets/` — four GLBs, one of which must first be sourced
- `src/enemies/enemy.js` — model attachment for the four types
- `docs/ASSETS.md`, `src/ui/credits.js`

### Out of scope — do not touch

- Their behaviours
- The Drainer's territory eating, which is issue #80
- Big Arm's phases, which are issue #99

### Acceptance criteria

- [ ] Drainer, Charger zombie, Big Arm and Stalker each load, scale and stand on the floor
- [ ] Drainer uses both postures: crawl while feeding, upright while hunting
- [ ] Big Arm reads as a boss by silhouette alone, from across the arena
- [ ] **The Stalker is distinguishable from the wall-crawler at 20 m** — different silhouette, not just a tint
- [ ] Each has a death reaction — clip if one exists, a rigged fall if not
- [ ] The box fallback still works for each
- [ ] CC-BY attribution recorded for all four

### Manual check

Put all three in one room and look at them from 30 m. You should be able to tell which is the boss without being told.

### Design note

**Silhouette before detail.** Big Arm's whole job is to read as a threat from across the arena. If it needs a health bar to communicate its importance, the model choice was wrong and `docs/ASSETS.md` needs revisiting.

### Definition of done

- [ ] `npm test` green
- [ ] PRD status for M6, M7 and M8 updated
- [ ] `docs/ASSETS.md` and `credits.js` updated
- [ ] No files touched outside the lane
