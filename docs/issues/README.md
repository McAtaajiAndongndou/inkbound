# Issues

Drafts for the GitHub tracker. Each one is a vertical slice: a lane, an acceptance criterion, and the design doc that explains the *why*.

They are **drafts on disk, not published issues.** Publishing is a visible act on a shared repo — review them, adjust the wording, then publish deliberately.

---

## Read this first

**Issue 042 gates six others** but is numbered late. It is the model-pipeline spike, and if it fails, 018, 020, 024, 025, 043 and 044 cannot be finished. Do it early, not in numeric order.

**Issue 049 gates 010 and 050.** The player rig has 24 clips and none of them are jump, fall, land or climb. Those four states come from the Universal Animation Library, so the library has to land before those two issues can.

---

## All 44

`D`/`M`/`C` ids in the dependency column are PRD rows, not issues.

| # | Issue | Lane | Pri | Cost | Depends on |
|---|---|---|---|---|---|
| 001 | Shared tank + positional refill | paint | MUST | M | — |
| 002 | Grey slows you | core | MUST | S | — |
| 003 | Dry out | core | MUST | S | 001, 002 |
| 004 | Charger recovery window | shaders | MUST | S | — |
| 005 | Turret: no status procs | shaders | MUST | S | — |
| 006 | Level select | ui | MUST | S | 007 |
| 007 | The Primer | levels | MUST | M | 001, 002 |
| 008 | Drainer eats paint | shaders | MUST | M | 001, 042 |
| 009 | Per-level end screens | ui | MUST | S | — |
| 010 | Player airborne animation | shaders | MUST | S | — |
| 011 | Outskirts — Island A | levels | MUST | S | — |
| 012 | Outskirts — Island B | levels | MUST | S | 010 |
| 013 | Outskirts — The Gap | levels | MUST | M | 001 |
| 014 | Outskirts — Island C | levels | MUST | M | 012 |
| 015 | Outskirts — The Pillars | levels | MUST | M | 010, 013, 031 |
| 016 | Outskirts — The Ledge | levels | SHOULD | M | 015 |
| 017 | Ascent — Landing + first face | levels | MUST | S | 002 |
| 018 | Ascent — Terrace one | levels | MUST | M | 017, 042 |
| 019 | Ascent — Collapsing catwalk | levels | MUST | M | 018, 030 |
| 020 | Ascent — Terrace two | levels | MUST | M | 019, 005, 043 |
| 021 | Ascent — The Chain | levels | MUST | M | 020, 013, 032 |
| 022 | Ascent — The Ledge | levels | MUST | S | 021, 004, 031 |
| 023 | Ascent — Summit + supply lift | levels | MUST | S | 022 |
| 024 | Last Colour — Hangar | levels | MUST | M | 008, 042 |
| 025 | Last Colour — Corridor | levels | MUST | M | 024, 005, 033, 043 |
| 026 | Last Colour — Core waves | levels | MUST | M | 024, 008, 036, 037 |
| 027 | Last Colour — Big Arm | levels | SHOULD | L | 026, 044 |
| 028 | Last Colour — Siphon | levels | SHOULD | M | 026, 034 |
| 029 | Trap volume + spike pit | levels | MUST | S | — |
| 030 | Collapsing surfaces | levels | SHOULD | S | 029 |
| 031 | Swinging blade | levels | SHOULD | S | 029 |
| 032 | Rolling boulder | levels | COULD | S | 029, 021 |
| 033 | Security traps | levels | COULD | S | 029, 025 |
| 034 | Freeze → crit | paint | SHOULD | M | — |
| 035 | Enemies paint grey | shaders | SHOULD | M | 008 |
| 036 | Submerge | core | SHOULD | M | 001 |
| 037 | Partial stealth | shaders | SHOULD | M | 036 |
| 038 | Scorecard | ui | SHOULD | S | 009 |
| 039 | Sergeant briefing still | ui | SHOULD | S | — |
| 040 | Comms bar | ui | SHOULD | S | 039 |
| 041 | Audio gaps | ui | SHOULD | S | — |
| 042 | **Model spike — wall-crawler** | shaders | MUST | S | — |
| 043 | Turret model | shaders | MUST | S | 042 |
| 044 | Remaining enemy models | shaders | SHOULD | M | 042 |
| 045 | ADS tradeoff + splash damage | paint | MUST | S | 034 |
| 046 | Sprayer reload window | shaders | MUST | S | 004 |
| 047 | Wall-crawler climbs green | shaders | MUST | M | 042 |
| 048 | Stalker | shaders | COULD | M | 042 |
| 049 | **Animation library integration** | shaders | MUST | M | — |
| 050 | Player climb animation | core | SHOULD | S | 049 |
| 051 | Enemy procedural motion | shaders | MUST | M | — |
| 052 | Player combat poses | shaders | SHOULD | S | 045 |
| 053 | Per-level mood | levels | MUST | S | — |
| 054 | Danger language + readability | shaders | MUST | S | 029 |
| 055 | Territory readout | ui | SHOULD | S | 001 |
| 056 | Military base props | levels | MUST | M | 053 |
| 057 | Killfeed | ui | SHOULD | S | 009 |
| 058 | Deployment + credits | ui | MUST | S | every model issue |
| 059 | Paintstreak meter | ui | COULD | M | 001, 038 |

---

## The four chains that matter

**The loop** — 001 → 002 → 003. The game's identity is still not built: ammo is per colour, refill is a keypress, grey is neutral. Cheaper than any level and changes the game more.

**The model spike** — 042 first, then 043 and 044. One afternoon decides whether seven enemy models are achievable or whether the game ships with shaded boxes. Do it before anyone depends on it.

**The animation** — 010 alone. Three clips and one state read, and the game stops looking unfinished the moment you jump.

**The levels** — Outskirts (011–016) proves the pattern; Ascent (017–023) and Last Colour (024–028) copy it. The later two depend on Outskirts' *pattern*, not its content, so they can run in parallel once the first is standing.

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

Publish **in numeric order** so the `Depends on` references stay valid:

```bash
gh issue create \
  --title "Shared tank + positional refill" \
  --body-file docs/issues/001-shared-tank-and-positional-refill.md \
  --label "lane:paint"
```

Then move **042 to the top of the project board** regardless of its number, because it gates six others.

---

## Still not drafted

**Nothing.** Every PRD requirement now has an issue, or is built, or is cut. The four cut items are listed in the PRD's out-of-scope section.

The remaining work is not paperwork — it is deciding order and defending focus. See the four chains above.

---

## Writing a new one

Copy `.github/ISSUE_TEMPLATE/task.md`. The three sections that matter most:

1. **Scope — files you may touch.** What stops an agent refactoring someone else's lane.
2. **Acceptance criteria.** Testable, one line each. If it cannot fail, it is not a criterion.
3. **The design note.** The non-obvious constraint a fresh agent would otherwise get wrong.
