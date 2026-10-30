**Lane:** paint (Dikeledi)
**Priority:** SHOULD. Quality plan §3.2, Phase 1
**PRD:** rubric, Gameplay & Experience
**Cost:** M
**Depends on:** loop pass step 7 (spread) verdict

**Gate:** Phase 1 builds wait on the loop pass (`docs/playtests/loop-pass.md`): one change at a time, played against `main`, kept or dropped by Renda. Don't build this until its row there has a **keep**, and it needs a `docs/DECISIONS.md` entry (the plan marks it "decision needed").

### Context

QA, 30 Oct: Renda saw no difference between hip-fire and aiming in painting, because there is none. The modes only differ in spread (`hipSpread` 0.025, `adsSpread` 0.005). Splat size, cost and damage are identical. Splatoon splits painting and fighting across weapon classes; with one gun, the two firing modes have to *be* two weapons, which gives the player a decision every second: build ground, or win this duel?

### Change (plan §3.2, recommended)

Split `PAINT_GUN` into `hip` and `ads` blocks in config:

| | Hip-fire: the painter | ADS: the duellist |
|---|---|---|
| Pattern | Cone of 3 droplets per shot | One stream |
| Spread | 0.06 rad | 0.004 rad |
| Splat radius | 1.8 m per droplet | 0.7 m |
| Range | 18 m | 30 m |
| Cost | 2 | 3 |
| Damage | 5 per droplet (up to 15 point-blank) | 14 |
| Freeze build-up | One hit per shot | One hit per shot |

The arithmetic check: Sprayer 40 hp, ADS 3 hits ≈ 0.42 s; hip at mid range ~8 shots ≈ 1.1 s.

**Alternative:** one pattern; vary only splat radius and damage by mode. Half the code, most of the feel.

### Scope — files you may touch

- `src/paint/paint-gun.js`, `src/config.js` (`PAINT_GUN`)
- `tests/`

### Acceptance criteria

- [ ] Hip-fire fires three droplets with the hip numbers; ADS fires one with the ADS numbers.
- [ ] Each mode's cost, range, radius and damage come from its config block.
- [ ] The freeze build-up counts one hit per shot in both modes.
- [ ] `npm test` passes.

### Manual check

Outskirts island A: paint a road with hip-fire, then duel the Sprayer with ADS. The two should feel like two weapons.
