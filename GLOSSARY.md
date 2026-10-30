# Inkbound

A first-person paint shooter about reclaiming a grey world. Colour is not cosmetic: it is territory, ammunition, movement and damage at once. This glossary fixes the words the team uses so the design docs, the code and the level layouts all mean the same thing.

## The loop

**Loop**:
The repeating cycle of the game: you are dry, you paint to become wet, you fight from your paint, and the ground you claim is what lets you keep fighting.
_Avoid_: gameplay cycle, core loop, gameplay

**Dry**:
Standing on grey ground. No refill, reduced speed, nothing of yours underfoot.

**Dry out**:
Losing a run because the tank is empty and no ground is owned. The only true dead end in the loop, and the state the game must declare rather than leave the player in.
_Avoid_: soft-lock, running out, ammo death

**Wet**:
Standing on paint you own. Refills the tank slowly and does not stop you firing.

**Submerge**:
A distinct state entered by going into your own paint. Faster movement, fast refill, harder to detect — but you cannot fire.
_Avoid_: swim, dive, ink

**Territory**:
Floor currently claimed by one side. Grey is enemy territory, not empty ground.
_Avoid_: coverage, turf, ground

## Paint

**Paint**:
The substance you fire and the floor you claim from it. It serves four jobs at once — movement, resupply, territory and damage — and all four draw on the same reserve.

**Tank**:
Your reserve of paint. One shared pool across all three colours, so a splat on the floor is a shot you did not fire at an enemy.
_Avoid_: ammo, ink, magazine

**Grey**:
Unpainted ground, which is Corrupt Corp's paint rather than the absence of paint. It slows you and refills nothing.
_Avoid_: dead, neutral, unpainted, empty

**Coverage**:
The percentage of a level painted, scored at the end of a run.
_Avoid_: using coverage for territory

**Dry time**:
The percentage of a run spent standing on grey. Scored alongside coverage and time, because it measures whether the player actually played the loop rather than hiding in cover.
_Avoid_: exposure, uptime

## Colour

**Colour roles**:
What each colour does, on the floor and on an enemy. Blue is ice and damage setup; red is bounce and knockback; green is grip, climbing and pinning.

**Two channels**:
The same colour acts passively on the floor you painted earlier, and actively on an enemy you hit directly.

## Combat

**Question**:
What an enemy is asking you. Every enemy attacks a different resource in the loop — your position, your paint, your routes, your space, or your resupply.
_Avoid_: threat, mechanic, gimmick

**Answer**:
The colour, terrain or movement that resolves a question.

**Tell**:
The visible and audible warning before an enemy commits to an attack.

**Threat**:
The attack itself, at the moment it becomes dangerous.

**Opening**:
The punishable gap after an enemy commits — the moment skill lives in.
_Avoid_: window, downtime, cooldown

**Crit window**:
The frozen state after a blue buildup, during which a shot does critical damage. The only thing called a window.
_Avoid_: opening, freeze-out

**Matrix gap**:
A colour that deliberately fails to answer a given enemy, left empty so the player learns that not every colour solves everything.

## Enemies

**Charger**:
Melee enemy that commits to a straight line. Answered by removing its momentum.

**Sprayer**:
Ranged enemy that paints your territory grey. Answered by closing the gap or pinning it.

**Wall-crawler**:
Enemy that climbs your green paint to reach you. Your routes are its routes.

**Turret**:
Static enemy that denies space. Answered by positioning, not by paint.

**Drainer**:
Enemy that eats your territory. Weak and numerous; it attacks your resupply, not your health.

**Stalker**:
Enemy that is fast in your paint and slow on grey. Inverts the loop by making your safe ground dangerous.

**Big Arm**:
The arena boss of the final level. Repaints the ground grey and dies to a committed combo.

**Siphon**:
The level-ending exam: a structure dismantled with blue, green and red in sequence. Not a creature, and not defeated by damage.
_Avoid_: core, machine, reactor

## Structure

**Encounter gate**:
A sealed exit that opens only when the arena behind it is clear, so a fight cannot be run past.

**Fail forward**:
A fall costs time and position, never the run.

**Victory lap**:
The short, safe, fast beat between the hardest encounter and the extraction that ends a level.

**Final exam**:
The last encounter of a level, which tests that level's own idea rather than introducing anything new.

**Four pressures**:
The campaign's escalation rule. The same loop under no pressure (tutorial), with space (forest), with no space (mountain), and under attack (base).

## Campaign

**Sergeant**:
The rebel leader who briefs the player. Appears as one briefing still and one line per level.
_Avoid_: commander, captain, CO, leader

**Mission intro**:
The ≤6 s, skippable opening of a mission: one camera move from the goal to the spawn view over the grey level, under a title card (level, location, day and time, objective). No characters, no dialogue.
_Avoid_: cutscene, cinematic, flyover, intro cam

**Title card**:
The four-line text block of a mission intro. The Primer's briefing still carries it too.
_Avoid_: mission card, location stamp

**Supply lift**:
The transition that carries the player from the mountain into the military base.
_Avoid_: cable car, elevator, transition level

## Levels

**The Primer**:
The tutorial. A rebel training course, briefed by the sergeant, with no enemies until the final room.

**Outskirts**:
Level one. Forest island-hopping, generous paint, low pressure — the loop with room to breathe.

**The Ascent**:
Level two. Mountain climb with no retreat space, wall-crawlers and turrets.

**Last Colour**:
Level three. The military base, contested territory, Big Arm and the siphon.
_Avoid_: The Core (collides with the siphon)
