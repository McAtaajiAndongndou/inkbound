# Inkbound — Project Instructions

> This file is the contract every agent reads before touching the repo. It holds **durable rules only** — lanes, conventions, definition of done, and where things live. Decisions, backlog and asset lists live in their own files so this one does not drift.

## Working with Renda

Renda owns `src/levels/`. He has strong instincts about what feels good and what feels bad, but is newer to design vocabulary and frameworks than to play experience.

- Give explicit, concrete guidance. Do not open with "what do you want this level to feel like?" — propose options, cite shipped games, name the technique, and let him react.
- When he says "this is bad", translate it into a specific diagnosis: pacing? readability? feedback? reward?
- Explain *why* a choice works, so the judgement transfers.
- Never leave him at a blank page: give a recommended default plus one or two alternatives.

## The game in brief

**Inkbound** is a Splatoon × Call of Duty browser game (Three.js + Vite). You paint the world; **colour is the mechanic**, and it is also your ammunition, your territory and your speed.

- **The loop:** dry → paint → wet → fight → claim ground.
  One shared tank across all colours, refilled by standing in your own paint. No refill button.
- **The colours:** blue = ice and slide, sets up a freeze; red = bounce and knockback; green = climb and pin.
- **Grey** is Corrupt Corp's paint, not empty ground. It slows you and refills nothing.
- **Fiction:** rebels versus Corrupt Corp, who siphon colour and joy to fuel immortality pills. Zombies are failed trial subjects. A sergeant briefs the player.
- **References to lean on:** Splatoon (paint, readability, joy of colour) and Call of Duty (gun feel, pacing, mission structure).

## Design compass

- Treat his indie-game gut as a **playtest instrument**, not a plan. When he says "this is bad", translate it into a concrete diagnosis: pacing? readability? feedback? reward?
- Frame advice as: *what would Splatoon / CoD / `<relevant indie>` do here?*

## Course context

CGV (Computer Graphics & Visualisation) graded project — marking is weighted toward the visual and interaction bands, so readability and the grey-to-colour transition are worth protecting.

Workflow: Figma designs precede feature issue bodies; the team works backend → frontend handoff style. A feature with no design is not ready to build.

## Lanes (LOCKED)

| Lane | Owner | Directories |
|---|---|---|
| Levels | **Renda** | `src/levels/` |
| UI + trailer | **Moses** | `src/ui/` |
| Core | **Ozuko** | `src/core/` |
| Paint | **Dikeledi** | `src/paint/` |
| Shaders | **Lethabo** | `src/shaders/` |

Creative direction sits with Renda + Moses; the mechanics trio build the systems.

**Moses and Ozuko swapped at beta.** Moses now owns `src/ui/`, Ozuko now owns `src/core/`. Git history still shows Moses writing `core/` and Ozuko writing the HUD — that is from *before* the swap, not a mistake to correct. Ozuko is newer to core; expect Moses to mentor him on it.

**Do not cross lanes.** If a change requires another lane, raise it in the group chat or write an issue that depends on theirs.

## Rules for agents

1. **Read `GLOSSARY.md` before naming anything.** Use its terms. If a term is missing, propose one rather than inventing a parallel word.
2. **Never answer a design question by writing code.** Design arrives as a document first. If asked "what should this level do", write the document.
3. **Extend, do not rebuild.** `LevelBase`, `PaintSurface`, `Enemy`, `Decor`, the encounter gates and the paint grid already exist and are tuned. Reuse them.
4. **Every tuning number goes in `src/config.js`.** If you are about to type a magic number into another file, it belongs in config.
5. **Custom shaders do not read scene lights.** The paint, toon and outline materials each carry their own `uLightDir`. New custom-shaded materials must be added to the level's light-direction pass or they will be lit from the wrong side.
6. **Levels must honour the dispose contract.** Removing a mesh does not free GPU memory. Geometry, materials and uniform textures must be disposed, and the paint map lives in `material.uniforms.uPaintMap`, not `material.map`.
7. **No new enemy types** without an entry in `docs/DECISIONS.md`. Add enemy *questions*, not enemy types.
8. **Do not silently change settled behaviour.** If a rule in `docs/DECISIONS.md` or an ADR is wrong, say so — do not route around it.
9. **Tests are the interface between lanes.** A change that alters behaviour ships with a test.

## Definition of done

- `npm test` passes — 161 tests, 0 failures at the time of writing
- New behaviour has a test in `tests/`
- The manual check is described and actually performed
- Docs updated if a decision changed (`docs/DECISIONS.md`, or an ADR if it qualifies)
- No files touched outside your lane

## Where things live

| File | Holds |
|---|---|
| `AGENTS.md` | This file — rules only |
| `README.md` | The product: goal, pillars, scope, non-goals, rubric map |
| `docs/PRD.md` | **What ships** — requirements, owners, status, MoSCoW. The scope authority |
| `GLOSSARY.md` | Canonical vocabulary. The tie-breaker for naming |
| `DESIGN.md` | The design doc: concept, story, levels, rubric coverage |
| `MECHANICS.md` | Mechanics reference |
| `ENEMIES.md` | Enemy roster and counters |
| `docs/enemies/algorithms.md` | Behaviour specs, state machines, tuning |
| `docs/levels/` | One document per level |
| `docs/level-design-principles.md` | Sourced level-design principles + the sketch rubric |
| `docs/adr/` | Decisions that were hard to reverse and would look surprising later |
| `docs/DECISIONS.md` | The decision ledger. Append-only |
| `docs/issues/` | Draft issues — one per requirement, with lane and acceptance criteria |
| `BACKLOG.md` | Ideas, playtest findings, parked work, priority order |
| `docs/ASSETS.md` | Asset pipeline, shopping list, attribution |
| `INTEGRATION.md` | Cross-lane contracts |
| `src/config.js` | Every colour, every tuning number |
