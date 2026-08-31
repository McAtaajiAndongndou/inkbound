# Conventions

Short list. Breaking these is what costs groups whole days.

## Filenames

- **Everything lowercase, hyphen-separated.** `rock-texture.png`, `level-01-mission.js`
- No spaces, no capitals, no underscores, no special characters
- Linux is case-sensitive. `Rock.PNG` and `rock.png` are different files on the
  server and identical on your laptop. This is the single most common way a game
  that worked for three months renders black once hosted.
- Run `git config core.ignorecase false` on **every machine**, once.

## Paths

```js
loader.load('./assets/models/ship.glb');   // yes
loader.load('/assets/models/ship.glb');    // NO — 404 once hosted
```

A leading `/` means "server root". Our game lives in a subfolder. It works in
dev because in dev we *are* the root. Once published it points at nothing.

For anything in `public/`, use `import.meta.env.BASE_URL`.

All external resources over **HTTPS**. An `http://` asset on an HTTPS page gets
blocked as mixed content.

## Memory — this one kills demos

Removing a mesh from the scene does **not** free its GPU memory.

```js
dispose() {
  this.root.traverse((obj) => {
    if (obj.geometry) obj.geometry.dispose();
    if (obj.material) {
      const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
      mats.forEach((m) => {
        Object.values(m).forEach((v) => { if (v?.isTexture) v.dispose(); });
        m.dispose();
      });
    }
  });
  this.game.scene.remove(this.root);
}
```

Every level implements this. Without it, memory climbs through a three-level
playthrough and the tab dies — in front of a marker.

## Performance

We are marked on **lab hardware**, not your laptop. Lag is explicitly penalised
under both Gameplay and Polish.

- **Allocate nothing per frame.** No `new THREE.Vector3()` inside `update()`.
  Create scratch vectors once at module scope and reuse them.
- **Textures dominate memory.** Smallest size that still looks right,
  power-of-two dimensions. A 12 MB PNG that could have been a 400 KB JPEG costs
  us memory *and* load time.
- **Reuse geometries and materials** across objects. Merge static meshes.
- **Shadows are expensive.** Limit which lights cast them, keep the shadow map
  resolution sensible, constrain the shadow camera to what actually needs it.
- Prefer `.glb` over `.gltf` with loose files.
- **Profile, don't guess.** Chrome DevTools Performance panel plus an on-screen
  FPS counter.

## Git

- Branch per feature: `feat/paint-splat`, `fix/minimap-aspect`
- Small commits, present tense: `add wet-edge uniform to splat shader`
- Never commit `node_modules/` or `dist/`
- Pull before you push. Always.
- Stay in your lane. Need a change in someone else's folder? Ask them.

## Code

- ES modules, one class per file
- No magic numbers in logic files — they belong in `config/tuning.js`
- No hardcoded hex colours — they belong in `config/colours.js`
- Comment the *why*, not the *what*
