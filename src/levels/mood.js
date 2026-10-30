// OWNER: E (Levels)
//
// A level's mood — sky, distance haze and a fill light — from one config block
// (`{ horizon, zenith, void, fogNear, fogFar, fillColour, fillIntensity }`).
//
// The same recipe Outskirts' `_mood()` uses, lifted out so a data level can
// borrow it in one call (the Primer, polish pass 1). Outskirts keeps its own
// copy of the mist and forest, but its sky now comes from here too (#197).
//
// The one rule that matters: fog matches the sky's HORIZON band, not the whole
// background, or the sky becomes a flat plate fog can never vary across (see
// level-01-mission.js's MOOD notes for the full story).
//
// Everything is added under `level.root` (the dispose walk frees it), the sky
// and fill go in `level.atmosphere` so main.js can hide them for the minimap,
// and the dome is unlit: no `uLightDir` to wire (AGENTS rule 5).
//
// THE DYNAMIC SKY (#197). A mood with a `drained` palette gets a sky that
// starts Corp grey and warms to the level's own colours as its territory
// grows: the theme — you put the colour back — paid off overhead, not only at
// your feet. See DynamicSky below. A mood without one (the Primer, indoors)
// keeps a static sky, which is the contrast that shows the dynamic one is a choice.
import * as THREE from 'three';
import { SKY } from '../config.js';
import { SkyProbe } from '../shaders/sky-probe.js';

function smoothstep(edge0, edge1, x) {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

const skyVertex = /* glsl */ `
  attribute float aBand;   // 0 at the bottom pole, 1 at the top; the horizon is 0.5
  varying float vBand;
  varying float vAzimuth;  // round the horizon, -PI..PI (the hills' x)
  void main() {
    vBand = aBand;
    vAzimuth = atan(position.z, position.x);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

// The same three bands the vertex-coloured dome had — haze at the horizon, the
// zenith above, the void below — now blended per pixel from three uniforms so
// the game can move them. The haze band stays broad: the walls and gates sit
// ~11 degrees up, inside it (see Outskirts' MOOD notes).
//
// THE HILLS (Renda, 30 Oct; a mood's optional `hills`): two crest lines just
// above the horizon, each a sum of sines whose frequencies are whole numbers,
// so the line closes on itself all the way round with no seam and no gaps.
// Below a crest the sky is mixed toward the void: the far layer a little, the
// near layer more. They use the band uniforms, so they warm with the sky.
// uHills.x = 0 turns them off (every level without `hills`).
const skyFragment = /* glsl */ `
  uniform vec3 uHorizon;
  uniform vec3 uZenith;
  uniform vec3 uVoid;
  uniform vec4 uHills;      // x on (0/1), y mean crest height, z swell, w softness
  uniform vec3 uHillShade;  // x far shade, y near shade, z near layer's drop
  varying float vBand;
  varying float vAzimuth;
  // Ridged: 1 - |sin| turns each wave into a peak, so crests read as hilltops
  // rather than a rolling gradient. Whole-number frequencies close the loop.
  float ridge(float x) { return 1.0 - abs(sin(x)) * 2.0; }
  float crest(float a, float seed) {
    return sin(a * 3.0 + seed) * 0.4
         + ridge(a * 7.0 + seed * 2.3) * 0.3
         + ridge(a * 17.0 + seed * 4.1) * 0.2
         + sin(a * 41.0 + seed * 1.3) * 0.1;
  }
  void main() {
    vec3 c = mix(uHorizon, uZenith, smoothstep(0.5, 0.8, vBand));
    c = mix(c, uVoid, 1.0 - smoothstep(0.3, 0.5, vBand));
    if (uHills.x > 0.5) {
      float far = 0.5 + uHills.y + uHills.z * crest(vAzimuth, 1.7);
      float near = 0.5 + uHills.y - uHillShade.z + uHills.z * crest(vAzimuth, 5.3);
      float inFar = 1.0 - smoothstep(far - uHills.w, far + uHills.w, vBand);
      float inNear = 1.0 - smoothstep(near - uHills.w, near + uHills.w, vBand);
      vec3 ground = mix(uHorizon, uVoid, uHillShade.x);
      c = mix(c, ground, inFar * step(0.45, vBand));
      c = mix(c, mix(uHorizon, uVoid, uHillShade.y), inNear * step(0.45, vBand));
    }
    gl_FragColor = vec4(c, 1.0);
    #include <colorspace_fragment>
  }
`;

/**
 * A three-band sky dome: a small ShaderMaterial whose band colours are the
 * uniforms uHorizon / uZenith / uVoid (#197), starting on `colours` (the
 * mood's own palette by default). `fog: false` is load-bearing (see
 * Outskirts): at radius 200 the whole dome would be fogged flat.
 */
export function skyDome(mood, radius = 200, colours = mood) {
  const geo = new THREE.SphereGeometry(radius, 32, 20);
  const pos = geo.attributes.position;
  const band = new Float32Array(pos.count);
  for (let i = 0; i < pos.count; i++) band[i] = (pos.getY(i) / radius + 1) / 2;
  geo.setAttribute('aBand', new THREE.BufferAttribute(band, 1));
  const material = new THREE.ShaderMaterial({
    vertexShader: skyVertex,
    fragmentShader: skyFragment,
    uniforms: {
      uHorizon: { value: new THREE.Color(colours.horizon) },
      uZenith: { value: new THREE.Color(colours.zenith) },
      uVoid: { value: new THREE.Color(colours.void) },
      uHills: { value: mood.hills
        ? new THREE.Vector4(1, mood.hills.height, mood.hills.swell, mood.hills.soft)
        : new THREE.Vector4(0, 0, 0, 0) },
      uHillShade: { value: mood.hills
        ? new THREE.Vector3(mood.hills.farShade, mood.hills.nearShade, mood.hills.nearDrop)
        : new THREE.Vector3() },
    },
    side: THREE.BackSide,
    fog: false,
    depthWrite: false,
  });
  const dome = new THREE.Mesh(geo, material);
  dome.name = 'sky-dome';
  return dome;
}

/**
 * THE DYNAMIC SKY (#197): the dome's colours follow the level's territory.
 *
 *   coverage  the mean of surface.coverage() — the number the HUD shows —
 *             re-scanned SKY.scansPerSecond times a second, never per frame
 *   k         smoothstep(SKY.from, SKY.to, coverage): 0 drained, 1 restored.
 *             The shown value eases toward it at SKY.rate, so a big paint
 *             burst rolls the sky over the next second instead of snapping.
 *   fog       follows uHorizon every frame the sky moves — this file's one
 *             load-bearing rule, or the haze is a grey band on a coloured sky
 *   probe     the wet paint's reflection (#194) is re-photographed when k has
 *             moved by more than SKY.refreshStep since the last time, never
 *             every frame
 *
 * Last Colour's Siphon overrides it: drain() pulls the sky toward drained while
 * its exam runs; restore() rolls it to fully restored within SKY.finale s.
 */
export class DynamicSky {
  constructor({ dome, mood, surfaces, fog = null, probe = null }) {
    this.uniforms = dome.material.uniforms;
    this.surfaces = surfaces;
    this.fog = fog;
    this.probe = probe;
    this.drained = {
      horizon: new THREE.Color(mood.drained.horizon),
      zenith: new THREE.Color(mood.drained.zenith),
      void: new THREE.Color(mood.drained.void),
    };
    this.restored = {
      horizon: new THREE.Color(mood.horizon),
      zenith: new THREE.Color(mood.zenith),
      void: new THREE.Color(mood.void),
    };
    this.coverage = 0;
    this.target = 0;
    this.k = 0;
    this.scans = 0;
    this._scanTimer = 0;        // counts down; the first scan is on the first update
    this._refreshedAt = 0;
    this._mode = 'territory';   // 'territory' | 'drain' | 'finale'
    this._apply();
  }

  /** The level's territory: the HUD's number (#127), 0..1. */
  scan() {
    const s = this.surfaces;
    let sum = 0;
    for (let i = 0; i < s.length; i++) sum += s[i].coverage();
    this.coverage = s.length ? sum / s.length : 0;
    this.scans += 1;
    return this.coverage;
  }

  /** The Siphon is draining: pull the sky toward drained (Last Colour). */
  drain() {
    if (this._mode !== 'finale') this._mode = 'drain';
  }

  /** The Siphon is destroyed: restore the sky fully within SKY.finale s, for good. */
  restore() {
    this._mode = 'finale';
  }

  update(dt) {
    this._scanTimer -= dt;
    if (this._scanTimer <= 0) {
      this._scanTimer += 1 / SKY.scansPerSecond;
      // A frame longer than the interval still scans once, not to catch up.
      if (this._scanTimer <= 0) this._scanTimer = 1 / SKY.scansPerSecond;
      this.scan();
    }

    const before = this.k;
    if (this._mode === 'finale') {
      this.target = 1;
      this.k = Math.min(1, this.k + dt / SKY.finale);
    } else {
      this.target = this._mode === 'drain' ? 0 : smoothstep(SKY.from, SKY.to, this.coverage);
      this.k += (this.target - this.k) * Math.min(1, SKY.rate * dt);
    }
    if (this.k !== before) this._apply();
  }

  _apply() {
    const u = this.uniforms;
    const k = this.k;
    u.uHorizon.value.copy(this.drained.horizon).lerp(this.restored.horizon, k);
    u.uZenith.value.copy(this.drained.zenith).lerp(this.restored.zenith, k);
    u.uVoid.value.copy(this.drained.void).lerp(this.restored.void, k);
    if (this.fog) this.fog.color.copy(u.uHorizon.value);
    if (this.probe && Math.abs(k - this._refreshedAt) > SKY.refreshStep) {
      this._refreshedAt = k;
      this.probe.refresh();
    }
  }
}

/**
 * The sky, its driver and the haze, as one call. Outskirts uses it from its own
 * `_mood()`; data levels get it through applyMood. Returns the dome.
 */
export function buildSky(level, mood) {
  // A mood with a `drained` palette starts drained; the driver warms it (#197).
  const start = mood.drained ?? mood;
  const dome = skyDome(mood, mood.skyRadius, start);
  level.atmosphere.add(dome);
  level.game.scene.fog = new THREE.Fog(start.horizon, mood.fogNear, mood.fogFar);
  // #194: the sky that wet paint mirrors, photographed once now the dome exists.
  level.skyProbe = new SkyProbe({ atmosphere: level.atmosphere, renderer: level.game.renderer });
  level.sky = mood.drained
    ? new DynamicSky({ dome, mood, surfaces: level.surfaces, fog: level.game.scene.fog, probe: level.skyProbe })
    : null;
  return dome;
}

/** Give `level` its sky, haze and fill light. Call from `load()`. */
export function applyMood(level, mood) {
  level.atmosphere = new THREE.Group();
  level.root.add(level.atmosphere);
  level.game.scene.background = new THREE.Color(mood.void);

  // Opposite the sun and lower, no shadows: shape back on built-in materials.
  const fill = new THREE.DirectionalLight(mood.fillColour, mood.fillIntensity);
  fill.position.set(-18, 12, -12);
  fill.castShadow = false;
  level.root.add(fill);

  buildSky(level, mood);
  return fill;
}
