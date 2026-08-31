# Alpha session — prep sheet

**The alpha is formative. It is not marked.** It is a checkpoint with our mentor, held in the lab session the week after groups are finalised. The beta — which *is* graded — follows the same format one week later.

So the alpha is a free dress rehearsal. The move is to bring our **riskiest, least-certain work** and let the mentor tell us it will not work while there is still time to change it.

---

## What the brief actually asks for

- Three.js up and running, with a preliminary implementation that shows what the game will eventually look like
- Be ready to explain the game idea and how we intend to meet each grading criterion
- The mentor walks through the rubric with us, and we answer questions about how we have implemented **or plan to implement** each aspect

That phrase — *or plan to implement* — is the important one. It does not have to work yet. We have to be able to talk about it credibly for every category.

---

## What we bring

**Running:**
- [ ] A scene with a player capsule moving in 3D
- [ ] Paint gun firing, one colour landing on a surface
- [ ] That surface behaving differently (even just: green means you can climb this)
- [ ] A camera that switches between two modes

No enemies needed. No finished level needed. Prove the core mechanic, because the core mechanic **is** the pitch.

**Hosted:**
- [ ] Something — anything — on the LAMP server, and we ask the mentor to open the URL live

**Documented:**
- [ ] This repo, with `game-design.md` open

---

## One sentence per rubric category — learn these

**Viewing** — Third-person by default, ADS switches to first-person, orthographic minimap in the corner showing painted territory.

**Control & Playability** — Keyboard and mouse, clear objective and win/lose per level, and climbing makes the movement genuinely vertical rather than a 2D platformer that looks 3D. Rapier drives the physics and it is central to the mechanic, not decoration.

**3D Effects** — Grey-to-colour transitions, skybox, multiple lights, shadows on painted geometry, and bump and height maps on the grey world so it reads as textured rather than flat.

**Shaders** — A splat shader that renders paint into a render target and samples it per surface, plus a toon and outline pass and a glowing armour shell on enemies. Uniforms are driven by paint coverage and game state, so the effects change as you play rather than sitting static.

**Gameplay & Experience** — A dead grey world you restore with colour. Three levels with three different pressures. Sound tied to the act of painting.

**Polish** — Restart without refreshing, pause and options menus, loading screen, consistent colour scheme, hitmarkers and killfeed.

**Innovation** — Colour changes physics, not just appearance. Enemies eat your terrain. Enemy weaknesses are colour combos rather than health bars.

**Game Trailer** — Already assigned to a named person, already collecting footage. (Say this out loud. Most groups have not started.)

---

## The level question — everyone must be able to answer this

> **"What does this level do that the others do not?"**

**Level 1** gives you plenty of paint so you can learn the colours.
**Level 2** starves you of paint so every single shot is a choice between climbing and fighting.
**Level 3** gives you enemies that eat your painted ground while you are standing on it.

Same rules, three different pressures. Not the same level with the furniture moved.

---

## Questions to ask the mentor

Bring these. It is our responsibility to approach the mentor, not the other way round.

1. Is the splat render target approach sensible on lab hardware, or should we look at decals or vertex colours instead?
2. Does colour-driven physics count strongly enough for the top Innovation band, or should we push further?
3. What does "several custom shaders" mean in practice for the A band — how many, and how substantial?
4. Are three levels with a shared art style acceptable, or do they want visually distinct environments too?
5. Is our enemy variety (one class, five configs) going to read as varied enough, or does it look like reskinning?

---

## Before we walk in

- [ ] Confirm the exact alpha and beta dates on Moodle — the brief only gives relative timing, and Moodle takes precedence
- [ ] Everyone has read `game-design.md`
- [ ] Everyone can explain the shader, not just the person who wrote it
- [ ] The build has been tested with `npx serve dist`, not just `npm run dev`
