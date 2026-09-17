import * as THREE from "three";
import { shaderMaterial } from "@react-three/drei";

/* ═══════════════════════════════════════════════════════════════════════════
   wireframeSolidMaterial — the visual signature of the whole scene.

   Every UI piece (nav bar, card, list row, chart, pill, FAB) is a single quad
   using this material. The piece's whole life is expressed through three
   uniforms:

     uEnter   0→1  entrance sweep (a gold scan reveals the outline)
     uSolid   0→1  wireframe outline  →  solid --surface/--paper panel
     uShatter 0→1  vertex displacement that fractures the quad apart again

   That means a piece is never "swapped" for another mesh — it is literally the
   same geometry crossfading, which is what makes it read as *generated* rather
   than faded in.
   ═══════════════════════════════════════════════════════════════════════════ */

export const WireframeSolidMaterial = shaderMaterial(
  {
    uTime: 0,
    uEnter: 0,
    uSolid: 0,
    uShatter: 0,
    /** aspect (w/h) so the border stays a constant world-space thickness */
    uAspect: 1,
    /** border thickness in UV units before aspect correction */
    uBorder: 0.02,
    /** corner radius in UV units */
    uRadius: 0.06,
    /** 1 = draw the inner accent bar in gold */
    uAccent: 0,
    /** per-piece random seed so no two pieces fracture identically */
    uSeed: 0,
    uGold: new THREE.Color("#d9a94a"),
    uGoldBright: new THREE.Color("#f4c862"),
    uSurface: new THREE.Color("#10141b"),
    uPaper: new THREE.Color("#ece8de"),
    uLine: new THREE.Color("#ece8de"),
    uOpacity: 1,
  },

  /* ═══ VERTEX ═══════════════════════════════════════════════════════════
     The shatter is done here, not in JS. Each quad is subdivided (the
     geometry is a 6×8 PlaneGeometry) so individual cells can be pushed out
     along a pseudo-random direction derived from the cell centre. Because the
     displacement is a pure function of (position, uSeed, uShatter) it costs
     nothing per frame and every piece breaks apart differently.
     ══════════════════════════════════════════════════════════════════════ */
  /* glsl */ `
    varying vec2  vUv;
    varying float vShard;   // per-cell random, used to fade shards out
    varying vec3  vViewDir;

    uniform float uShatter;
    uniform float uSeed;
    uniform float uTime;

    float hash11(float n) { return fract(sin(n * 78.233) * 43758.5453); }
    float hash12(vec2 p) {
      p = fract(p * vec2(123.34, 456.21));
      p += dot(p, p + 45.32);
      return fract(p.x * p.y);
    }

    void main() {
      vUv = uv;

      vec3 pos = position;

      /* Quantise UV into cells so all 4 verts of a cell share a random value
         and the cell therefore translates rigidly rather than stretching. */
      vec2 cell = floor(uv * vec2(6.0, 8.0));
      float r1 = hash12(cell + uSeed);
      float r2 = hash12(cell + uSeed + 17.13);
      float r3 = hash12(cell + uSeed + 41.77);
      vShard = r1;

      if (uShatter > 0.0001) {
        /* Per-shard delay: shards leave in a ragged wave, not all at once. */
        float delay = r1 * 0.35;
        float s = clamp((uShatter - delay) / (1.0 - delay), 0.0, 1.0);
        s = s * s;  // ease-in — slow release, then thrown

        vec3 dir = normalize(vec3(
          (r1 - 0.5) * 2.0,
          (r2 - 0.5) * 2.0,
          r3 * 0.9 + 0.35        // biased forward, out of the screen plane
        ));

        pos += dir * s * (0.55 + r2 * 0.65);
        // slight tumble: shear the cell around its own centre
        float spin = (r3 - 0.5) * 6.0 * s;
        vec2 c = (cell + 0.5) / vec2(6.0, 8.0) - 0.5;
        vec2 rel = uv - 0.5 - c;
        pos.xy += vec2(
          rel.x * cos(spin) - rel.y * sin(spin) - rel.x,
          rel.x * sin(spin) + rel.y * cos(spin) - rel.y
        ) * 0.6;
      }

      vec4 world = modelMatrix * vec4(pos, 1.0);
      vViewDir = normalize(cameraPosition - world.xyz);
      gl_Position = projectionMatrix * viewMatrix * world;
    }
  `,

  /* ═══ FRAGMENT ═════════════════════════════════════════════════════════ */
  /* glsl */ `
    precision highp float;

    varying vec2  vUv;
    varying float vShard;
    varying vec3  vViewDir;

    uniform float uTime;
    uniform float uEnter;
    uniform float uSolid;
    uniform float uShatter;
    uniform float uAspect;
    uniform float uBorder;
    uniform float uRadius;
    uniform float uAccent;
    uniform float uSeed;
    uniform vec3  uGold;
    uniform vec3  uGoldBright;
    uniform vec3  uSurface;
    uniform vec3  uPaper;
    uniform vec3  uLine;
    uniform float uOpacity;

    /* Rounded-rect SDF in aspect-corrected space so the border reads as a
       uniform physical thickness on both wide nav bars and square FABs. */
    float sdRoundBox(vec2 p, vec2 b, float r) {
      vec2 q = abs(p) - b + r;
      return min(max(q.x, q.y), 0.0) + length(max(q, 0.0)) - r;
    }

    float hash21(vec2 p) {
      p = fract(p * vec2(123.34, 456.21));
      p += dot(p, p + 45.32);
      return fract(p.x * p.y);
    }
    float vnoise(vec2 p) {
      vec2 i = floor(p); vec2 f = fract(p);
      vec2 u = f * f * (3.0 - 2.0 * f);
      return mix(mix(hash21(i), hash21(i + vec2(1,0)), u.x),
                 mix(hash21(i + vec2(0,1)), hash21(i + vec2(1,1)), u.x), u.y);
    }

    void main() {
      /* Work in a space where x is stretched by the aspect ratio. */
      vec2 p = (vUv - 0.5) * vec2(uAspect, 1.0);
      // NOTE: 'half' is a reserved word in GLSL ES — named hb (half-bounds).
      vec2 hb = vec2(0.5 * uAspect, 0.5) - vec2(uBorder * 0.5);

      float d = sdRoundBox(p, hb, uRadius);

      /* ── Outline band ──────────────────────────────────────────────────
         |d| small  ⇒  we're on the border ring. */
      float line = 1.0 - smoothstep(0.0, uBorder, abs(d));
      /* ── Interior mask ─────────────────────────────────────────────── */
      float fill = 1.0 - smoothstep(-uBorder * 0.5, uBorder * 0.5, d);

      /* ── Entrance sweep ────────────────────────────────────────────────
         A gold wavefront travels bottom→top across the piece as uEnter goes
         0→1; the outline only exists behind the wavefront. Adding a hot band
         right at the front edge gives the "being drawn" cursor feel. */
      float sweepY = vUv.y;
      float head   = uEnter * 1.25 - 0.12;
      float drawn  = smoothstep(head + 0.10, head - 0.02, sweepY);
      float hot    = exp(-pow((sweepY - head) * 9.0, 2.0)) * (1.0 - step(0.999, uEnter));

      /* ── Wireframe layer ─────────────────────────────────────────────── */
      vec3  wireCol = mix(uGold, uGoldBright, hot);
      float wireA   = line * drawn * (1.0 - uSolid * 0.72) + hot * line * 0.9;

      /* Faint interior hatch while still a wireframe — reads as "measured
         space", echoing the 2D blueprint background it replaces. */
      float hatch = (1.0 - smoothstep(0.0, 0.004, abs(fract(vUv.y * 9.0) - 0.5) - 0.48));
      wireA += hatch * fill * drawn * (1.0 - uSolid) * 0.16;

      /* ── Solid layer ───────────────────────────────────────────────────
         Panel fill + grain + a soft internal gradient. Never pure flat. */
      float grain = vnoise(vUv * 160.0 + uSeed) * 0.5 + vnoise(vUv * 38.0) * 0.5;
      vec3  solidCol = mix(uSurface, uPaper, 0.055);
      solidCol += (grain - 0.5) * 0.05;
      solidCol += uPaper * (1.0 - vUv.y) * 0.035;

      /* Content stand-ins: two "text" bars inside the panel, in --paper.
         These are what make an assembled card read as a card and not a slab. */
      float bar1 = step(0.10, vUv.x) * step(vUv.x, 0.10 + 0.52)
                 * step(0.30, vUv.y) * step(vUv.y, 0.42);
      float bar2 = step(0.10, vUv.x) * step(vUv.x, 0.10 + 0.34)
                 * step(0.54, vUv.y) * step(vUv.y, 0.64);
      float bars = (bar1 + bar2) * fill;
      solidCol = mix(solidCol, uPaper, bars * 0.30);

      /* Accent bar — gold, only on flagged pieces. This is bright enough to
         bloom, which is exactly the intent: gold is the only bloom source. */
      float acc = step(0.10, vUv.x) * step(vUv.x, 0.34)
                * step(0.72, vUv.y) * step(vUv.y, 0.84) * fill * uAccent;
      solidCol = mix(solidCol, uGold, acc * 0.85);

      /* Panel edge keeps a thin --line stroke once solid, so pieces stay
         separable against each other. */
      vec3 solidEdge = mix(uLine * 0.55, uGold, 0.25);

      /* ── Composite wireframe → solid ───────────────────────────────── */
      vec3  col = solidCol;
      float alpha = fill * uSolid * 0.90;

      // solid outline
      col   = mix(col, solidEdge, clamp(line * uSolid, 0.0, 1.0));
      alpha = max(alpha, line * uSolid * 0.55);

      // wireframe on top
      col   = mix(col, wireCol, clamp(wireA, 0.0, 1.0));
      alpha = max(alpha, wireA);

      /* ── Shatter fade ──────────────────────────────────────────────────
         Shards dim and go gold as they fly, so the piece visually "returns"
         to the particle field rather than just vanishing. */
      if (uShatter > 0.0001) {
        float s = clamp((uShatter - vShard * 0.35) / 0.65, 0.0, 1.0);
        col   = mix(col, uGoldBright, s * 0.55);
        alpha *= (1.0 - s);
      }

      alpha *= uOpacity;
      if (alpha < 0.004) discard;

      gl_FragColor = vec4(col, alpha);
      #include <colorspace_fragment>
    }
  `
);

export type WireframeSolidMaterialImpl = THREE.ShaderMaterial & {
  uTime: number;
  uEnter: number;
  uSolid: number;
  uShatter: number;
  uAspect: number;
  uBorder: number;
  uRadius: number;
  uAccent: number;
  uSeed: number;
  uOpacity: number;
};
