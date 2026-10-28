**Lane:** ui (Moses)
**Priority:** SHOULD
**PRD:** A8
**Cost:** S
**Depends on:** #81 (the end screens it sits on)

### Context

Coverage is currently a debug readout. The scorecard is what turns it into a score, and **dry time** — the proportion of the run spent on grey — is the metric that rewards actually playing the loop instead of hiding behind cover.

`docs/DECISIONS.md`: three numbers, no rank, no persistence.

### Scope — files you may touch

- `src/ui/hud.js` — the scorecard block on the win screen
- `src/main.js` — **shared.** Coordinate with Ozuko for accumulating time and dry time
- `src/ui/style.css`

### Out of scope — do not touch

- Letter ranks, grades or stars
- Saved best runs — no storage
- The level-select screen

### Acceptance criteria

- [ ] Win screen shows **coverage %**, **time**, and **dry time %**
- [ ] Coverage is the same number the HUD already computes, not a second calculation
- [ ] Dry time accumulates only while the player is on grey and alive
- [ ] Both reset on restart
- [ ] Numbers are formatted for a player, not a debugger — `1:42`, `63%`
- [ ] No rank, no comparison, no persistence

### Manual check

Complete a level painting everything, then again painting almost nothing. The coverage and dry-time numbers should differ obviously and in the right direction.

### Design note

Dry time is the one metric that is unique to this game. If the number looks meaningless to a player, the label needs work — not the metric.

### Definition of done

- [ ] `npm test` green
- [ ] PRD status for A8 updated
- [ ] No files touched outside the lane, other than the coordinated accumulation
