# Polish pass 1 — all four levels

**Draft, 29 Oct 2026. Status: proposed, waiting on Renda.**

The plan for one polish pass over the Primer, Outskirts, the Ascent and Last Colour, inside the remaining half of the usage budget.

## The rules of this pass

- **Two features at most per level.** A feature is new code with behaviour: a trap, a mechanic, a visual system or a prop kit. It needs a test and a playtest. A level finishes its two before any level gets a third.
- **Tweaks are uncapped if they're cheap:** config numbers, placement, fog, light, decor density, stale comments.
- **Cut means Parked, not deleted.** Every cut goes to `BACKLOG.md`'s Parked list with one line saying why.
- **Proof per item:** one test, or one viewer screenshot from a fixed camera position. No exploratory browsing.
- **One fresh session per level**, started from that level's section of this document.

## Budget and order

| Order | Work | Share of the remaining usage |
|---|---|---|
| 0 | Shared: the paintable-wall marker | ~6% |
| 1 | Outskirts | ~10% |
| 2 | The Primer | ~7% |
| 3 | Last Colour (it builds the prop kit) | ~12% |
| 4 | The Ascent (reuses the prop kit) | ~8% |
| — | Reserve: bugs, integration, a second look | ~7% |

**Why this order.** Outskirts is first because it's the default start level and the first thing a marker sees. Last Colour comes before the Ascent because the Ascent's summit view and its chain landmark both need Corp military props, so the prop kit gets built once in Last Colour and placed in the Ascent.

---

## 0 · Shared — the paintable-wall marker

Every level hits the same problem: paintable strips look like the rock or steel around them (BACKLOG, 29 Oct; #156). The Primer's R2 and R5, the Ascent's climbs and Last Colour's pockets all teach nothing until the player can find them.

### Build (one feature, shared)
1. **A level-side trim around every paintable strip**, built in `level-kit.js`: a thin frame in the levels lane, not a change to `PaintSurface` or the paint shader.
   - Done when: a test shows every paint strip in all four levels has a trim, and no non-paintable wall has one; viewer shots of Outskirts' pillars and the Ascent's R1 face show the strip from 20 m.

### Blocked on / coordinate with
- **Lethabo (shaders, #126/#156).** Agree first that the trim is the answer, so the shaders lane doesn't build a second one. If Lethabo is already solving it in the shader, drop this item and give its budget to the reserve.
- The trim is a custom-shaded material, so it has to join each level's light-direction pass (AGENTS rule 5) and the dispose contract (rule 6).

---

## 1 · Outskirts

Budget: ~10%. Pass question: *does the player feel colour change the fight?*

### Cut (to Parked)
- Catwalk return loop: the gates make this a linear mission, and C's floor covers repainting
- Side island, collapsing bridge: content, not polish
- Swinging blades in B and on the pillar approach: the vent is the trap that uses paint

### Build (max two)
1. **The vent in C**: erupts on grey, goes dead on your paint. Place it in the front-right lane that leads to the block's blind pocket, so reaching the safe spot costs paint.
   - Done when: a test shows a painted vent deals no damage and an unpainted one does; a viewer shot shows its tell
2. **Colour reveal on the Ledge**: trees near your paint come back to colour
   - Done when: before/after screenshots from the same camera position

### Tweaks
- Make sure C's back edge is reachable, so a Charger can be knocked into the waste
- Remove the stale header comments (the aggro radius, "Charger + Sprayer rush you")
- Rewrite `01-outskirts.md` to match the build: one blade/vent story, one C roster

### Atmosphere
- Grey-world pass (BACKLOG Now #4): fog and light so the grey reads as drained, not just dark
- Line up the Ledge camera so the colour reveal is in frame

### Blocked on other lanes
- Jump feel and camera (Ozuko, core)
- Hit confirmation and sound for the waste kill (Moses, UI)

### Playtest checks
- Did you paint the vent, or walk around it?
- Did you knock anything into the waste without being told?

---

## 2 · The Primer

Budget: ~7%. Pass question: *does each room teach its one verb without words?*

### Cut (to Parked)
- A fourth free-play toy (the gap): its own doc says that comes after a playtest
- Any controls list or extra signage: the doc refuses them

### Build (max two)
1. **The spike pit in R6 (#101)**, on the existing `trap-volume.js`: telegraphed (sagging floor), damages, never kills, and blue slides over it
   - Done when: a test shows the pit damages but can't drop health to zero, and blue crosses it untouched; a viewer shot shows the sag
2. **Rebel training-course dressing**, built from level-kit boxes: target boards, painted lane markings, and crates that read "the rebels built this". No new models.
   - Done when: viewer shots of R1 and R7; the layout tests still pass (nothing blocks a route or a strip)

### Tweaks
- Borrow Outskirts' mood (fog and light) so the Primer stops being unlit grey
- Tank set to 100 when #155 lands

### Blocked on other lanes
- The sergeant's still and lines (#111/#112, Moses). **The Primer can't become the default start level until these land.** That's a campaign decision, not part of this pass.

### Playtest checks
- How long did a first-timer spend in R3 (blue) and R5 (green)? The doc's 2 min 40 s is mostly estimate.
- Did anyone try red on the green wall, and did they work it out?

---

## 3 · Last Colour

Budget: ~12%. Pass question: *does it read as a Corrupt Corp facility, and does losing your paint read without words?*

### Military models: the rules for this level
Last Colour is a military base, and #56 (MUST, PRD M10) asks for props. Every prop follows these rules:

- **Procedural first.** Crates, pipes, rails, barriers and lights are built in code to match the flat toon look. ITHappy *Military Free* models only where a procedural box clearly loses, and **one model at a time**, validated per `docs/ASSETS.md` (file size, draw calls, the toon treatment).
- **Check the ITHappy licence before shipping anything from it** (ASSETS.md marks it unchecked). Log every download in `ASSETS.md` and `src/ui/credits.js`.
- **Grey only.** Props are colourless machinery that someone stopped maintaining. Colour belongs to the player; the only exception is amber warning lights.
- **Lit correctly.** Any custom-shaded prop joins the level's light-direction pass (AGENTS rule 5), or it's lit from the wrong side.
- **Disposed with the level** (AGENTS rule 6). The existing "ten reloads leak nothing" test must still pass.
- **No collision for small props.** Enemies path around walls, so a colliding crate changes the fight. Only props that replace existing cover (the containers) collide.
- **Keep-outs.** No prop on a teal strip, a climb, a route point, or across the Siphon/beacon sightlines. The existing layout tests (sealed level, pocket rule, Siphon in view from every room) are the guard. Add one test: no prop overlaps a paint strip or a route point.
- **Readability.** No prop tall enough to hide a Drainer at 20 m on an arena floor.
- **Repeats are instanced** (crates, rails, lights), to keep draw calls down.

### Cut (to Parked)
- The laser grid (#33): the crusher is the trap with a rhythm
- Big Arm (#99) and the Siphon phases (#100) are **not in this pass**: see the open decision below

### Build (max two)
1. **The Corp prop kit (#56)**: procedural crates, pipes, rails, barriers and amber warning lights, plus up to three validated ITHappy models. Hangar, corridor and Core each get a distinct dressing.
   - Done when: viewer shots from the hangar entrance and from the Core (the #56 manual check); the prop keep-out test passes; all existing Last Colour tests still pass
2. **The cargo crusher in the corridor (#33)**: on a fixed rhythm, passable in the gap or under it on blue, with the walkway beside it
   - Done when: a test shows blue crosses under it and walking into it on the beat hurts; a viewer shot of the corridor

### Atmosphere
- Sickly amber interior (#125): fog and light colour in config
- Amber warning lights placed by the bay gates, so the waves have a tell

### Blocked on other lanes
- Tank of 80 (#155, core)
- Any model that fails validation goes back to a box. The ASSETS.md rule: a well-shaded box beats a badly imported model.

### Open decision for Renda
- **The ending.** Without #100, the level ends by walking to the Siphon's intake after an 8-minute fight. That's the weakest moment in the campaign. Either #100 gets its own budget outside this pass, or we spend the reserve on a cheap stand-in (the Siphon greys out and its beacon dies as you reach it).

### Playtest checks
- Did the hangar's "my paint is gone" read without the sergeant saying it?
- Did anyone discover that grey is safe from the Stalker?

---

## 4 · The Ascent

Budget: ~8%. Pass question: *does the climb feel like rationing, and is the goal always in view?*

### Cut (to Parked)
- Rolling boulders (#104) and pendulum blades (#103): the catwalk is the trap the level's question needs

### Build (max two)
1. **The collapsing catwalk (#102)** on spans 1 and 2: segments drop after you step on them; blue crosses fast; a fall lands on the scree, as now
   - Done when: a test shows a segment drops after its delay and the scree catches you; a viewer shot from the vista
2. **The chain landmark (R5)**: a tall Corp scaffold frame with a lit marker on the pads, from Last Colour's prop kit. The doc's own finding is that the pads are too small to read at 41 m.
   - Done when: the R5 arrival frame re-rendered, with the pads readable

### Tweaks
- Place the Corp base silhouette on the summit horizon, about 200 m out, from the prop kit. The sightline is already tested.
- Tank of 60 when #155 lands. **Without it, the level's rationing identity doesn't exist in the game.**

### Atmosphere
- Cold dawn (#125): fog and light colour in config

### Blocked on other lanes
- Tank per level (#155, core): a one-line fix in `main.js`, but not our lane

### Playtest checks
- Did anyone shoot the dormant crawlers at the trailhead, or not notice them?
- Did players take the chain or the switchback, and did the chain feel like commitment or a coin flip?

---

## Asks to other lanes

Raise these in the group chat at the start of the pass, so they arrive while we work:

| Ask | Lane | Unblocks |
|---|---|---|
| Tank per level (#155) | Core (Ozuko) | The Ascent's rationing, Last Colour's 80 |
| Jump feel, camera | Core (Ozuko) | Every playtest |
| Is the trim the readability answer? (#126/#156) | Shaders (Lethabo) | Item 0 |
| Sergeant still and lines (#111/#112) | UI (Moses) | The Primer as the start level |
| Hit confirmation for environment kills | UI (Moses) | Outskirts' waste kill, the Ascent's ledge Chargers |
| Is the Siphon (#100) in or out? | Campaign (Renda + Moses) | Last Colour's ending |
