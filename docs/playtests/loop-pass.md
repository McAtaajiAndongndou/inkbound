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
| 3 | Shot cost 4 → 2 (tank lasts ~7 s of trigger, not ~3.5 s) | §3.1 | config | Do you finish a fight before running dry? Does the tank still matter? | **Keep** (30 Oct) |
| 3b | **Hits drip ink** (Renda's idea, #240): a shot that hits an enemy splats ~0.6 m of its colour on the floor just behind it, not under its feet | §3.1 | code (paint) | Do fights leave pools you dive into mid-fight? Do enemies start sliding or pinning on their own? | **Keep** (30 Oct) |
| 4a | Submerged refill 32/s → 40/s (`SUBMERGE.refillMultiplier` 4 → 5): a full tank in 2.5 s | §3.1 | config | Does a dive become your reload? | **Keep** (30 Oct) |
| 4b | Swim speed 1.4× → 1.9× (`SUBMERGE.speedMultiplier`) | §3.4 | config | Do you swim to get places? | **Keep** (30 Oct) |
| 5 | World grey slow 0.6 → 0.85 | §3.5 | config | Does the first minute still drag? Do you still want to paint ahead? | **Keep** (30 Oct); the slow isn't felt at all → #244 |
| 6 | Death splat 1.8 m → 2.5 m | §3.1 | config | Do you swim into kills to refill? | **Keep** (30 Oct) |
| 7 | Hip spread 0.025 → 0.06 (`PAINT_GUN.hipSpread`) | §3.2 | config | Does hip-fire feel like painting and aiming feel like shooting? | **Keep** (30 Oct) |
| 7b | ADS spread 0.005 → 0.004: only if step 7 leaves aiming feeling loose (a 20% change to an already tight number) | §3.2 | config | | **Not played**: no looseness raised; available if aiming feels loose later |
| 7c | **Hip-fire splats bigger**, 1.4 → 1.8 m; aiming unchanged (Renda: "the paint from hipfire takes up wider surface area") | §3.2 | code (paint) | Does hip-fire cover ground fast, like a painter? | **Keep** (30 Oct) |
| 7d | Aimed splats smaller, 1.4 → 0.7 m, played on its own | §3.2 | config | Does aiming still paint enough to be worth it? | **Dropped**: breaks the Siphon finale |
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

### Step 3 — shot cost 4 → 2

- **Branch:** `proto/shot-cost-2` (dffa65c), stacked on step 1. A full tank is 50 shots, ~7 s of trigger (the Ascent 30).
- **Verdict: keep.** Paint lane: goes to `main` through Dikeledi's review. The Ascent's tank stays 60: with cheaper shots it is no longer punishing, so step 3 settles the open question above.

### Step 3b — hits drip ink (#240)

- **Branch:** `proto/hit-drips` (7547b5d), stacked on steps 1 and 3. A 0.6 m drip, 1.2 m past the enemy's centre along the shot; never under its feet.
- **Verdict: keep.** Paint lane: goes to `main` through Dikeledi's review of #240.

### Step 4 split in two

Step 4 changed two numbers (refill and swim speed). One change at a time, so it's 4a, then 4b.

### Step 4a — submerged refill 32/s → 40/s

- **Branch:** `proto/submerge-refill-5` (7ec6448), stacked on 1, 3 and 3b. A full tank in 2.5 s under the paint; standing is still 12.5 s.
- **Verdict: keep.** Core lane: through Ozuko's review.

### Step 4b — swim speed 1.4× → 1.9×

- **Branch:** `proto/swim-speed-1-9` (50ef5bb), stacked on 1, 3, 3b and 4a. 13.3 m/s swimming against a 7 m/s walk.
- **Verdict: keep.** Core lane: through Ozuko's review.

### Step 5 — grey slow 0.6 → 0.85: finding

- **Branch:** `proto/grey-slow-0-85` (7c9b6d7).
- **Renda's line:** "I don't feel the difference. This entire time I didn't notice that I was slower on grey compared to on green. It felt the same."
- **Diagnosis: feedback, not tuning.** The slow is applied (4.2 m/s on grey before this step, 7 on paint), but nothing tells you: the only cue is a tiny `sludge` footstep. A speed change you can't perceive does no design work. Filed as #244 (camera, sound, footfalls across core, ui and shaders).
- **Verdict: keep 0.85.** The harsher number only cost pace while it can't be felt; retune once #244 lands. Recorded in `docs/DECISIONS.md` (changes #74) on the step's branch.

### Step 6 — death splat 1.8 m → 2.5 m

- **Branch:** `proto/death-splat-2-5` (a5f7f8c), stacked on 1–5.
- **Verdict: keep.**

### Step 7 split

Step 7 changed two numbers. Hip spread is the real change (×2.4); the ADS tweak is 20% of a number that's already tight, so it's 7b, played only if step 7 makes aiming feel loose by comparison.

### Step 7 — hip spread 0.025 → 0.06

- **Branch:** `proto/hip-spread-0-06` (d5ffcfc). At ~13 m, hip shots scatter 0.93 m against 0.10 m aimed.
- **Verdict: keep.** Renda then asked for hip-fire paint to cover more ground and aiming to stay accurate, which is the plan's §3.2 split (#232). Added as 7c (bigger hip splats) and 7d (smaller aimed splats), one at a time.

### Step 7c — hip-fire splats 1.4 → 1.8 m

- **Branch:** `proto/hip-splat-1-8` (587d5ba). One shot paints 132 cells hip against 96 aimed (about 1.4×).
- **Verdict: keep.**

### Step 7d — aimed splats 1.4 → 0.7 m: dropped

- Built, then reverted before commit: `tests/siphon.test.js` failed. Last Colour's Siphon targets solve at half their plate painted (`need` 0.5 of a 4 × 4 sample grid), and one aimed shot only does that at an aimed splat of 1.2 m or more. At 0.7 m the finale's "one shot per target" would quietly become several.
- **Verdict: drop** (Renda). Steps 7 and 7c already split the modes: hip sprays wide and paints 1.8 m; aiming is ten times tighter and paints 1.4 m.
