**Lane:** paint (Dikeledi)
**Priority:** MUST
**PRD:** A1, A2
**Cost:** M
**Depends on:** nothing — this unblocks everything else

### Context

Today ammo is three separate pools, one per colour, and the **F** key refills them. That means painting the floor costs nothing you needed for combat, so there is no trade between traversing and fighting. Colour is a tool, not a decision.

A1 and A2 ship together because either one alone is broken: a shared tank with an F key has no pressure, and positional refill with per-colour pools has no tension. Together they make paint the game's one economy. See `docs/adr/0001-one-shared-tank.md` and `GLOSSARY.md` (**Tank**, **Wet**, **Dry**).

### Scope — files you may touch

- `src/paint/paint-gun.js` — one reserve instead of `ammo[colour]`
- `src/paint/paint-surface.js` — expose "is this cell mine" for the refill check
- `src/config.js` — `AMMO` becomes one number per level; add a refill rate
- `src/core/input.js` — remove the refill action
- `src/main.js` — drop the `actions.refill` branch
- `src/ui/hud.js` — **only with Moses's agreement**; the bar becomes one bar

### Out of scope — do not touch

- `src/shaders/**` — the paint shader does not change
- `src/levels/**` — level geometry is not part of this
- Removing the F key from the **menu controls list** — that is a UI issue

### Acceptance criteria

- [ ] Firing any colour decrements the same reserve
- [ ] Standing on a cell you own raises the reserve over time; standing on grey does not
- [ ] Refill does nothing while airborne or while moving quickly (choose one rule and document it)
- [ ] The reserve reaches zero and shots stop, with a dry click
- [ ] The HUD shows one bar, not three, and the ∞ grey swatch is gone
- [ ] `tests/shared-tank.test.js` fails on `main` and passes here

### Manual check

Paint a patch, empty the tank somewhere else, walk back into the patch. The bar should climb. Walk onto grey mid-refill — it should stop climbing immediately.

### Design note

The ratio that decides whether this feels good: **a splat must return at least what it cost**, or the economy is a death spiral by arithmetic. Tune the refill rate against the shot cost before anything else.

### Definition of done

- [ ] `npm test` green
- [ ] A test in `tests/` that fails before the change and passes after
- [ ] Status column in `docs/PRD.md` updated (A1 and A2)
- [ ] No files touched outside the lane
