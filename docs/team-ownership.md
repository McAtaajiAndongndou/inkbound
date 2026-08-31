# Team ownership and working rules

Five people, five folders. The split is designed so that in normal work **two people rarely touch the same file**.

---

## Who owns what

### Person 1 — Core & Player · `src/core/`
Renderer setup, scene graph, render loop, resize handling. Player controller and movement. Camera rig (third-person, first-person, minimap). Input binding. Game state — level loading, restart without refresh, win/lose.

*Owns the answer to:* Viewing, Control & Playability.

### Person 2 — Paint & Physics · `src/paint/`
The paint system: where splats land, which surfaces hold which colour, coverage tracking. The colour-to-physics rules (friction, restitution, climbable). Rapier setup and stepping.

*Owns the answer to:* the physics model, and the core mechanic itself. **This is the highest-risk area — start here.**

### Person 3 — Shaders & Enemies · `src/shaders/`, `src/enemies/`
Splat shader (paint rendered into a render target). Toon and outline pass. Enemy armour shell shader. The single `Enemy` class and its type configs. Boss.

*Owns the answer to:* Shaders (10%), and part of 3D Effects.

> **Everyone must be able to explain the shader code.** The brief and the final checklist both require it. Person 3 writes it; Person 3 also teaches it to the other four before the beta. Book 30 minutes for this.

### Person 4 — Levels & Assets · `src/levels/`, `public/assets/`
Level geometry and layout for all three levels. The load/unload/dispose contract. Models, textures, audio files. Skybox. Lighting setup per level.

*Owns the answer to:* 3D Effects, level distinctness.

### Person 5 — UI, Audio & Trailer · `src/ui/`, `src/audio/`
HUD (ammo, health, killstreak meter, hitmarkers, killfeed). Minimap render. Main menu, pause, options, restart. **Credits screen.** Audio manager and sound design.

*Also owns the trailer.* It is 10% of the mark, it is the thing groups always leave to the last night, and it needs footage captured across the whole build — not scraped together at the end. Start collecting clips from week one.

*Owns the answer to:* Polish, Game Trailer, part of Gameplay & Experience.

---

## Shared files — coordinate before editing

These get touched by everyone, so they are where conflicts happen:

- `src/main.js` — announce in the group chat before you edit it
- `src/config/colours.js` — the single source of truth for the three colours. Nobody hardcodes a hex value anywhere else.
- `src/config/balance.js` — all tuning numbers live here. Ammo, damage, wave counts, speeds. If you find yourself typing a magic number into a system file, it belongs here instead.
- `docs/` — additive edits only, do not rewrite someone else's section

---

## Git rules

Run this once, on every machine, before you do anything else:

```bash
git config core.ignorecase false
```

Without it, Git on Windows and Mac will not notice a filename case change — and the Linux server absolutely will.

**Branching:** one branch per person, named `feature/<area>` (e.g. `feature/paint-system`). Merge into `main` via pull request. Never commit directly to `main`.

**Before you push:**
1. `npm run build`
2. `npx serve dist` and actually play it
3. Then push

**Never commit:** `node_modules/`, `dist/`, `.env`, editor config, `.DS_Store`.

---

## Contribution report

Each of us submits an individual report on Moodle about who did what. **Individual marks can be adjusted by up to 20%** based on these. Keep a running note of what you actually did as you go — reconstructing it from memory at the end always undersells you.

---

## Week one priorities

| Priority | Who | Why |
|---|---|---|
| Textured cube hosted on the LAMP server | Person 1 | Deployment problems cost whole days. Find them now. |
| Paint hits a surface and changes its friction | Person 2 | If this does not work, the game does not exist. Prove it early. |
| One splat rendering through a custom shader | Person 3 | Highest-risk shader work. Fail fast. |
| Level 1 blockout with primitives | Person 4 | Grey boxes are fine. Layout first, looks later. |
| Ammo counter and a restart button | Person 5 | Small, visible, proves the HUD pipeline works. |

Everything above should exist by the alpha session, even badly.
