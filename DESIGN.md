# Inkbound — Design

## The concept

The world is grey and lifeless. You carry a paint gun, and **the colour you paint something changes what it physically does.** The rule applies to surfaces and enemies equally, so there's no separate puzzle mode and combat mode — it's one verb doing everything.

| Colour | On a surface | On an enemy |
|---|---|---|
| **Blue** | Ice — near-zero friction | Loses traction, slides, can't stop or turn |
| **Red** | Bounce — high restitution | Knocked back hard, can be flung off ledges |
| **Green** | Grip — climbable | Stuck in place, can't move |

Enemies spray **grey**, which strips colour off surfaces. Combat is a fight over territory, not just health bars.

### The Call of Duty layer

Every shooter feature runs *through* the paint mechanic, never around it. If it turned into "shooter where bullets are colourful" we'd lose the Innovation marks entirely.

- **Loadout** — pick 2 of the 3 colours before each level. Changes how you fight *and* which routes are open.
- **Ammo and reload** — the paint tank is a magazine. Counter, reload, dry click.
- **Paintstreaks** — coverage fills a meter, unlocking a colour mortar, a splat grenade, and 10 seconds of unlimited paint.
- **ADS** — aiming switches third-person to first-person. Also our multiple-camera-views requirement.
- **Minimap** — orthographic corner camera showing painted territory.

---

## The three levels

The brief is explicit: three levels means three *distinct experiences*. Reskinning the same challenge or turning the numbers up doesn't count and caps our marks. Each level changes the **relationship between the player and their paint**.

### Level 1 — Mission · learning
Linear, corridor-based, objective markers, extraction point.

- **Paint:** effectively unlimited, refill stations everywhere
- **Enemies:** Sprayer (ranged, strips colour) and Charger (melee rush, no gun)
- The Charger exists so you *discover* paint-as-weapon — freeze the floor and he slides straight past. No tutorial popup needed.
- **Enemy defence:** none, any colour hurts

### Level 2 — Ascent · rationing
Climbing a vertical structure. The tank barely refills.

- **Paint:** severely limited. Green to climb, or green to pin that enemy? You can't do both.
- **Enemies:** Wall-crawler (climbs your green paint, so what got you up here lets them reach you) and Turret (fixed, covers a route, you go around not through)
- **New failure state:** run dry mid-climb, fall all the way back down
- **Enemy defence:** armour shells — a grey shell that must be cracked with one specific colour first. Interacts with the loadout: leave red at home and the red-shelled enemy is a routing problem, not a shooting problem.
- Deliberately low enemy count. The tension is scarcity — flooding it with enemies collapses it back into Level 1.

### Level 3 — Siege · drowning
Closed arena, wave survival, no exit until the boss dies.

- **Enemies:** Drainer — weak, dumb, dozens of them, and they **eat painted ground**. The territory you're standing on shrinks while you fight.
- **Boss:** repaints the arena grey, spawns waves, needs a colour combo to kill
- **Enemy defence:** combos — colours must land in sequence

### The answer everyone needs to know

> **"What does this level do that the others don't?"**
>
> Level 1 gives you plenty of paint so you can learn. Level 2 starves you so every shot is a choice between climbing and fighting. Level 3 gives you enemies that eat your painted ground while you stand on it.
>
> Same rules, three different pressures.

---

## Difficulty — how we scale, and how we don't

**We don't raise enemy health between levels.** The brief calls this out: the same arrangement with the numbers turned up doesn't count as a new level, and it caps the Innovation band.

Difficulty comes from new rules about how damage works:

| Level | Defence | What it demands |
|---|---|---|
| 1 | None | Learn the colours |
| 2 | `requiredColour` — crack the shell first | Loadout choices have consequences |
| 3 | `combo` — colours in sequence | Think in colour combinations |

It's not a separate system. The one `Enemy` class carries two fields, set per level in `config.js`. About an hour of work.

**Armour must be visible** — the shell glows in the colour that cracks it. Invisible resistances feel broken; readable ones feel fair, and the shell shader earns 3D Effects marks by itself.

Flat health scaling *is* fine wave-over-wave inside Level 3, and for the boss pool.

---

## Enemies — one class, five configs

We're not writing five enemy systems. Behaviour lives in one file; the differences are flags in `config.js`.

| Type | Level | Really just... |
|---|---|---|
| Sprayer | 1, 3 | The base enemy |
| Charger | 1 | Sprayer, gun off, speed up |
| Wall-crawler | 2 | Sprayer with `climbsGreen: true` |
| Turret | 2 | Sprayer with movement off |
| Drainer | 3 | Charger with a paint-eating aura |
| Boss | 3 | Own file — phases, arena repaint, combo weakness |

**AI stays dumb on purpose.** Chase, occasional strafe, shoot on line of sight. No pathfinding, no navmesh — nobody's marking our AI and a navmesh will eat a week we don't have.

Build the Sprayer properly first. Everything else is that same enemy with switches flipped.

---

## Rubric coverage

| Category | % | How we cover it |
|---|---|---|
| Viewing | 10 | Third-person default, ADS to first-person, orthographic minimap, animated avatar |
| Control & Playability | 10 | Keyboard + mouse, clear win/lose, climbing makes it genuinely vertical, Rapier central not decorative |
| 3D Effects | 15 | Grey-to-colour transitions, skybox, multiple lights, shadows, bump and height maps on the grey world |
| Shaders | 10 | Splat shader into a render target, toon + outline pass, glowing armour shell. Uniforms driven by coverage and game state so it's alive, not static |
| Gameplay & Experience | 25 | Dead world restored by colour, three distinct pressures, sound tied to painting, replay through loadouts |
| Polish | 10 | Restart without refresh, pause/options, loading screen, hitmarkers, killfeed |
| Innovation | 10 | Colour changes *physics* not appearance. Enemies eat terrain. Combo weaknesses instead of health bars. |
| Game Trailer | 10 | Assigned week one. Splatter on grey films extremely well. |

---

## Scope

Three weeks to the graded beta. Cut early, not late.

**Must exist for beta:** paint changes surface physics · one custom shader we can all explain · Level 1 playable start to finish · hosted and playing from the server · restart without refresh.

**Cut first if behind:** paintstreaks · custom Blender models (a well-shaded box beats a badly-imported model) · boss phase 3 · Level 3's full wave count.

**Don't build:** multiplayer or networking · pathfinding · procedural generation.

---

## Performance

We're marked on **lab hardware**, not anyone's gaming laptop. Lag is penalised under Gameplay *and* Polish.

Reuse geometries and materials across objects. Merge small static meshes. Textures as small as still looks right, power-of-two, compressed. Shadow maps used deliberately — limit which lights cast, constrain the shadow camera. Profile with DevTools rather than guessing.

**The paint render target is our main risk.** Keep the resolution sensible and profile it early.

---

# Alpha session prep

**The alpha is formative — it is not marked.** It's a checkpoint with our mentor in the lab session the week after groups are finalised. The graded beta follows the same format a week later.

So it's a free dress rehearsal. Bring the riskiest, least-certain work and let the mentor tell us it won't work while there's still time to change it.

### What the brief asks for
Three.js running with a preliminary implementation that shows what the game will look like. Be ready to explain the idea and how we intend to meet each criterion. The mentor walks the rubric with us and asks how we've implemented — **or plan to implement** — each aspect.

That "or plan to implement" is the key phrase. It doesn't have to work. We have to talk about it credibly.

### What we bring
- [ ] Player capsule moving in 3D
- [ ] Paint gun firing, one colour landing on a surface
- [ ] That surface behaving differently (even just: green means climbable)
- [ ] A camera that switches between two modes
- [ ] Something — anything — hosted, and we ask the mentor to open the URL live

No enemies needed, no finished level needed. Prove the core mechanic, because the core mechanic *is* the pitch.

### Questions for the mentor
1. Is a splat render target sensible on lab hardware, or should we look at decals or vertex colours?
2. Does colour-driven physics reach the top Innovation band, or should we push further?
3. What does "several custom shaders" mean in practice for the A band?
4. Do the three levels need visually distinct environments, or is a shared art style fine?
5. Does one enemy class with five configs read as varied, or does it look like reskinning?

### Before we walk in
- [ ] Confirm exact alpha and beta dates on Moodle — the brief only gives relative timing, and Moodle takes precedence
- [ ] Everyone has read this document
- [ ] Everyone can explain the shader, not just whoever wrote it
- [ ] Build tested with `npm run serve:dist`, not just `npm run dev`
