# Issues

Drafts for the GitHub tracker. Each one is a vertical slice: a lane, an acceptance criterion, and the design doc that explains the *why*.

They are **drafts on disk, not published issues.** Publishing is a visible act on a shared repo — review them, adjust the wording, then publish deliberately.

---

## All 28, in dependency order

| # | Issue | Lane | Pri | Cost | Depends on |
|---|---|---|---|---|---|
| 001 | Shared tank + positional refill | paint | MUST | M | — |
| 002 | Grey slows you | core | MUST | S | — |
| 003 | Dry out | core | MUST | S | 001, 002 |
| 004 | Charger recovery window | shaders | MUST | S | — |
| 005 | Turret: no status procs | shaders | MUST | S | — |
| 006 | Level select | ui | MUST | S | 007, for anything to select |
| 007 | The Primer | levels | MUST | M | 001, 002 (beats land better) |
| 008 | Drainer eats paint | shaders | MUST | M | 001 |
| 009 | Per-level end screens | ui | MUST | S | — |
| 010 | Player airborne animation | shaders | MUST | S | — |
| 011 | Outskirts — Island A | levels | MUST | S | — |
| 012 | Outskirts — Island B | levels | MUST | S | 010 |
| 013 | Outskirts — The Gap | levels | MUST | M | 001 |
| 014 | Outskirts — Island C | levels | MUST | M | 012 |
| 015 | Outskirts — The Pillars | levels | MUST | M | 010, 013 |
| 016 | Outskirts — The Ledge | levels | SHOULD | M | 015 |
| 017 | Ascent — Landing + first face | levels | MUST | S | 002 |
| 018 | Ascent — Terrace one | levels | MUST | M | 017, D3, M4 |
| 019 | Ascent — Collapsing catwalk | levels | MUST | M | 018 |
| 020 | Ascent — Terrace two | levels | MUST | M | 019, 005, M5 |
| 021 | Ascent — The Chain | levels | MUST | M | 020, 013 |
| 022 | Ascent — The Ledge | levels | MUST | S | 021, 004 |
| 023 | Ascent — Summit + supply lift | levels | MUST | S | 022 |
| 024 | Last Colour — Hangar | levels | MUST | M | 008, M6 |
| 025 | Last Colour — Corridor | levels | MUST | M | 024, 005, M5, M7 |
| 026 | Last Colour — Core waves | levels | MUST | M | 024, 008, D6 |
| 027 | Last Colour — Big Arm | levels | SHOULD | L | 026, M8 |
| 028 | Last Colour — Siphon | levels | SHOULD | M | 026, C4 |

`D`/`M`/`C` ids are PRD rows, not issues — they name work that has no issue yet (enemy behaviours, models, colour procs). See **Not yet drafted** below.

---

## The three chains that matter

**The loop chain** — 001 → 002 → 003. The game's identity is not built yet: ammo is per colour, refill is a keypress, grey is neutral. These three are cheaper than any level and change the game more than a fifth level would.

**The animation chain** — 010 alone. Three clips and one state read, and the game stops looking unfinished the moment you jump. Highest polish-per-hour in the project.

**The level chain** — Outskirts (011–016) is finishable end to end and proves the pattern; Ascent (017–023) and Last Colour (024–028) copy it. Nothing in the Ascent depends on Outskirts' content, only on its *pattern*, so they can run in parallel.

---

## Publishing

`gh` is authenticated on this machine. Create the labels once:

```bash
gh label create "lane:levels"  --color "8B5CF6" --description "Renda"
gh label create "lane:ui"      --color "3B82F6" --description "Moses"
gh label create "lane:core"    --color "10B981" --description "Ozuko"
gh label create "lane:paint"   --color "F59E0B" --description "Dikeledi"
gh label create "lane:shaders" --color "EF4444" --description "Lethabo"
```

Then publish **in the order above**, so issue numbers match the filenames and the `Depends on` references stay valid:

```bash
gh issue create \
  --title "Shared tank + positional refill" \
  --body-file docs/issues/001-shared-tank-and-positional-refill.md \
  --label "lane:paint"
```

If you publish in a different order, fix the `Depends on` references before you publish.

---

## Not yet drafted

These are in the PRD but need a decision or a design pass before an agent can be handed them:

- **Traps** (F1–F3) — no trap system exists and its shape is still open
- **Freeze → crit** (C4) — now a hard dependency of issue 028
- **Enemies convert paint to grey** (B1) — same machinery as 008
- **Submerge + partial stealth** (A6, A7) — open question in the PRD
- **Scorecard** (A8) — coverage, time, dry time
- **Story delivery** (G1–G3) — briefing still, comms bar, skippable
- **Audio gaps** (I2–I4) — gate, telegraph pass, painting sound
- **Models** (M4–M8) — one issue per enemy, only after the GLB spike passes

---

## Writing a new one

Copy `.github/ISSUE_TEMPLATE/task.md`. The three sections that matter most:

1. **Scope — files you may touch.** What stops an agent refactoring someone else's lane.
2. **Acceptance criteria.** Testable, one line each. If it cannot fail, it is not a criterion.
3. **The design note.** The non-obvious constraint a fresh agent would otherwise get wrong.
