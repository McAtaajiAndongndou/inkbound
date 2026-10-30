**Lane:** ui (Moses), who owns the comms lines. Plus a one-line trigger in Levels (Renda)
**Priority:** SHOULD. Quality plan §9 (Primer, R7 row) and B5's UI half
**PRD:** rubric, Gameplay & Experience (onboarding)
**Cost:** S
**Depends on:** `levels/b5-one-of-theirs-timing` (moves "One of theirs" past the pit, which frees the bar for this line)

### Context

QA on 30 Oct: "the trap dialogue comes late and doesn't warn". The sergeant said nothing about the Primer's spike pit. The only line near it was "One of theirs", about the Charger, which fired on entering R6 and so played *at* the trap.

B5 (Levels) has moved "One of theirs" to fire once you're past the pit. That leaves R6's entry free for the warning the plan asks for.

### The design

**Warn before the hazard, not after.** It's the Half-Life 2 and Portal rule: the player hears the rule, sees the tell, then meets the danger.

Add one line, from the plan's Primer table:

| id | who | text |
|---|---|---|
| `primer-trap` | Sergeant | "Watch the boards — that floor bites. Blue slides over it." |

UK spelling. It's 57 characters, so `holdTime` gives about 4.9 s.

**Levels side (Renda, once this lands):** in `Level00._sergeant`, ask `primer-trap` on entering R6, before the pit. R6's entry is 12 m from the pit's near edge, about 3 s at a walk, and nothing in R6 starts a fight, so the line can't be cut short. "One of theirs" then follows past the pit (B5).

**Also:** the comment above `primer-theirs` in `src/ui/comms-lines.js` still says "on climbing into R6 … Asked a room early". After B5 it is asked once the player is past R6's spike pit, and the Charger's wake waits 3 s (`enter:R7+3`). Please update the comment with the new line.

### Scope — files you may touch

- `src/ui/comms-lines.js`
- `tests/` (the "every sergeant line has text" test already covers the text)

Not `src/levels/`: the trigger is Renda's.

### Acceptance criteria

- [ ] `COMMS_LINES['primer-trap']` exists, `who: 'Sergeant'`, with the text above.
- [ ] The comment on `primer-theirs` describes its B5 timing.
- [ ] `npm test` passes.

### Manual check

Primer: climb into R6. Before you reach the amber boards, the sergeant says "Watch the boards…". Cross the pit, and "One of theirs…" follows.
