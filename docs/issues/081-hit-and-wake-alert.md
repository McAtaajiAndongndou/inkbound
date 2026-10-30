**Lane:** shaders (enemies), Lethabo
**Priority:** MUST. Shooting an enemy that does not react reads as a broken game
**PRD:** rubric, Gameplay & Experience (feedback)
**Cost:** S
**Depends on:** nothing

### Context

In QA on 30 Oct, Renda shot the Primer's dormant Charger from R6 and the R7 doorway, and **it did not react**. Separately, its wake on entering R7 felt awkward: it "wakes" but nothing visibly happens.

Both come from one gap in `src/enemies/enemy.js`. A hit and a level wake both clear `sleeping`, but neither touches **awareness** (#109). Awareness only turns `alert` when the player is within `AWARENESS.radius` (16 m) **and** in sight. The Primer's Charger stands 20 m from R7's door, so:

| Situation | `sleeping` | Awareness | What the player sees |
|---|---|---|---|
| Shot from 25 m (R6) | false | **dormant** | Nothing. It stands there |
| Shot from 18 m | false | **dormant** | Nothing |
| Shot from 12 m | false | alert | It charges (moved 4 m in 3 s) |
| Level wake (`enter:R7+3`), player at the door | false | **dormant** | Nothing, until you walk 4 m closer, then it suddenly runs |

(Simulated in Node with the real `PaintGun` and `Level00`, 3 s after the shot. `main` behaves the same: the levels branches don't touch `enemy.js`.)

**The same gap is quality-plan bug B6, "Ascent spawn enemies stand still".** The Ascent's wave-2 Wall-crawlers (`e1-w2-a`, `e1-w2-b`) wait dormant and visible 20.5 m from the spawn. That's by design, as the layout says: "Shoot them now … or leave them". But shot from the spawn, both take the hit, clear `sleeping`, stay `dormant` and move 0 m. So the design's "shoot them now" option is dead until a hit alerts. Fixing rule 1 below fixes B6 with no level change.

`takeColourHit` even comments "A hit wakes a dormant enemy: no free kills". It does clear `sleeping`, but because awareness stays dormant, the player gets free hits anyway.

### The design

**Being hurt is the loudest signal there is.** Doom, Halo and CoD all have every enemy turn on whoever shot it, at any range.

1. **A hit alerts.** In `takeColourHit` (and the colourless `takeDamage` traps use), set awareness to `alert` and `_lastKnown` to the player's position, as rule 1 in `_updateAwareness` does for a shot, but **without** the radius and sight checks. Alert then decays to Search and Dormant through the existing rules, so stealth is unchanged for enemies that weren't hit.
2. **A level wake alerts.** `wake()` sets `alert` toward the player, so `enter:R7+3` produces a visible moment: the Charger turns and commits. The level passes the player's position. A small signature change, `wake(playerPos)`, is enough.
3. **Optional, recommended: a wake tell.** On the dormant → alert edge, a 0.3 s "notice" beat: the head turns, plus a short bark. The plan's Charger crouch windup (§4) is the natural place. Without a tell, the switch still reads as a pop.

Alternative (levels-only stopgap): move the Charger to within 16 m of the door. That fixes the wake, but not hits at range, so it's a patch, not the fix.

### Scope — files you may touch

- `src/enemies/enemy.js` (`takeColourHit`, `takeDamage`, `wake`, `_updateAwareness`)
- `src/config.js` (`AWARENESS`, only if a new number is needed)
- `tests/`

`src/levels/layout-level.js` calls `enemy.wake()`. If the signature changes, raise it with Renda (Levels): it's a one-line change on his side.

### Acceptance criteria

- [ ] A dormant enemy hit from 25 m is `alert` on the next update, and its `_lastKnown` is the player's position.
- [ ] The Ascent's `e1-w2-a`, shot from the spawn (20.5 m), leaves its post within 3 s (B6).
- [ ] A level-woken enemy is `alert` toward the player on the frame it wakes, at any distance.
- [ ] An un-hit, un-woken enemy 20 m away, out of sight, stays dormant (stealth unchanged).
- [ ] A turret (`ignoresStealth`) is unaffected.
- [ ] `npm test` passes.

### Manual check

Primer: from R6, past the spike pit, shoot the Charger through R7's door. It turns and charges at once. Reload, and walk into R7 without shooting: about 3 s after the door it visibly notices you and charges, rather than standing until you get close.

Ascent (B6): from the spawn, shoot one of the two Wall-crawlers waiting at the trailhead's edges. It comes for you.
