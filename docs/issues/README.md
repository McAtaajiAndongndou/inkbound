# Issues

Drafts for the GitHub tracker. Each one is a vertical slice: a lane, an acceptance criterion, and the design doc that explains the *why*.

They are **drafts on disk, not published issues.** Publishing is a visible act on a shared repo — review them, adjust the wording, then publish deliberately.

---

## Order

The first three are the loop, and they unblock everything else. If only three issues get done, these are the three.

| # | Issue | Lane | Pri | Cost |
|---|---|---|---|---|
| 001 | Shared tank + positional refill | paint | MUST | M |
| 002 | Grey slows you | core | MUST | S |
| 003 | Dry out | core | MUST | S |
| 004 | Charger recovery window | shaders | MUST | S |
| 005 | Turret: no status procs | shaders | MUST | S |
| 006 | Level select | ui | MUST | S |
| 007 | The Primer | levels | MUST | M |
| 008 | Drainer eats paint | shaders | MUST | M |
| 009 | Per-level end screens | ui | MUST | S |

**Why 001–003 first:** the game's identity is the loop, and the loop is not built — per-colour ammo, an F-key refill and neutral grey are still in the code. Those three changes alter the game more than a fifth level would, and they are cheaper than either remaining level.

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

Then one issue at a time:

```bash
gh issue create \
  --title "Shared tank + positional refill" \
  --body-file docs/issues/001-shared-tank-and-positional-refill.md \
  --label "lane:paint"
```

Run them **in order** so the issue numbers roughly match the filenames — the drafts reference each other by number (`#1`, `#7`), and publishing out of order will make those references wrong. If you publish in a different order, edit the references before you publish.

---

## Not yet drafted

These are in the PRD but need design work before they can be handed to an agent:

- **Traps** (F1–F3) — no trap system exists, and the shape of it is still open
- **Freeze → crit** (C4) — depends on 001 landing first
- **Enemies convert paint to grey** (B1) — same machinery as 008
- **Submerge + partial stealth** (A6, A7) — open question in the PRD
- **The Ascent and Last Colour** (E3, E4) — both `L`; they should be split into rooms once the loop exists

---

## Writing a new one

Copy `.github/ISSUE_TEMPLATE/task.md`. The three sections that matter most:

1. **Scope — files you may touch.** This is what stops an agent refactoring someone else's lane.
2. **Acceptance criteria.** Testable, one line each. If it cannot fail, it is not a criterion.
3. **The design note.** The non-obvious constraint a fresh agent would otherwise get wrong.
