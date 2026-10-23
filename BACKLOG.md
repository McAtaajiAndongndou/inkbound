# Backlog

Ideas, playtest findings and parked work. **Check triage status before building anything here** — an untriaged idea is not a task.

---

## Now

1. **Jump feel** — coyote time + jump buffering (`src/core/player.js`). Separate bug: occasional floor fall-through (raycast collision gap).
2. **Camera rig** — TPV feels detached, camera can look beneath the character, camera movement doesn't rotate the character (`src/core/camera-rig.js`).
3. **Outskirts layout** — widen island B so the fight is winnable, raise pressure on the third platform, add the encounter gates.
4. **Grey-world aesthetic pass** — the world must read as drained before the player paints it.

## Next

- Enemy build-out per `docs/enemies/algorithms.md` — starting with the Charger's recovery window, which is the cheapest combat improvement in the game.
- Traps: the static spike pit first, then paint-solvable variants.
- Grey-to-colour decor reveal.
- Models, validated one asset at a time (see `docs/ASSETS.md`).

## Parked

- **Megabonk movement** (slides, momentum super-jump, bunnyhop) — post-beta. Blue paint already approximates slides, and bhop invalidates every jump-distance number in the level plans.
- **Paint combining** (red + blue = teleport paint) — needs a new physics mode, recipe UI and teaching cost, and the Innovation band is already full.
- **Jetpack** — rejected as a base ability: it makes every gap in every level trivial and forces a level-design rewrite. If it ever returns, it is a single-level pickup with a fuel limit.
- **Vehicle level** — rejected: new physics, new camera, new collision and no paint. An on-rails transition gets the same breather for a tenth of the cost.
- **More enemy types** — rejected. Add enemy *questions*, not enemy types.

---

## Playtest findings (Renda, Level 1)

- **Gap jump unreliable** — needs coyote time and jump buffering.
- **Occasional fall-through of the floor** — raycast collision gap, separate bug from the jump feel.
- **Third-person camera feels detached** — can look beneath the character; movement does not rotate the character.
- **Island B is too small** — the only way past the enemy is to ignore it.
- **Third platform is too easy.**
- **TPV preferred over FPV** for aiming and painting — pending confirmation, and this is the Splatoon-vs-CoD balance decision.
