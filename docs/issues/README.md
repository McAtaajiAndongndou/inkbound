# Issues

Drafts for the GitHub tracker. Each one is a vertical slice: a lane, an acceptance criterion, and the design doc that explains the *why*.

All 59 are **published** as `#73`–`#131`, and a second batch of three (`060`–`062`) as `#155`–`#157` — see "Batch 2" below. The files here and the issue bodies on the tracker are kept identical — an edit to one is an edit to both. Where they disagree, the tracker is what the team reads.

---

## Read this first

**Issue #114 (draft 042) gates six others** but is numbered late. It is the model-pipeline spike, and if it fails, #90, #92, #96, #97, #115 and #116 cannot be finished. Do it early, not in numeric order.

**Issue #121 (draft 049) gates #82 and #122.** The player rig has 24 clips and none of them are jump, fall, land or climb. Those four states come from the Universal Animation Library, so the library has to land before those two issues can.

---

## All 59

**Tracker number = draft number + 72** (`001` → `#73`, `059` → `#131`), because 72 issues already existed when the batch was published. The tracker never renumbers, and a second batch will get a *different* offset — rebuild the map from the tracker, match on title, and never carry this `+72` forward by hand.

`D`/`M`/`C` ids in the dependency column are PRD rows, not issues. Everything else there is a tracker issue.

| # | Issue | Lane | Pri | Cost | Depends on |
|---|---|---|---|---|---|
| 001 | Shared tank + positional refill | paint | MUST | M | — |
| 002 | Grey slows you | core | MUST | S | — |
| 003 | Dry out | core | MUST | S | #73, #74 |
| 004 | Charger recovery window | shaders | MUST | S | — |
| 005 | Turret: no status procs | shaders | MUST | S | — |
| 006 | Level select | ui | MUST | S | #79 |
| 007 | The Primer | levels | MUST | M | #73, #74 |
| 008 | Drainer eats paint | shaders | MUST | M | #73, #114 |
| 009 | Per-level end screens | ui | MUST | S | — |
| 010 | Player airborne animation | shaders | MUST | S | — |
| 011 | Outskirts — Island A | levels | MUST | S | — |
| 012 | Outskirts — Island B | levels | MUST | M | #83, #102 |
| 013 | Outskirts — The Gap | levels | MUST | M | #73 |
| 014 | Outskirts — Island C | levels | MUST | M | #84, #101, #103 |
| 015 | Outskirts — Return loop + side island | levels | MUST | S | #86 |
| 016 | Outskirts — Pillars + ledge | levels | MUST | M | #87, #85, #103 |
| 017 | Ascent — Landing + first face | levels | MUST | S | #74 |
| 018 | Ascent — Terrace one | levels | MUST | M | #89, #114 |
| 019 | Ascent — Collapsing catwalk | levels | MUST | M | #90, #102 |
| 020 | Ascent — Terrace two | levels | MUST | M | #91, #77, #115 |
| 021 | Ascent — The Chain | levels | MUST | M | #92, #85, #104 |
| 022 | Ascent — The Ledge | levels | MUST | S | #93, #76, #103 |
| 023 | Ascent — Summit + supply lift | levels | MUST | S | #94 |
| 024 | Last Colour — Hangar | levels | MUST | M | #80, #114 |
| 025 | Last Colour — Corridor | levels | MUST | M | #96, #77, #105, #115 |
| 026 | Last Colour — Core waves | levels | MUST | M | #96, #80, #108, #109 |
| 027 | Last Colour — Big Arm | levels | SHOULD | L | #98, #116 |
| 028 | Last Colour — Siphon | levels | SHOULD | M | #98, #106 |
| 029 | Trap volume + spike pit | levels | MUST | S | — |
| 030 | Collapsing surfaces | levels | SHOULD | S | #101 |
| 031 | Swinging blade | levels | SHOULD | S | #101 |
| 032 | Rolling boulder | levels | COULD | S | #101, #93 |
| 033 | Security traps | levels | COULD | S | #101, #97 |
| 034 | Freeze → crit | paint | SHOULD | M | — |
| 035 | Enemies paint grey | shaders | SHOULD | M | #80 |
| 036 | Submerge | core | SHOULD | M | #73 |
| 037 | Partial stealth | shaders | SHOULD | M | #108 |
| 038 | Scorecard | ui | SHOULD | S | #81 |
| 039 | Sergeant briefing still | ui | SHOULD | S | — |
| 040 | Comms bar | ui | SHOULD | S | #111 |
| 041 | Audio gaps | ui | SHOULD | S | — |
| 042 | **Model spike — wall-crawler** | shaders | MUST | S | — |
| 043 | Turret model | shaders | MUST | S | #114 |
| 044 | Remaining enemy models | shaders | SHOULD | M | #114 |
| 045 | ADS tradeoff + splash damage | paint | MUST | S | #106 |
| 046 | Sprayer reload window | shaders | MUST | S | #76 |
| 047 | Wall-crawler climbs green | shaders | MUST | M | #114 |
| 048 | Stalker | shaders | COULD | M | #114 |
| 049 | **Animation library integration** | shaders | MUST | M | — |
| 050 | Player climb animation | core | SHOULD | S | #121 |
| 051 | Enemy procedural motion | shaders | MUST | M | — |
| 052 | Player combat poses | shaders | SHOULD | S | #117 |
| 053 | Per-level mood | levels | MUST | S | — |
| 054 | Danger language + readability | shaders | MUST | S | #101 |
| 055 | Territory readout | ui | SHOULD | S | #73 |
| 056 | Military base props | levels | MUST | M | #125 |
| 057 | Killfeed | ui | SHOULD | S | #81 |
| 058 | Deployment + credits | ui | MUST | S | every model issue |
| 059 | Paintstreak meter | ui | COULD | M | #73, #110 |

---

## Batch 2 — 29 Oct 2026

Three cross-lane gaps found while blocking out the Ascent (`docs/levels/02-the-ascent.md`, "Dependencies outside the levels lane"). Published to milestone `Spec 2026-10`. **The map, read from the tracker by title** — the offset is not +72, which is exactly why the rule below exists:

| Draft | Tracker | Issue | Lane | Pri | Cost | Depends on |
|---|---|---|---|---|---|---|
| 060 | #155 | Tank per level | core | MUST | S | #73 |
| 061 | #156 | Paintable surfaces read before you shoot | shaders | MUST | S–M | — |
| 062 | #157 | Mantle | core | COULD | M | — (coordinates with #122) |
| 065 | — (not published) | Mantle probes the wrong side of the wall (regression from #157) | core | MUST | S | — |
| 066 | — (not published) | Enemy pellets: ranged shots fly, can be dodged, stop at walls | shaders (enemies) | MUST | M | — |
| 067 | — (not published) | Enemies are solid to the player | core | MUST | S | — (pairs with 068) |
| 068 | — (not published) | Enemies push each other apart | shaders (enemies) | SHOULD | S | 067 (config move) |

**#155 is the one that matters most:** until it lands, every level gets Outskirts' 100-ink tank, so the Ascent's rationing — its whole identity — is not in the game. One line in `main.js`.

---

## The four chains that matter

**The loop** — #73 → #74 → #75. The game's identity is still not built: ammo is per colour, refill is a keypress, grey is neutral. Cheaper than any level and changes the game more.

**But first, tracker #55.** Movement friction is frame-rate dependent in `core`. The whole economy is timing-based, so tuning refill, dodge windows and the grey slowdown against a variable speed is wasted work. Fix that, then tune. (This one is a **pre-existing issue, not a draft** — `055` in this folder is Territory readout and depends on it.)

**The model spike** — #114 first, then #115 and #116. One afternoon decides whether seven enemy models are achievable or whether the game ships with shaded boxes. Do it before anyone depends on it.

**The animation** — #82 alone. Three clips and one state read, and the game stops looking unfinished the moment you jump.

**The levels** — Outskirts (#83–#88) proves the pattern; Ascent (#89–#95) and Last Colour (#96–#100) copy it. The later two depend on Outskirts' *pattern*, not its content, so they can run in parallel once the first is standing.

---

## Publishing

**All 59 are published:** milestone `Spec 2026-10`, `#73`–`#131`. This section is now the rule for the *next* batch.

Prior issues the drafts overlap — still unresolved, so triage them rather than leaving both open:

| Draft | Tracker | Overlaps | State |
|---|---|---|---|
| 045 | #117 | #35 ADS verify + tune | open |
| 037 | #109 | #54 Enemies have no activation range | open |
| 001–003 | #73–#75 | #39 Paint → physics regression pass | open |
| 058 | #130 | #47 Beta QA day | open |
| ADR-0003 | #73–#75 | #46 Scrap loadout: all 3 colours | closed |

The labels already exist and are bare names — **use these, do not create `lane:*`**:

```
core   paint   shaders   levels   ui
```

**Numbering is the part that broke.** `Depends on` was written in draft numbers, but the tracker issued `#73`–`#131` because 72 issues already existed. Every cross-reference then either pointed at an unrelated 2026 issue (`#1`, `#2`, `#7`) or was dead plain text. Rules for the next batch:

1. **Publish, then map from the tracker** — `gh issue list --json number,title`, match on title, write the map into this file. Never assume an offset carries over; a second batch gets a different one.
2. **Translate every `Depends on` into tracker numbers before the body leaves this folder.**
3. **Never write a draft number into an issue body.** `#1` is not a placeholder, it is a real issue about a 2026 refactor.
4. Publishing in numeric order preserves *order*, not *equality* — it does not keep references valid.

```bash
gh issue create \
  --title "Shared tank + positional refill" \
  --body-file docs/issues/001-shared-tank-and-positional-refill.md \
  --label "paint" \
  --milestone "Spec 2026-10"
```

Then pin **#114** and **#121** to the top whatever their numbers, because they gate six and two issues respectively.

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
