// OWNER: E (Levels)
//
// A level's mood — sky, distance haze and a fill light — from one config block
// (`{ horizon, zenith, void, fogNear, fogFar, fillColour, fillIntensity }`).
//
// The same recipe Outskirts' `_mood()` uses, lifted out so a data level can
// borrow it in one call (the Primer, polish pass 1). Outskirts keeps its own
// copy for now because its mist and forest hang off it; folding it onto this
// is parked in BACKLOG.md.
//
// The one rule that matters: fog matches the sky's HORIZON band, not the whole
// background, or the sky becomes a flat plate fog can never vary across (see
// level-01-mission.js's MOOD notes for the full story).
//
// Everything is added under `level.root` (the dispose walk frees it), the sky
// and fill go in `level.atmosphere` so main.js can hide them for the minimap,
// and the dome is MeshBasicMaterial: no `uLightDir` to wire (AGENTS rule 5).
import * as THREE from 'three';
import { SkyProbe } from '../shaders/sky-probe.js';

function smoothstep(edge0, edge1, x) {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

/** A three-band vertex-coloured sky dome. `fog: false` is load-bearing (see Outskirts). */
export function skyDome(mood, radius = 200) {
  const geo = new THREE.SphereGeometry(radius, 32, 20);
  const horizon = new THREE.Color(mood.horizon);
  const zenith = new THREE.Color(mood.zenith);
  const below = new THREE.Color(mood.void);
  const c = new THREE.Color();
  const pos = geo.attributes.position;
  const colours = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const ny = (pos.getY(i) / radius + 1) / 2;   // 0 bottom pole, 1 top; horizon 0.5
    c.copy(horizon).lerp(zenith, smoothstep(0.5, 0.8, ny)).lerp(below, 1 - smoothstep(0.3, 0.5, ny));
    colours[i * 3] = c.r;
    colours[i * 3 + 1] = c.g;
    colours[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colours, 3));
  return new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
    vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false,
  }));
}

/** Give `level` its sky, haze and fill light. Call from `load()`. */
export function applyMood(level, mood) {
  level.atmosphere = new THREE.Group();
  level.root.add(level.atmosphere);
  level.atmosphere.add(skyDome(mood, mood.skyRadius));

  level.game.scene.fog = new THREE.Fog(mood.horizon, mood.fogNear, mood.fogFar);
  level.game.scene.background = new THREE.Color(mood.void);

  // Opposite the sun and lower, no shadows: shape back on built-in materials.
  const fill = new THREE.DirectionalLight(mood.fillColour, mood.fillIntensity);
  fill.position.set(-18, 12, -12);
  fill.castShadow = false;
  level.root.add(fill);

  // #194: the sky that wet paint mirrors, photographed once now the dome exists.
  level.skyProbe = new SkyProbe({ atmosphere: level.atmosphere, renderer: level.game.renderer });
  return fill;
}
