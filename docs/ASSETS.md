# Assets

The pipeline decisions and the shopping list. **Attribution is legally required for CC-BY** — log every download here the moment it lands, then reflect it in `src/ui/credits.js`.

---

## Pipeline rules

- **One asset family per category.** Mixed families are unified by the art direction, not by hope.
- **Validate before mass download.** Load ONE GLB and confirm the paint shader colours a `SkinnedMesh`, and that the file size and draw cost are acceptable. If that spike fails, fall back to well-shaded boxes — behaviour work continues regardless.
- **Style unification trick:** the lore excuses the mix. Everything colourless (enemies, the military base) is forced through the same flat grey toon treatment; colour belongs to the vibrant Quaternius family.
- **Custom models are cut first if behind.** `DESIGN.md` is explicit: a well-shaded box beats a badly-imported model.
- **Paint pellets are built in code** — a stretched sphere plus a trail. Do not download them.

## Player

| Asset | Source | Licence |
|---|---|---|
| Girl soldier | https://poly.pizza/m/oAArCNHjFB (Quaternius) | **CC-BY** |
| Guy soldier | https://poly.pizza/m/Btfn3G5Xv4 (Quaternius) | CC0 |
| Gun viewmodel — **Sci-Fi Gun Pack** | https://poly.pizza/bundle/Scifi-Gun-Pack-rBroUbKkqM (Quaternius) | CC0 |

The Sci-Fi Gun Pack **replaced** the Kenney Blaster Kit, so that all player-side assets stay in one family.

## Enemies

| Asset | Source | Licence |
|---|---|---|
| Soldier, no gun — Charger | https://poly.pizza/m/p0wFrzSVLS (KolosStudios) | **CC-BY** |
| Soldier, with gun — Sprayer | https://poly.pizza/m/XT8jgwSesV (KolosStudios) | **CC-BY** |
| Zombie 1 — Charger zombie | https://poly.pizza/m/22K0aSZkHV (Quaternius) | **CC-BY** |
| Zombie 2 — Drainer | https://poly.pizza/m/VlXjG0N8Eg (Quaternius) | CC0 |
| Zombie 3 — Big Arm boss | https://poly.pizza/m/KaVJET0WHx (Quaternius) | **CC-BY** |
| Zombie 4, "Zombie half" — Wall-crawler | https://poly.pizza/m/Htcsn9OrXJ (Quaternius) | **CC-BY** |
| Turret Gun | https://poly.pizza/m/ekTQhbJId7 and https://poly.pizza/m/hThPXDCbwl (Quaternius) | CC0 |
| **Stalker — not yet sourced** | Needs a creature model. Added after this file was written, so no asset was ever chosen | — |

## Environment

| Asset | Source | Licence |
|---|---|---|
| Forest — Stylized Nature MegaKit | https://quaternius.com/packs/stylizednaturemegakit.html (Quaternius) | CC0 |
| Military base — Military Free | https://ithappystudios.com/free/military-free/ (ITHappy Studios) | **Check the pack page before shipping** |

## Animation

| Asset | Source | Notes |
|---|---|---|
| Universal Animation Library | https://quaternius.com/packs/universalanimationlibrary.html (Quaternius) | Shared rig. Both player characters use the same clips |

Only attach clips that are actually driven by a state — idle, locomotion, attack, hit, death. An unused clip is a download and a load cost for nothing.

---

## Attribution

Required in `src/ui/credits.js`, which is reachable from the in-game menu. Attribution example:

> Character models by Quaternius (CC0 / CC-BY).
