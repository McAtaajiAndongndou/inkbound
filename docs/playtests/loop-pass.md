# Loop pass — one change at a time

**Branch:** each step on its own branch cut from `main` (step 1: `proto/submerge-camera-glide`). The first try at this pass lived on `feel/loop-pass`, which is parked.
**Replaces:** the bundled feel branch (`claude/feel-loop-v2-91f58a`), which changed eleven numbers at once and didn't feel like an improvement. With everything changed together, nobody could tell which change helped and which hurt.

## How each step works

1. One change, one commit.
2. Play Outskirts then the Ascent on `main`, then on this branch, back to back.
3. Write one gut line. Verdict: **keep**, **drop** or **adjust** (then replay).
4. Only then start the next step. A kept step stays in for every step after it.

Running both side by side: `main` from the main checkout (`npm run dev`, usually port 5173), this branch from its worktree (the second `npm run dev` gets the next port, e.g. 5174). Add `?level=outskirts` or `?level=ascent` to the URL.

## The order

Ordered by Renda's sharpest complaint first, then by the quality plan's root cause (§3: "the loop keeps stopping the player").

| # | Change | Plan § | Type | What to feel for | Verdict |
|---|---|---|---|---|---|
| 1 | **Submerge camera glides** in and out instead of snapping. Same drop as `main`, only the transition changes | §3.4 | code (core) | Does Shift still feel jarring? Can you keep an enemy on screen while you dive? | **Keep** (30 Oct) |
| 2 | Submerge drop size: `cameraOffset` 0.9 → 0.35, aim dip `maxAngle` 1.1 → 0.1 | §3.4 | config | Only if step 1 still loses the horizon. Does it still read as "in the paint"? | **Skipped**: step 1 fixed it |
| 3 | Shot cost 4 → 2 (tank lasts ~7 s of trigger, not ~3.5 s) | §3.1 | config | Do you finish a fight before running dry? Does the tank still matter? | |
| 3b | **Hits drip ink** (Renda's idea, #240): a shot that hits an enemy splats ~0.6 m of its colour on the floor just behind it, not under its feet | §3.1 | code (paint) | Do fights leave pools you dive into mid-fight? Do enemies start sliding or pinning on their own? | |
| 4 | Submerged refill 32/s → 40/s and swim speed 1.4× → 1.9× | §3.1, §3.4 | config | Does a dive become your reload? Do you swim to get places? | |
| 5 | World grey slow 0.6 → 0.85 | §3.5 | config | Does the first minute still drag? Do you still want to paint ahead? | |
| 6 | Death splat 1.8 m → 2.5 m | §3.1 | config | Do you swim into kills to refill? | |
| 7 | Hip spread 0.025 → 0.06, ADS 0.005 → 0.004 | §3.2 | config | Does hip-fire feel like painting and aiming feel like shooting? | |
| 8 | Field of view 70 → 78 | §5 | config | More of the fight on screen, or just fish-eye? | |
| 9 | Whole-camera position damping | §5 | code (core) | Does the camera still feel stiff? | |

**The Ascent's tank (60)** waits for step 3's verdict. If cheaper shots stay, the Ascent may not need more ink at all, and raising it to 80 would break the rule that the Ascent is the starved level (`tests/config.test.js`, DECISIONS #155).

**Code steps cross lanes.** Steps 1 and 9 are in `src/core/` (Ozuko). They are prototyped here so Renda can feel them; nothing goes to `main` without Ozuko's review. Step 1 is written up for him as `docs/issues/079-submerge-camera-eases.md`.

## Log

### Step 1 — submerge camera glides

- **Change:** `SUBMERGE.cameraBlendSpeed` (new) — the rig moves the submerge drop and aim dip a share of the way each frame, the same way the ADS zoom already eases. At 14/s it covers about a quarter of the way on the first frame and ~95% by 0.2 s.
- **Branch:** `proto/submerge-camera-glide` (6af9877), cut from `main`.
- **Renda's line:** "The camera for swimming is working … this all works, but the animation still needs work."
- **Verdict: keep.** Core lane, so it goes to `main` through Ozuko's review of #231.
- **Follow-up:** the body's dive animation is out of this step's scope; filed for Shaders as #239 (§6.3 A7).

### Step 2: skipped

It only applied if step 1 still lost the horizon, and Renda says the swimming camera now works.
