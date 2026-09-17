import * as THREE from "three";
import { shaderMaterial } from "@react-three/drei";

/* ═══════════════════════════════════════════════════════════════════════════
   particleGlowMaterial — one material, two behaviours, zero per-frame JS.

   The particle field is a single InstancedMesh of small shards. Rather than
   writing ~700 matrices from JS every frame, every instance's position,
   rotation and scale is computed in the VERTEX SHADER as a pure function of:

       aSeed      (vec3)  per-instance randoms, uploaded once
       aOrigin    (vec3)  its resting position on the screen plane
       uTime      (float) scene clock
       uRain      (float) 0..1  strength of the "data rain" behaviour
       uDebris    (float) 0..1  strength of the "shatter debris" behaviour

   uRain and uDebris are cross-faded by the phase machine, so the same 700
   instances serve as the stream feeding INTO the screen during `assembling`
   and as the fragments flung OUT of it during `dissolving`.
   ═══════════════════════════════════════════════════════════════════════════ */

export const ParticleGlowMaterial = shaderMaterial(
  {
    uTime: 0,
    uRain: 0,
    uDebris: 0,
    /** world-space height the rain falls through */
    uRainHeight: 3.2,
    /** how far debris is thrown */
    uDebrisRadius: 1.55,
    /** global size multiplier — dropped on low-perf devices */
    uScale: 1,
    uOpacity: 1,
    uGold: new THREE.Color("#d9a94a"),
    uGoldBright: new THREE.Color("#f4c862"),
    uMuted: new THREE.Color("#828a97"),
  },

  /* ═══ VERTEX ═══════════════════════════════════════════════════════════ */
  /* glsl */ `
    attribute vec3 aSeed;     // x,y,z ∈ [0,1) — stable per-instance randoms
    attribute vec3 aOrigin;   // resting position (on/near the screen plane)

    uniform float uTime;
    uniform float uRain;
    uniform float uDebris;
    uniform float uRainHeight;
    uniform float uDebrisRadius;
    uniform float uScale;

    varying float vGlow;      // 0 = cold/muted shard, 1 = hot gold mote
    varying float vFade;      // per-instance alpha
    varying vec2  vLocal;     // local quad uv for the soft glow falloff

    /* Rotation matrices — built per-instance from the seed so every shard
       tumbles on its own axis at its own rate. */
    mat3 rotX(float a){ float c=cos(a), s=sin(a); return mat3(1,0,0, 0,c,-s, 0,s,c); }
    mat3 rotY(float a){ float c=cos(a), s=sin(a); return mat3(c,0,s, 0,1,0, -s,0,c); }
    mat3 rotZ(float a){ float c=cos(a), s=sin(a); return mat3(c,-s,0, s,c,0, 0,0,1); }

    void main() {
      vLocal = uv;

      /* ── A. DATA RAIN ───────────────────────────────────────────────────
         Motes fall from high above the phone and converge toward the origin
         point on the screen. 'fall' is a per-instance sawtooth so the stream
         is continuous rather than a single burst. */
      float speed = 0.35 + aSeed.z * 0.55;
      float fall  = fract(uTime * speed + aSeed.x * 7.13);   // 0 (top) → 1 (screen)

      // ease-in: motes accelerate as they approach the screen, like they're
      // being pulled in rather than dropped
      float fe = fall * fall;

      vec3 rainStart = vec3(
        (aSeed.x - 0.5) * 1.05,
        uRainHeight * 0.62,
        (aSeed.y - 0.5) * 0.85
      );
      // converge: lateral spread shrinks to near zero at the screen
      vec3 rainPos = mix(rainStart, aOrigin, fe);
      rainPos.x += sin(uTime * 1.3 + aSeed.y * 9.0) * 0.06 * (1.0 - fe);
      rainPos.z += cos(uTime * 1.1 + aSeed.x * 7.0) * 0.06 * (1.0 - fe);

      /* Rain motes brighten as they land, then snap out — a mote is hottest
         in the last 20% of its fall. */
      float rainGlow = smoothstep(0.55, 0.96, fall);
      float rainFade = smoothstep(0.0, 0.10, fall) * (1.0 - smoothstep(0.93, 1.0, fall));

      /* ── B. SHATTER DEBRIS ──────────────────────────────────────────────
         Shards launch outward from their origin along a seeded direction,
         decelerating (ease-out) and drifting slightly upward — the classic
         "explosion settles" read, not a uniform radial pop. */
      vec3 dir = normalize(vec3(
        aSeed.x - 0.5,
        aSeed.y - 0.5,
        aSeed.z * 0.75 + 0.3
      ));
      float de = 1.0 - pow(1.0 - clamp(uDebris, 0.0, 1.0), 3.0);  // outCubic
      vec3 debrisPos = aOrigin
        + dir * de * uDebrisRadius * (0.45 + aSeed.z * 0.85)
        + vec3(0.0, de * de * 0.22, 0.0);

      float debrisFade = 1.0 - smoothstep(0.55, 1.0, uDebris);
      float debrisGlow = 1.0 - smoothstep(0.0, 0.7, uDebris);

      /* ── C. BLEND ───────────────────────────────────────────────────────
         uRain and uDebris are mutually exclusive in practice, but blending
         rather than branching keeps the transition between phases seamless. */
      float wR = uRain;
      float wD = uDebris;
      float wSum = max(wR + wD, 0.0001);

      vec3  centre = (rainPos * wR + debrisPos * wD) / wSum;
      vFade  = (rainFade * wR + debrisFade * wD) / wSum * clamp(wR + wD, 0.0, 1.0);
      vGlow  = (rainGlow * wR + debrisGlow * wD) / wSum;

      /* ── D. PER-INSTANCE TUMBLE + SCALE ─────────────────────────────── */
      float spin = uTime * (0.4 + aSeed.z * 1.6);
      mat3 rot = rotZ(spin + aSeed.x * 6.28)
               * rotY(spin * 0.7 + aSeed.y * 6.28)
               * rotX(spin * 0.5);

      float size = (0.012 + aSeed.y * 0.026) * uScale;
      // hot motes are a touch larger — keeps the bloom from looking uniform
      size *= (0.75 + vGlow * 0.6);

      vec3 local = rot * (position * size);

      vec4 world = modelMatrix * vec4(centre + local, 1.0);
      gl_Position = projectionMatrix * viewMatrix * world;
    }
  `,

  /* ═══ FRAGMENT ═════════════════════════════════════════════════════════ */
  /* glsl */ `
    precision highp float;

    varying float vGlow;
    varying float vFade;
    varying vec2  vLocal;

    uniform vec3  uGold;
    uniform vec3  uGoldBright;
    uniform vec3  uMuted;
    uniform float uOpacity;

    void main() {
      /* Soft-edged shard: fade toward the quad's rim so instances read as
         motes of light rather than hard little rectangles. */
      vec2 q = abs(vLocal - 0.5) * 2.0;
      float edge = 1.0 - smoothstep(0.55, 1.0, max(q.x, q.y));

      /* Cold shards are desaturated --muted debris; hot ones are gold-bright
         and are the only particles that clear the bloom threshold. */
      vec3 cold = uMuted * 0.55;
      vec3 hot  = mix(uGold, uGoldBright, vGlow);
      vec3 col  = mix(cold, hot, smoothstep(0.15, 0.75, vGlow));

      float a = edge * vFade * uOpacity * (0.32 + vGlow * 0.85);
      if (a < 0.004) discard;

      gl_FragColor = vec4(col, a);
      #include <colorspace_fragment>
    }
  `
);

export type ParticleGlowMaterialImpl = THREE.ShaderMaterial & {
  uTime: number;
  uRain: number;
  uDebris: number;
  uRainHeight: number;
  uDebrisRadius: number;
  uScale: number;
  uOpacity: number;
};
