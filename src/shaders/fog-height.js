/**
 * OWNER: D (Shaders). Added by Renda (Levels) for L1 fog -- please review.
 *
 * HEIGHT FOG: the fog three.js already does, plus one extra term.
 *
 * Plain fog only knows how FAR a pixel is from the camera. This also asks how
 * HIGH it is, so mist can pool near the floor and thin out above it. That is
 * what makes fog cling to the base of a wall or a gate instead of covering it
 * evenly, and why the ground can read as foggy while a high ledge does not.
 *
 * WHY THIS IS A SHARED FILE AND NOT A COPY IN EACH MATERIAL:
 *   three materials need it -- paint, toon (enemy bodies) and outline. Copying
 *   the same shader into all three means fixing every bug three times and
 *   keeping three copies in step. They import these chunks instead, so the
 *   maths lives in exactly one place.
 *
 * HOW TO USE IT IN A MATERIAL -- all three steps are required, and skipping
 * one fails quietly rather than throwing:
 *
 *   1. the VERTEX shader must declare and fill `varying vec3 vWorldPos`
 *   2. the FRAGMENT shader must add FOG_HEIGHT_PARS, right after
 *      <fog_pars_fragment>
 *   3. the FRAGMENT shader must replace <fog_fragment> with
 *      FOG_HEIGHT_FRAGMENT, and the material's uniforms must include
 *      createFogHeightUniforms()
 */

/**
 * Tune the mist height HERE. One place, every material, every level.
 *
 * `floor` is where the fog is at full strength, `ceil` is where it has faded
 * out completely. World units.
 *
 * WHY THE CEILING MOVED FROM 6 TO 10 — and it is a real bug fix, not a tweak.
 *
 * The original 6 was chosen when L1's props were cones: "gone by y 6, which is
 * roughly the height of the encounter gates". Then the level got a forest. L1's
 * trees are 3.4 m, its dead trees 5 m and its twisted trees 6.5 m -- so at a
 * ceiling of 6 the canopy was 40-100% fog-free, and the fog read as mist ON THE
 * FLOOR with none of it in the woods. Renda spotted exactly that: "I know we
 * have mist on the floor but we no longer have fog in the forest."
 *
 * It hid for a while because the instanced props were not rendering at all, so
 * the corridor looked empty and the fog read as ordinary distance fog across
 * open space. Fixing the instancing exposed it.
 *
 * 10 keeps the original intent intact: the extraction ledge at y 9 is still
 * essentially fog-free (falloff 0.06), so the green climb still finishes above
 * the mist. A canopy at y 3.4 now gets 0.81 of the distance fog instead of 0.58.
 *
 * Consequence worth knowing: anything above `ceil` gets NO fog at all.
 *
 * If one level ever needs different values, pass them to
 * createFogHeightUniforms() and set them from that level. Nothing needs that
 * yet, and a per-level override would have to be pushed onto every paint
 * surface AND every enemy separately, which is why it is not done here.
 */
export const FOG_FLOOR = 0.5;
export const FOG_CEIL = 10.0;

/**
 * Fresh fog-height uniforms for ONE material.
 *
 * Fresh objects every call, never a shared constant. three.js holds a
 * material's uniforms by reference, so two materials sharing one uniform
 * object is a bug that shows up later as one of them mysteriously changing.
 * The fog uniforms above are cloned for exactly the same reason.
 */
export function createFogHeightUniforms(floor = FOG_FLOOR, ceil = FOG_CEIL) {
  return {
    uFogFloor: { value: floor },
    uFogCeil:  { value: ceil },
  };
}

/**
 * Fragment-shader head. Goes directly AFTER <fog_pars_fragment>.
 *
 * The #ifdef matches three.js's own chunk: with no scene fog these vanish, so
 * an unfogged scene pays nothing for this.
 */
export const FOG_HEIGHT_PARS = /* glsl */ `
  #ifdef USE_FOG
    uniform float uFogFloor;
    uniform float uFogCeil;
  #endif
`;

/**
 * The fog itself. Replaces <fog_fragment>, and must run LAST in main() so it
 * fades whatever colour has already been written.
 *
 * The distance half is copied from three.js's own fog_fragment unchanged, on
 * purpose: it makes the difference between the two easy to see. The height
 * half is the only addition, and it is one line.
 */
export const FOG_HEIGHT_FRAGMENT = /* glsl */ `
  #ifdef USE_FOG
    #ifdef FOG_EXP2
      float fogFactor = 1.0 - exp( - fogDensity * fogDensity * vFogDepth * vFogDepth );
    #else
      float fogFactor = smoothstep( fogNear, fogFar, vFogDepth );
    #endif

    // 1 at the floor, 0 at uFogCeil: fog thins out as you climb.
    float heightFalloff = 1.0 - smoothstep( uFogFloor, uFogCeil, vWorldPos.y );

    gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, fogFactor * heightFalloff );
  #endif
`;
