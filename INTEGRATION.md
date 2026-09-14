# How Inkbound Works

This is the "read me first" file. It explains the core mechanic, how the pieces connect, and the rules that keep our five folders from drifting apart. Everyone should be able to explain this.

---

## The primer: one grid, two readers

The whole game is one grid of numbers.

Every paintable surface hides a grid underneath it. Each grid cell stores one number — the paint id:

| 0 | 1 | 2 | 3 |
|---|---|---|---|
| grey (dead) | blue (ice) | red (bounce) | green (grip) |

When you shoot paint, the gun just fills a circle of cells in that grid (`splat()`). Nobody touches geometry. Painting = changing numbers.

That same grid is read by exactly two things:

```
        THE PAINT GRID  (one array of ids)
             /          \
        SHADER         PLAYER PHYSICS
     "what it"        "how it behaves"
     looks like        feels like
```

- The **shader** samples the grid and draws the matching colour on the surface. That's what you see.
- The **player controller** asks the grid what rules are in force under its feet (`surfaceAtWorld()`), and gets back friction / restitution / climbable for whatever colour is there. That's what you feel.

Because both read the same numbers, looking and feeling can never disagree. A patch that looks blue is blue — slide on it. Paint the floor red, bounce. Paint the wall green, climb. No special cases. It's all just "read the grid, act on the number."

Painting never costs performance: the grid is numbers, not geometry, so a fully-painted floor is still one mesh, one draw call.

---

## A play session, traced through the code

### 1. The player exists in a world

```js
level = buildLevel1();              // returns { group, surfaces, spawn }
player = new Player(level.surfaces);
player.position.copy(level.spawn);
```

A level is a **package**: the meshes you see (`group`), the paintable surfaces the player and gun can touch (`surfaces`), and where the player starts (`spawn`). `main.js` never needs to know the level's layout — it just receives the package. That's the whole level contract, and it's why levels 2 and 3 plug in by returning the same shape.

### 2. The player shoots paint

```js
// PaintGun.tryFire() raycasts from screen centre
hit = raycaster.intersectObjects(level.surfaces' meshes)[0];
surface = hit.object.userData.paintSurface;   // the bridge
surface.splat(hit.point, 'blue', radius);     // writes ids into the grid
```

The raycast only knows about meshes, so each surface's mesh carries a link back to its `PaintSurface` via `userData`. The gun stays dumb — it doesn't care *which* surface it hit, it just says "whoever you are, splat here." Add a new platform to a level and it's automatically paintable, no new code.

### 3. Blue makes you slide

Every frame the player raycasts straight down to find the ground, then asks the grid what rules are in force at that spot:

```js
const rules = ground.surface.surfaceAtWorld(ground.point);
// returns config.SURFACE.blue → { friction: 0.4, restitution: 0, climbable: false }
velocity *= (1 - rules.friction * dt);
```

Grey has friction `10.0`, blue has `0.4` — that one number *is* the ice. The bounce and the climb run down the exact same path; only the numbers differ. There is no special-cased "ice code" anywhere.

### 4. Red bounces, green climbs

Same path, different `config.js` values:

- Red: falling onto it flips your fall speed (restitution `0.85`, and a `minBounce` so simply walking onto it still launches you).
- Green: pushing into the wall sets `climbable: true`, and the player climbs instead of falling.

### 5. The enemy (week 2 — contract fixed now)

Enemies live in an array alongside player and gun. Each gets `enemy.update(dt, player.position)` each frame so they can chase. Their mesh uses the same `userData` pattern, so the paint gun can hit them with the same one verb: **paint an enemy and the colour does something to it** — blue slips them, red knocks them back, green pins them. Same rule as the floor, on a moving target. That's the pitch.

### 6. Extraction and restart

The level decides where it ends. The HUD shows win/lose. `R` calls `loadLevel()` again, which tosses `group`, `player.mesh`, `surfaces` — and calls `dispose()` on every GPU resource first. That's the pattern that makes restart-without-refresh safe, and it's the reason **nothing new goes into the world without a `dispose()`**.

---

## The rule that connects everyone: `isFloor`

```js
floor.isFloor = true;   // player can walk on it
wall.isFloor = false;   // player collides with it, can climb it if green
```

The player splits your surfaces into walkable floors and solid walls purely from this flag. **Every `PaintSurface` in the level must set it** — forget it and the player falls through the floor or walks through the wall. One boolean, one line, everyone depends on it.

---

## Config: the single source of truth

Every colour, physics number, ammo value and enemy stat lives in `config.js`.

```
config.SURFACE.blue → stored in the grid → read by shader + player
```

No magic numbers anywhere else. Never hardcode a tuning value in your folder — that's how the five of us silently drift into different versions of the game. If a number changes the feel, it changes in `config.js` and everybody gets it.

---

## Why it's built this way

| Decision | Why | The cost |
|---|---|---|
| Paint in a DataTexture | One mesh, one draw call, no matter how much paint | Splats are grid-aligned, not smooth decals |
| `dispose()` on every level | Removing a mesh does *not* free GPU memory; a 3-level run kills the tab on lab hardware | Every level must implement it |
| Hand-rolled physics | No async WASM init, works today, shows the mechanic | Can't collide against arbitrary geometry yet (Rapier in week 2) |
| Public methods, not globals | Each folder owns its file; the rest of us use its API | Changing a signature needs a group-chat heads-up |

---

## Friday checkpoint

Five questions. If any is "no", this file tells you which link broke.

1. Paint the floor blue and slide? — paint + physics
2. Paint the platform red and bounce? — paint + physics
3. Paint the wall green and climb? — paint + **your level**
4. Restart with `R`, no refresh? — the level package + `dispose()`
5. HUD shows what you're standing on? — the grid, read aloud