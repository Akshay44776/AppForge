import * as THREE from "three";
import { shaderMaterial } from "@react-three/drei";

/* ═══════════════════════════════════════════════════════════════════════════
   glassMaterial — the phone screen plane + the phone chassis share this file.

   Two materials:
     GlassMaterial   → the screen: dark smoked glass, fresnel edge glow, fine
                       grain, a faint radial "power-on" bloom from centre, and
                       the shatter-grid overlay used during `submitting`.
     ChassisMaterial → the phone body: brushed anisotropic metal, fresnel rim
                       light in gold, noise grain. Deliberately MATTE — its
                       output never crosses the bloom threshold.

   Both are hand-written GLSL. No MeshStandardMaterial anywhere.
   ═══════════════════════════════════════════════════════════════════════════ */

/* ─── shared GLSL chunks ─────────────────────────────────────────────────── */

/* Cheap 2D value-noise. Used for surface grain so flat planes never read as
   flat vector fills. hash21 → single float per cell, then bilinear-smoothed. */
const NOISE = /* glsl */ `
  float hash21(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }
  float vnoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    // quintic smoothstep — C2 continuous, avoids the blocky look of linear lerp
    vec2 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
    float a = hash21(i);
    float b = hash21(i + vec2(1.0, 0.0));
    float c = hash21(i + vec2(0.0, 1.0));
    float d = hash21(i + vec2(1.0, 1.0));
    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
  }
`;

/* Fresnel: how grazing the view angle is. pow() controls how tight the rim is.
   This is what makes the edges of the chassis/screen catch light the way a
   real anodised phone edge does, instead of reading as a flat silhouette. */
const FRESNEL = /* glsl */ `
  float fresnel(vec3 N, vec3 V, float power) {
    return pow(1.0 - clamp(dot(normalize(N), normalize(V)), 0.0, 1.0), power);
  }
`;

/* Signed-distance to a rounded rectangle in UV space (centred at 0.5).
   Used to inset the screen's inner glow and to mask the chassis edge. */
const SDF_BOX = /* glsl */ `
  float sdRoundBox(vec2 p, vec2 b, float r) {
    vec2 q = abs(p) - b + r;
    return min(max(q.x, q.y), 0.0) + length(max(q, 0.0)) - r;
  }
`;

/* ═══════════════════════════════════════════════════════════════════════════
   SCREEN GLASS
   ═══════════════════════════════════════════════════════════════════════════ */
export const GlassMaterial = shaderMaterial(
  {
    uTime: 0,
    /** 0 = dormant dark screen, 1 = fully powered/assembled */
    uPower: 0,
    /** one-shot gold flash on submit (0..1) */
    uFlash: 0,
    /** shatter grid visibility (0..1) — the radiating wireframe lattice */
    uShatter: 0,
    uGold: new THREE.Color("#d9a94a"),
    uGoldBright: new THREE.Color("#f4c862"),
    uInk: new THREE.Color("#07090d"),
    uSurface: new THREE.Color("#10141b"),
    uOpacity: 1,
  },
  /* ── vertex ── */
  /* glsl */ `
    varying vec2 vUv;
    varying vec3 vNormalW;
    varying vec3 vViewDir;

    void main() {
      vUv = uv;
      vec4 world = modelMatrix * vec4(position, 1.0);
      vNormalW = normalize(mat3(modelMatrix) * normal);
      vViewDir = normalize(cameraPosition - world.xyz);
      gl_Position = projectionMatrix * viewMatrix * world;
    }
  `,
  /* ── fragment ── */
  /* glsl */ `
    precision highp float;

    varying vec2 vUv;
    varying vec3 vNormalW;
    varying vec3 vViewDir;

    uniform float uTime;
    uniform float uPower;
    uniform float uFlash;
    uniform float uShatter;
    uniform vec3  uGold;
    uniform vec3  uGoldBright;
    uniform vec3  uInk;
    uniform vec3  uSurface;
    uniform float uOpacity;

    ${NOISE}
    ${FRESNEL}
    ${SDF_BOX}

    void main() {
      vec2 p = vUv - 0.5;

      /* ── 1. Base smoked glass ───────────────────────────────────────────
         Dark, slightly warmer toward the centre. A vertical gradient fakes
         an off-screen light source raking across the panel. */
      float vert = smoothstep(-0.55, 0.55, p.y);
      vec3 base = mix(uInk, uSurface, 0.35 + vert * 0.4);

      /* ── 2. Fine dust / micro-scratch grain ─────────────────────────────
         Two octaves at very different scales: a coarse smudge and a tight
         speckle. Keeps the glass from ever looking like a flat fill. */
      float grain = vnoise(vUv * 420.0) * 0.5 + vnoise(vUv * 94.0) * 0.5;
      base += (grain - 0.5) * 0.045;

      /* ── 3. Fresnel edge — the glass catches light at grazing angles ──── */
      float fres = fresnel(vNormalW, vViewDir, 2.6);
      base += uGold * fres * 0.11;

      /* ── 4. Inner power glow ────────────────────────────────────────────
         A rounded-rect SDF inset from the edge; as uPower rises the interior
         lifts out of black, so the screen reads as literally switching on. */
      float d = sdRoundBox(p, vec2(0.46, 0.47), 0.05);
      float inner = 1.0 - smoothstep(-0.02, 0.06, d);
      float radial = 1.0 - length(p * vec2(1.0, 0.52)) * 1.35;
      radial = clamp(radial, 0.0, 1.0);
      base += uGold * inner * radial * uPower * 0.20;

      /* ── 5. Shatter lattice ─────────────────────────────────────────────
         Radiating spokes + a square grid, both fading out with distance from
         centre. This is the "screen fractures into a wireframe" beat: the
         spokes sweep outward as uShatter goes 0 → 1. */
      float lattice = 0.0;
      if (uShatter > 0.001) {
        // square grid
        vec2 g = abs(fract(vUv * 13.0) - 0.5);
        float grid = 1.0 - smoothstep(0.0, 0.055, min(g.x, g.y));

        // radial spokes
        float ang = atan(p.y, p.x);
        float spokes = abs(fract(ang / 6.2831853 * 24.0) - 0.5);
        spokes = 1.0 - smoothstep(0.0, 0.09, spokes);

        float r = length(p * vec2(1.0, 0.5));
        // wavefront: the lattice reveals outward from the centre
        float wave = smoothstep(uShatter * 0.9, uShatter * 0.9 - 0.28, r);
        lattice = (grid * 0.55 + spokes * 0.65) * wave * inner;
      }
      base += uGold * lattice * uShatter * 0.55;

      /* ── 6. Submit flash ────────────────────────────────────────────────
         Brief full-panel bloom on the "enter" beat. Only this and the gold
         lattice ever exceed the bloom threshold. */
      base += uGoldBright * uFlash * inner * 0.7;

      /* ── 7. Specular streak ─────────────────────────────────────────────
         A single soft diagonal highlight that drifts very slowly — sells the
         surface as glass rather than paint. */
      float streak = exp(-pow((p.x * 1.6 + p.y * 0.9 + sin(uTime * 0.11) * 0.5), 2.0) * 6.0);
      base += vec3(0.42, 0.45, 0.52) * streak * 0.05;

      float alpha = uOpacity * (0.86 + fres * 0.14);
      gl_FragColor = vec4(base, alpha);
      #include <colorspace_fragment>
    }
  `
);

/* ═══════════════════════════════════════════════════════════════════════════
   CHASSIS — brushed metal body. Matte by construction.
   ═══════════════════════════════════════════════════════════════════════════ */
export const ChassisMaterial = shaderMaterial(
  {
    uTime: 0,
    uGold: new THREE.Color("#d9a94a"),
    uInk: new THREE.Color("#07090d"),
    uSurface: new THREE.Color("#10141b"),
    uMuted: new THREE.Color("#828a97"),
    uOpacity: 1,
  },
  /* glsl */ `
    varying vec3 vNormalW;
    varying vec3 vViewDir;
    varying vec3 vPosL;

    void main() {
      vPosL = position;
      vec4 world = modelMatrix * vec4(position, 1.0);
      vNormalW = normalize(mat3(modelMatrix) * normal);
      vViewDir = normalize(cameraPosition - world.xyz);
      gl_Position = projectionMatrix * viewMatrix * world;
    }
  `,
  /* glsl */ `
    precision highp float;

    varying vec3 vNormalW;
    varying vec3 vViewDir;
    varying vec3 vPosL;

    uniform float uTime;
    uniform vec3  uGold;
    uniform vec3  uInk;
    uniform vec3  uSurface;
    uniform vec3  uMuted;
    uniform float uOpacity;

    ${NOISE}
    ${FRESNEL}

    void main() {
      vec3 N = normalize(vNormalW);

      /* Two fixed lights, hand-placed — no scene lights, so the body reads
         identically regardless of what else is in the scene.
           key  : gold-tinted, high and behind
           fill : cool, from below, almost invisible */
      vec3 keyDir  = normalize(vec3(-0.45,  0.85,  0.55));
      vec3 fillDir = normalize(vec3( 0.55, -0.70,  0.35));

      float key  = max(dot(N, keyDir), 0.0);
      float fill = max(dot(N, fillDir), 0.0);

      /* Anisotropic brush: stripes running along the chassis' long axis.
         Perturbing by noise stops it from looking like a printed pattern. */
      float brush = vnoise(vec2(vPosL.x * 240.0, vPosL.y * 6.0));
      float micro = vnoise(vPosL.xy * 380.0);

      vec3 col = mix(uInk, uSurface, 0.55);
      col += vec3(0.055) * key;                       // broad key falloff
      col += uGold * pow(key, 5.0) * 0.16;            // warm tight highlight
      col += uMuted * pow(fill, 4.0) * 0.045;         // cool underside kiss
      col += (brush - 0.5) * 0.035;                   // brushed grain
      col += (micro - 0.5) * 0.018;                   // micro speckle

      /* Fresnel rim — the single strongest cue that this is a solid object
         with a machined edge, not a box with a flat material on it. */
      float fres = fresnel(N, vViewDir, 3.4);
      col += uGold * fres * 0.30;
      col += vec3(0.12, 0.13, 0.16) * pow(fres, 1.6) * 0.5;

      /* Hard clamp keeps the chassis under the bloom threshold (0.72) so it
         stays matte while gold-emissive UI elements bloom. */
      col = min(col, vec3(0.62));

      gl_FragColor = vec4(col, uOpacity);
      #include <colorspace_fragment>
    }
  `
);

/* Constructor types so `new GlassMaterial()` is typed without JSX augmentation. */
export type GlassMaterialImpl = THREE.ShaderMaterial & {
  uTime: number;
  uPower: number;
  uFlash: number;
  uShatter: number;
  uOpacity: number;
};

export type ChassisMaterialImpl = THREE.ShaderMaterial & {
  uTime: number;
  uOpacity: number;
};
