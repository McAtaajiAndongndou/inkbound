**Lane:** ui (Moses), with Dikeledi on the spend
**Priority:** COULD
**PRD:** C7
**Cost:** M
**Depends on:** 001, 038 — the gauge measures the loop, so the loop must exist

### Context

The reward for playing well is the ability to play better. Coverage and kills fill a gauge; the gauge is spent on a single large splat that **claims a zone and stuns everything inside it** — territory and breathing room in one action.

It is the only mechanic in the game that is not load-bearing, which is why `docs/PRD.md` tags it COULD. **Build it last**, after the loop and the levels work.

### Scope — files you may touch

- `src/ui/hud.js` — the gauge
- `src/main.js` — **shared.** Coordinate for the spend input and the effect trigger
- `src/paint/` — **coordinate with Dikeledi** for the zone splat
- `src/config.js` — fill rates, zone radius, stun duration

### Out of scope — do not touch

- The tank and the refill rule
- The scorecard — related, but a separate issue
- Enemy behaviour — the stun is a status, not a brain change

### Acceptance criteria

- [ ] The gauge fills from painted coverage and from kills, in that order of contribution
- [ ] It fills faster for **varied** play — painting, killing and traversing — than for repeating one action
- [ ] Spending it paints a large zone instantly and claims it
- [ ] Enemies inside the zone are stunned for a short, telegraphed duration
- [ ] The gauge cannot be spent when empty, and does not auto-fire
- [ ] The HUD shows fill clearly without adding a fifth competing element
- [ ] It resets on death and on level restart

### Manual check

Play a level painting and killing normally and see how long a full gauge takes. If it fills in under a minute, it is a spammable button rather than a reward; if it never fills, it does not exist.

### Design note

The stun should be **amber-telegraphed like every other status** (`docs/DECISIONS.md`). A silent stun reads as a bug, and a zone that stuns without warning is the one thing in this game that would feel unfair.

### Definition of done

- [ ] `npm test` green
- [ ] PRD status for C7 updated
- [ ] No files touched outside the lane, other than the coordinated spend
