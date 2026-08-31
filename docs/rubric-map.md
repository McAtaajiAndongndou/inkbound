# Rubric map

Every category, what we are doing for it, and whose name is on it.
If a row has no owner, it does not get built.

| Category | % | Our answer | Owner |
|---|---|---|---|
| **Viewing** | 10 | Animated 3D scene; three camera modes (third / first-person ADS / orthographic minimap); animated player avatar; HUD moves with camera, world objects do not | A + E |
| **Control & Playability** | 10 | Keyboard **and** mouse; movement and combat in all three dimensions; Rapier physics is central, not decorative; clear win/lose per level | A |
| **3D Effects** | 15 | Antialiasing, multiple lights, shadows, skybox, toon shading; textures used for more than colour (normal + roughness maps); the grey→colour transition as a signature effect | C |
| **Shaders** | 10 | Custom splat shader (paint buffer over desaturated base, wet-edge driven by `uTime`); toon + outline; armour shell with emissive rim. Uniforms driven by time **and** game state | C |
| **Gameplay & Experience** | 25 | Coherent theme; three levels with distinct identities (learning / rationing / drowning); sound and music throughout; replay value via loadout choice | E + all |
| **Polish** | 10 | Loading screen, main menu, pause, options, **restart without page refresh**, consistent colour scheme, no lag on lab hardware | E |
| **Innovation** | 10 | Colour changes **physics**, not just appearance. Same verb for puzzling and combat. Paint-coverage killstreaks. Combo-locked enemies | all |
| **Game Trailer** | 10 | Max 2 min, YouTube. Capture footage from week one | ??? |

## The bits people forget

- **Every member must be able to explain the shader code.** Not just C. Book the
  session.
- **Credits screen** listing everything we did not make, with sources and
  licences. Add as you go.
- **The trailer is 10%** and is included at the beta, not just the final. Most
  groups underinvest here — it is the cheapest 10% on the list.
- **Devlog** for the final submission only.
- **Contribution report** — individual, via Moodle. Our individual mark can move
  by up to 20% based on these.

## The question we will all be asked

> "What does this level do that the others do not?"

- **L1** — generous paint. You are *learning* that colour changes physics.
- **L2** — paint barely refills. You are *rationing*, choosing between climbing
  and killing.
- **L3** — enemies eat your paint. Your safe ground shrinks. You are *drowning*.

Same rules, three different feelings. Everyone gives the same answer.
