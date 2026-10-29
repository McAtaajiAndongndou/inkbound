**Lane:** shaders (Lethabo)
**Priority:** MUST
**PRD:** M4, M13
**Cost:** S
**Depends on:** nothing — and nothing may depend on this until it passes

### Context

`docs/ASSETS.md` has one non-negotiable pipeline rule: **validate one GLB before any bulk download.** It was done for the soldiers and never for the zombies, so every zombie, turret and boss model is unproven.

This issue is the spike. It uses the wall-crawler — Quaternius "Zombie half" — because it is the hardest case: a different rig, a different scale, and a crawl/climb clip set.

**If this fails, the answer is well-shaded boxes, not a week of rigging.** `DESIGN.md` already says so.

### Scope — files you may touch

- `public/assets/` — the one GLB
- `src/enemies/enemy.js` — loading, scaling and feet-offset wiring
- `docs/ASSETS.md` — attribution entry
- `src/ui/credits.js` — the credit

### Out of scope — do not touch

- Any other model
- The Charger and Sprayer, which already work
- The paint shader's internals

### Acceptance criteria

- [ ] The GLB loads and is scaled to enemy height, with feet on the floor
- [ ] Its clips play through the existing `AnimationMixer` path
- [ ] It does not break the paint shader or the collision capsule
- [ ] Draw calls and file size are recorded, and a guess at the cost of five more is written down
- [ ] The box fallback still works when the model is missing
- [ ] CC-BY attribution is added to `credits.js` in the same commit

### Manual check

Spawn one wall-crawler in the Ascent's terrace and watch it for a minute. If it slides, floats, sinks or T-poses, the spike failed.

### Design note

**Record the failure honestly if it fails.** "Zombie models do not work with the current pipeline, here is why" is a far more useful outcome than a half-working model nobody trusts — and it decides M5–M8 in one afternoon.

### Definition of done

- [ ] `npm test` green
- [ ] PRD status for M4 and M13 updated
- [ ] `docs/ASSETS.md` and `credits.js` updated
- [ ] A go/no-go note added to this issue for M5–M8
