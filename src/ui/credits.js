// OWNER: E (UI & Audio)
// MANDATORY. Lists every library, model, texture, sound, font and tutorial
// we did not make ourselves, with source and licence.
// Uncredited third-party work is plagiarism per the brief.
// Add entries AS YOU USE THEM. Do not try to reconstruct this at the end.
//
// CC-BY needs title, author, source, licence and a note if we changed it.
// `files` lists what this entry covers under public/ — tests/credits.test.js
// fails if a shipped asset is not covered, so a new model cannot slip in
// uncredited. Shown in-game from the menu's Credits button (menu.js).

const CC0 = { licence: 'CC0 1.0 (public domain)', licenceUrl: 'https://creativecommons.org/publicdomain/zero/1.0/' };
const CC_BY_3 = { licence: 'CC BY 3.0', licenceUrl: 'https://creativecommons.org/licenses/by/3.0/' };

export const CREDITS = [
  {
    what: 'Soldier (enemy Sprayer and Charger)',
    author: 'KolosStudios',
    // Both Soldier uploads are credited: the design (ENEMIES.md) uses the
    // armed one for the Sprayer and the unarmed one for the Charger.
    source: ['https://poly.pizza/m/XT8jgwSesV', 'https://poly.pizza/m/p0wFrzSVLS'],
    ...CC_BY_3,
    changes: 'Re-shaded with our flat grey toon material; paint hits tint it.',
    files: ['assets/soldier-charger.glb', 'assets/soldier-sprayer.glb'],
  },
  {
    what: 'Zombie half (enemy Wall-crawler)',
    author: 'Quaternius',
    source: 'https://poly.pizza/m/Htcsn9OrXJ',
    ...CC_BY_3,
    changes: 'Texture stripped; re-shaded with our flat grey toon material; paint hits tint it.',
    files: ['assets/wall-crawler.glb'],
  },
  {
    what: 'SWAT (player character)',
    author: 'Quaternius',
    source: 'https://poly.pizza/m/Btfn3G5Xv4',
    ...CC0,
    files: ['assets/soldier-swat.glb'],
  },
  {
    what: 'Sci-Fi Gun Pack (player paint gun)',
    author: 'Quaternius',
    source: 'https://poly.pizza/bundle/Scifi-Gun-Pack-rBroUbKkqM',
    ...CC0,
    files: ['assets/pistol.glb'],
  },
  {
    what: 'Universal Animation Library (player jump start, loop and land)',
    author: 'Quaternius',
    source: 'https://quaternius.com/packs/universalanimationlibrary.html',
    ...CC0,
    changes: 'Three clips retargeted from its rig onto the player rig and baked; the pack itself is not shipped.',
    files: ['assets/player-jump.clips.json'],
  },
  {
    what: 'Stylized Nature MegaKit (Level 1 forest: trees, bushes, rocks, grass, flowers, ferns, mushrooms)',
    author: 'Quaternius',
    source: 'https://quaternius.itch.io/stylized-nature-megakit',
    ...CC0,
    files: ['assets/megakit/'],
  },
  {
    what: 'Three.js (rendering, GLTFLoader, SkeletonUtils, BufferGeometryUtils)',
    author: 'three.js authors',
    source: 'https://threejs.org',
    licence: 'MIT',
    licenceUrl: 'https://github.com/mrdoob/three.js/blob/dev/LICENSE',
    changes: 'The distance half of our height-fog shader is the three.js fog_fragment chunk, unchanged.',
  },
  {
    what: 'Vite (build tool)',
    author: 'Vite contributors',
    source: 'https://vitejs.dev',
    licence: 'MIT',
    licenceUrl: 'https://github.com/vitejs/vite/blob/main/LICENSE',
  },
];

/** Made by the team — stated so markers know what is ours. */
export const OURS = [
  'All gameplay code, level layouts and shaders (paint, toon, enemy, height fog except as noted above)',
  'All sound effects, synthesised in code with the Web Audio API',
  'UI and HUD',
];
