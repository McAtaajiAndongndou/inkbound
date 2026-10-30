**Lane:** shaders (enemies), Lethabo
**Priority:** SHOULD. Quality plan §4.2 and §6.3 (A1, A2, A4); Phase 2
**PRD:** rubric, Gameplay & Experience (readability), Visual
**Cost:** S
**Depends on:** `levels/charger-zombie-model` (every level's Charger now wears `zombie-charger.glb`)

### Context

QA on 30 Oct: the Charger "just kind of jumps towards me". Levels has done its half of §4.2: `ENEMY.charger.model = 'chargerZombie'`, so every Charger now uses the zombie charger model, which has proper clips. The enemy only plays three of them (`CLIPS.chargerZombie`: `Idle`, `Run`, `Run_Attack`). The file has more that nothing uses:

`Crawl, Death, HitReact, Idle, Idle_Attack, Jump, Jump_Idle, Jump_Land, No, Punch, Run, Run_Arms, Run_Attack, Walk, Wave, Yes` (read from the GLB on 30 Oct)

On death, every enemy only sinks (`_sinkDeath`). §6.2: "`HitReact` and `Death` exist on four enemy models, and no enemy ever plays them."

### The design

In priority order, smallest first. Each one is a separate change:

1. **The windup tell (A2, §4.2).** Before a charge, play `Idle_Attack` for about **0.4 s**: a lean back, then commit. It must **not** zero the Charger's momentum. The old windup was removed because it planted the Charger (the comment in `ENEMY.charger`), so this one is a pose over the existing movement, not a stop. This is what turns "jumps towards me" into "I saw it coming". CoD's dogs and Doom's Pinky both have a beat before the lunge.
2. **Death before the sink (A4).** Play `Death` (clamped on its last frame), then the existing sink and burst. The kill reads as a kill, not as the floor swallowing it.
3. **Hit reaction (A1).** `HitReact` as a short override (about 0.2 s) or layered over locomotion, on every hit.

Numbers (windup length, hit-react length) go in `ENEMY.charger` / config, per AGENTS rule 4.

### Scope — files you may touch

- `src/enemies/enemy.js` (`CLIPS.chargerZombie`, `_play`, the windup and death paths)
- `src/config.js` (`ENEMY.charger` timings)
- `tests/`

Not `src/levels/`: the model choice is done.

### Acceptance criteria

- [ ] A Charger about to charge plays `Idle_Attack` for the configured windup, and its planar speed does not drop to 0 during it.
- [ ] A killed zombie Charger plays `Death` before it sinks; the sink and burst still happen and it is still disposed.
- [ ] A hit plays `HitReact` without stopping the charge.
- [ ] Soldiers (Sprayer) are unaffected: they have no such clips and keep `RELOAD_LEAN` and the procedural lean.
- [ ] `npm test` passes (clip choice testable with a stand-in model, as `_gait` is).

### Manual check

Primer R7: wake the Charger and watch it. It leans back, then charges; hit it and it flinches; kill it and it falls, then sinks.
