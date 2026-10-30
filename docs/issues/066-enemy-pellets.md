**Lane:** shaders (Lethabo), who owns `src/enemies/`. Design sign-off: Renda
**Priority:** MUST. Today a ranged shot cannot be dodged or blocked, which breaks the telegraph language and the Turret's whole design
**PRD:** none new. Makes the existing enemy specs in `docs/enemies/algorithms.md` true
**Cost:** M
**Depends on:** nothing. `main.js` does not need to change (see "The seam")

### Context

Ranged enemies don't fire anything. When a Sprayer's amber wind-up ends, `Enemy._fireShot` (`src/enemies/enemy.js`) does two things in the same frame:

1. `_greyImpact` raycasts from the muzzle to the ground under the player and greys the **first surface it reaches**. That respects walls.
2. `onAttack` fires, and `main.js` wires it to `player.takeDamage(attackDamage)` **with no check at all**. That ignores walls, range and movement.

So the game contradicts itself: the grey splat lands on the wall you're hiding behind, and you take the damage anyway. Three specs are false today:

- **The telegraph** (#40). The amber wind-up warns of a hit you cannot avoid, so it teaches players to ignore warnings.
- **The Turret** (`algorithms.md`): "a track rate slow enough that strafing beats it"; "you either break line of sight and flank it, or you eat the burst". Neither works.
- **Cover.** Island C's block, Last Colour's containers and the Ascent's cover props stop nothing.

Found in the polish audit (`docs/polish-audit.md`, P0-1) and confirmed in the code, 30 Oct.

### The design (Renda, 30 Oct: the recommended default)

**Ranged enemies fire visible pellets, the way Splatoon's enemy ink does.** A pellet flies, can be dodged, is stopped by walls, and greys the ground wherever it lands, so even a miss costs you ground.

| Choice | Value | Why |
|---|---|---|
| Look | A dark Corp-grey ball with an **amber rim and a short amber trail** | Grey alone vanishes against a grey world. Amber is the game's one "this hurts" colour (`DANGER.amber`, #126). |
| Size | radius 0.15 m | Visible at 12 m without hiding the player |
| Speed | Sprayer and Wall-crawler **22 m/s**; Turret **30 m/s** | See "The dodge maths" |
| Path | Straight, with a light drop (gravity ~4 m/s²) | A slight arc reads as ink, not a bullet. Aim compensates for the drop, so a standing player is still hit. |
| Aim | The player's chest **where they are when the shot fires**. No leading. | Moving is how you dodge. A leading shot would make sidestepping pointless. |
| Burst | Unchanged: Sprayer 3 shots 0.12 s apart, Turret per its spec, plus a small random spread (~1.5°) | Already tuned; the reload after the burst stays the window to fight back |
| Hits the player | Touches the player's capsule (radius `PLAYER.radius` + pellet radius, height `PLAYER.height`) | |
| Hits a surface | Stops; greys a `greyRadius` circle **at the impact point** | The existing grey splat, moved from "end of wind-up" to "where it lands" |
| Range | Expires after flying `attackRange × 1.5`, or when below `PLAYER.killY` | A miss over a pit doesn't fly forever |
| Who fires pellets | Sprayer, Wall-crawler, Turret | |
| Unchanged | Charger, Stalker, Drainer, Big Arm's slam and grab | Melee hits are about reach, and already checked |

**The Turret's pellets do not grey the ground**, as today (it has no `greyRadius`), and still ignore stealth.

### The dodge maths

A Sprayer at its 12 m range with a 22 m/s pellet gives **0.55 s** of flight.

- On your paint (7 m/s), a sidestep covers 3.8 m in that time, an easy dodge.
- On **grey** (4.2 m/s, the `standSlow` penalty), you cover 2.3 m, which is still enough, but only if you react on the wind-up, not on the pellet.
- At 6 m, flight is 0.27 s: close range is where you get hit.

That's the intended shape. **Grey makes you easier to hit**, so painting your ground is also defence, and the Sprayer's preferred 8–12 m range is the band where dodging is possible but has to be earned.

A Turret at 15 m with a 30 m/s pellet gives 0.5 s, with a 0.8 s lock telegraph before it: strafe or break line of sight, exactly as its spec says.

### The seam: keep `onAttack`, move when it fires

`main.js` wires `enemy.onAttack = (e) => player.takeDamage(e.config.attackDamage)`. **Keep that line unchanged.** For a ranged enemy, `onAttack` fires **when a pellet touches the player**, not when the wind-up ends. Melee enemies keep calling it as they do now. That keeps the whole change inside `src/enemies/` and out of the core lane.

`_fireShot` becomes: spawn a pellet (ranged) or do what it does today (melee).

### Scope — files you may touch

- `src/enemies/enemy-shots.js` (new): one pooled set of pellets for the level. Pooled like `PaintGun`'s projectiles; **nothing allocated per shot or per frame**.
- `src/enemies/enemy.js`: `_fireShot` spawns a pellet for ranged enemies; `_greyImpact` takes an impact point instead of raycasting to the player.
- `src/config.js`: an `ENEMY_SHOT` block (radius, gravity, range factor, trail length) and a `shotSpeed` on the sprayer, wallCrawler and turret entries.
- `tests/`: the tests below.
- `docs/enemies/algorithms.md`: the Sprayer, Wall-crawler and Turret sections say "fires pellets"; add the dodge maths.

### Implementation notes

- **Hit test the swept segment**, from last frame's position to this frame's. At 30 m/s a pellet moves 0.5 m a frame, more than the player's radius, so a point test would let pellets pass through.
- Test the surfaces first, then the player, along the same segment, and take the nearer. A pellet that reaches a wall before the player stops at the wall.
- Custom-shaded pellets join the level's light-direction pass (AGENTS rule 5). A `MeshBasicMaterial` needs no light and avoids the issue.
- The pool is disposed with the level (AGENTS rule 6). The existing "ten reloads leak nothing" test must still pass.
- Dead enemies' pellets already in the air keep flying. That's fair, and it's what Splatoon does.

### Out of scope

- The player's own paint gun (`src/paint/`). Its "raycast, then fly to the hit point" model is right for the player and stays.
- New sounds (UI lane). Ask Moses for a wet "thwip" on fire and a splat on impact. Until then, play the existing `splat` quietly on impact.
- A damage-direction indicator (audit P0-4, UI lane). It gets easier with this: the pellet knows where it came from.
- Retuning damage. Play first; see the manual check.

### Acceptance criteria

- [ ] A Sprayer's shot at a **standing** player 10 m away hits, and damages once per pellet
- [ ] A player who moves **1.5 m sideways** during the flight is **not** damaged, and the ground where the pellet lands turns grey
- [ ] A wall between the Sprayer and the player stops the pellet: **no damage**, and the wall takes the grey
- [ ] A Turret's pellet damages a submerged player in range (it ignores stealth) and greys nothing
- [ ] A pinned Sprayer still fires pellets (`algorithms.md`: "green pin does not defuse it")
- [ ] Charger, Stalker, Drainer and Big Arm damage is unchanged (the existing tests pass)
- [ ] No allocation per shot: a test fires 100 bursts and the pool size is unchanged
- [ ] `npm test` passes

### Manual check (Renda)

1. Outskirts, island C: stand behind the block during a Sprayer's wind-up. You see the pellets hit the block; your health doesn't move.
2. The same fight in the open: strafe on your paint when you see the amber, and most shots should miss. Stand still and all three should land.
3. Last Colour, the Core's wave three: watch for unreadable pellet clutter. If it's too busy, that's the case for an attack-token cap (audit, Enemies item 2), not for removing pellets.
4. Replay every arena once. **Fights will get easier**, because shots can now miss. If a room goes soft, raise the burst to 4 or tighten spread before you touch damage.
