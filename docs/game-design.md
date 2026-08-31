# Inkbound — Game Design Document

**Course:** COMS3006A / COMS3025A — Computer Graphics and Visualisation
**Framework:** Three.js · **Physics:** Rapier · **Build:** Vite · **Target:** Chrome on Ubuntu, lab hardware

---

## 1. The concept in one breath

The world is grey and lifeless. You carry a paint gun. **The colour you paint something changes what it physically does.** That rule applies to the world and to the enemies equally, so there is no separate "puzzle mode" and "combat mode" — it is one verb doing everything.

| Colour | Effect on a surface | Effect on an enemy |
|---|---|---|
| **Blue** | Ice. Near-zero friction. | Loses traction, slides, cannot stop or turn. |
| **Red** | Bounce. High restitution. | Knocked back hard. Can be flung off ledges. |
| **Green** | Grip. Climbable wall surface. | Stuck in place, cannot move. |

Enemies fight back by spraying **grey**, which strips colour off surfaces. So combat is a fight over territory, not just over health bars.

### The Call of Duty layer

The brief rewards Innovation for ideas that are ours, so the shooter framing has to run *through* the paint mechanic, never around it. Every CoD feature below is tied to colour:

- **Loadout** — before each level you pick **2 of the 3 colours**. This changes how you fight *and* which routes through the level are open to you.
- **Ammo and reload** — the paint tank is a magazine. Ammo counter, reload animation, dry click when empty.
- **Paintstreaks** — painting coverage fills a meter. Thresholds unlock a colour mortar, a splat grenade, and a 10-second unlimited-paint overcharge.
- **ADS** — aiming switches third-person to first-person. This is also our multiple-camera-views requirement.
- **Minimap** — orthographic camera in the corner, showing painted territory as coloured zones.

---

## 2. The three levels

The brief is explicit: three levels means three *distinct experiences*. Reskinning the same challenge or just turning the numbers up does not count and caps our marks. Each level below changes the **relationship between the player and their paint**.

### Level 1 — "Mission" · learning
Linear, corridor-based, scripted. Objective markers, an extraction point at the end.

- **Paint economy:** effectively unlimited. Refill stations everywhere.
- **Enemies:** *Sprayer* (ranged, strips your colour) and *Charger* (melee rush, no gun).
- **Teaching moment:** the Charger exists so you discover paint-as-weapon yourself — freeze the floor, he slides straight past you. No tutorial popup needed.
- **Enemy defence:** none. Any colour hurts anything.

### Level 2 — "Ascent" · rationing
You climb a vertical structure. The paint tank barely refills.

- **Paint economy:** severely limited. Every shot is a decision — green to climb, or green to pin that enemy? You cannot do both.
- **Enemies:** *Wall-crawler* (climbs green surfaces, so the paint you used to get up here is what lets them reach you) and *Turret* (fixed, covers a whole route, you go around rather than through).
- **New failure state:** run dry mid-climb and you fall all the way back down.
- **Enemy defence:** **armour shells.** Some enemies have a grey shell that must be cracked with one specific colour before they take damage. This interacts with the loadout — if you left red behind, the red-shelled enemy is a routing problem, not a shooting problem.
- **Deliberately low enemy count.** The tension here is scarcity. Flooding it with enemies would collapse it back into Level 1.

### Level 3 — "Siege" · drowning
Closed arena, wave survival, no exit until the boss is dead.

- **Paint economy:** moderate, but constantly under threat.
- **Enemies:** *Drainer* — weak, dumb, arrives in dozens, and **eats painted ground**. The coloured territory you are standing on shrinks while you fight.
- **Boss:** repaints the arena grey, spawns waves, and requires a **colour combo** to kill (freeze blue → shatter red, and a three-colour chain for the final phase).
- **Enemy defence:** combo requirements. Two colours in sequence.

### The one-sentence answer for the marker

> Level 1 gives you plenty of paint so you can learn. Level 2 starves you of paint so every shot is a choice. Level 3 gives you enemies that eat your paint while you fight. Same rules, three completely different pressures.

Every team member must be able to say this.

---

## 3. Difficulty progression — how we scale, and how we do not

**We do not scale by raising enemy health between levels.** The brief calls this out directly: the same arrangement with the numbers turned up does not count as a new level, and it caps the Innovation band.

Instead, difficulty comes from **new rules about how damage works**:

| Level | Defence system | What it demands of the player |
|---|---|---|
| 1 | None — any colour hurts | Learn the colours |
| 2 | `requiredColour` — grey shell must be cracked with a specific colour first | Loadout choices have consequences |
| 3 | `comboSequence` — colours must land in order | Think in colour combinations |

**Implementation:** this is not a separate armour system. The single `Enemy` class carries two extra fields:

```js
requiredColour: null,      // null = anything hurts it
comboSequence: [],         // empty = no combo needed
```

Level 1 leaves both empty. Level 2 sets `requiredColour`. Level 3 fills `comboSequence`. Same code, three difficulty philosophies, about an hour of work.

**Armour must be visible.** The shell gets its own shader treatment that glows in the colour that cracks it. Invisible resistances feel broken; readable ones feel fair — and the shell shader earns us 3D Effects marks on its own.

Flat health scaling **is** fine in two places: wave-over-wave scaling inside Level 3 (normal horde design), and the boss having a large pool.

---

## 4. Enemies

**One class, five configurations.** We are not writing five enemy systems. `enemy.js` holds the behaviour; `enemy-types.js` holds flags.

| Type | Level | It is really just... |
|---|---|---|
| Sprayer | 1, 3 | Base enemy. Walks, shoots grey on line of sight. |
| Charger | 1 | Sprayer with the gun disabled and speed raised. |
| Wall-crawler | 2 | Sprayer with `canClimbGreen: true`. |
| Turret | 2 | Sprayer with movement disabled. |
| Drainer | 3 | Charger with a paint-eating aura. |
| Boss | 3 | Its own file. Phases, arena repaint, combo weakness. |

**AI stays dumb on purpose.** Chase, occasional strafe, shoot on line of sight. **No pathfinding, no navmesh.** Nobody is marking our AI, and a navmesh will eat an entire week we do not have.

Build order: get the Sprayer working properly first. Everything else is that same enemy with switches flipped.

---

## 5. How this maps to the rubric

| Category | Weight | How Inkbound covers it |
|---|---|---|
| **Viewing** | 10% | Third-person default, ADS switches to first-person, orthographic minimap. Animated player avatar. Objects that move with the world and HUD items that move with the camera. |
| **Control & Playability** | 10% | Keyboard + mouse. Clear objective and win/lose states per level. Genuine 3D movement — climbing makes it vertical, not a 2D platformer that looks 3D. Rapier physics is central, not decorative. |
| **3D Effects** | 15% | Grey-to-colour transitions, skybox, multiple lights, shadows on painted surfaces, bump/height maps on the grey world so it reads as textured rather than flat. |
| **Shaders** | 10% | **Splat shader** — paint rendered into a render target and sampled per surface. **Toon + outline pass.** **Shell shader** for enemy armour. Uniforms driven by paint coverage and game state, so the effects are alive rather than static. |
| **Gameplay & Experience** | 25% | Coherent theme (dead world restored by colour), three distinct pressures, sound design tied to painting, replay value through loadout variation. |
| **Polish** | 10% | Restart without page refresh, pause and options menus, loading screen, consistent colour scheme, hitmarkers and killfeed. |
| **Innovation** | 10% | Colour changing *physics* rather than appearance. Enemies that consume your terrain. Combo-based colour weaknesses. Custom Blender assets where time allows. |
| **Game Trailer** | 10% | Planned from week one, not the night before. Splatter on grey films extremely well. |

---

## 6. Scope discipline

Three weeks from brief to graded beta. Cut early, not late.

**Non-negotiable for beta:**
- Paint hits a surface, surface changes physics, player can use it
- One working custom shader we can all explain
- Level 1 playable start to finish
- Hosted and playing from the LAMP server
- Restart without refresh

**Cut first if we are behind:**
- Paintstreaks
- Custom Blender models (use primitives with good shaders — a well-shaded box beats a badly-imported model)
- Boss phase 3
- Level 3's full wave count

**Do not build:**
- Multiplayer or networking — no netcode experience in the group, and Innovation is only 10%
- Pathfinding or navmesh
- Procedural level generation

---

## 7. Performance rules

Our game is marked on **lab hardware**, not on anyone's gaming laptop. Lag is explicitly penalised under both Gameplay and Polish.

- Reuse geometries and materials across objects. Do not create one per object.
- Merge small static meshes. Many small draw calls are slower than one merged mesh.
- Textures scaled to the smallest size that still looks right, power-of-two, compressed.
- Shadow maps used deliberately — limit which lights cast, keep resolution sensible, constrain the shadow camera.
- `.dispose()` on level unload, every time.
- Profile with Chrome DevTools rather than guessing.

The paint render target is our main performance risk. Keep it at a sensible resolution and profile it early.
