"use client";

import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { shaderMaterial } from "@react-three/drei";

import { SCREEN, TOKENS, type SceneState } from "@/lib/genesisScene";

/* ═══════════════════════════════════════════════════════════════════════════
   ScanlineSweep — the 3D echo of the 2D `.scanline` keyframe in globals.css.

   The dossier cards sitting on top of this canvas run a 4s linear gold sweep
   (`@keyframes scan`, `.scanline`). This plane runs the same sweep, the same
   duration, the same gradient, across the phone screen — so the 3D background
   and the 2D foreground read as one design language instead of two unrelated
   effects that happen to share a colour.

   The band is a single additive plane. Because it's additive it can never
   darken the screen underneath, only add gold, which keeps it from ever
   fighting the dossier text for contrast.
   ═══════════════════════════════════════════════════════════════════════════ */

/** matches `animation: scan 4s linear infinite` in app/globals.css */
const SWEEP_PERIOD = 4.0;
/** and `.panel-unsealing .scanline { animation-duration: 0.55s }` */
const SWEEP_PERIOD_FAST = 0.55;

const ScanMaterial = shaderMaterial(
  {
    uProgress: 0, // 0 = band at top edge, 1 = band past bottom edge
    uIntensity: 0,
    uWidth: 0.045, // band thickness in UV units
    uGold: new THREE.Color("#d9a94a"),
    uGoldBright: new THREE.Color("#f4c862"),
  },
  /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  /* glsl */ `
    precision highp float;
    varying vec2 vUv;

    uniform float uProgress;
    uniform float uIntensity;
    uniform float uWidth;
    uniform vec3  uGold;
    uniform vec3  uGoldBright;

    void main() {
      /* Travel from just above the top edge to just below the bottom, which
         is the 3D equivalent of the CSS keyframe's top: -8% → 108%. */
      float y = mix(1.08, -0.08, uProgress);

      /* Gaussian band — soft-edged, unlike a hard step, so it reads as light
         rather than as a drawn rule. */
      float d = (vUv.y - y) / uWidth;
      float band = exp(-d * d);

      /* Horizontal falloff reproduces the CSS gradient
         (transparent → gold → transparent). */
      float across = sin(vUv.x * 3.14159265);
      across = pow(clamp(across, 0.0, 1.0), 0.7);

      /* A brighter core inside the band gives it a filament, so at full
         intensity it clears the bloom threshold and blooms as a line. */
      float core = pow(band, 4.0);

      vec3 col = mix(uGold, uGoldBright, core);
      float a = band * across * uIntensity * 0.55 + core * across * uIntensity * 0.35;

      if (a < 0.003) discard;
      gl_FragColor = vec4(col, a);
      #include <colorspace_fragment>
    }
  `
);

type ScanMaterialImpl = THREE.ShaderMaterial & {
  uProgress: number;
  uIntensity: number;
  uWidth: number;
};

export interface ScanlineSweepProps {
  state: SceneState;
}

export default function ScanlineSweep({ state }: ScanlineSweepProps) {
  const matRef = useRef<ScanMaterialImpl | null>(null);
  /* Phase is integrated rather than derived from absolute time, so switching
     between the slow and fast periods never causes the band to jump. */
  const phase = useRef(0);

  const material = useMemo(() => {
    const m = new ScanMaterial() as unknown as ScanMaterialImpl;
    m.transparent = true;
    m.depthWrite = false;
    m.blending = THREE.AdditiveBlending;
    m.toneMapped = false;
    m.uniforms.uGold.value = new THREE.Color(TOKENS.gold);
    m.uniforms.uGoldBright.value = new THREE.Color(TOKENS.goldBright);
    matRef.current = m;
    return m;
  }, []);

  useFrame((_, rawDelta) => {
    const m = matRef.current;
    if (!m) return;
    const dt = Math.min(rawDelta, 1 / 20);

    /* Fast sweep during submit/assemble — mirrors how the dossier cards speed
       their scanline up while unsealing. */
    const fast = state.phase === "submitting" || state.phase === "assembling";
    const period = fast ? SWEEP_PERIOD_FAST : SWEEP_PERIOD;
    phase.current = (phase.current + dt / period) % 1;

    /* Only visible once the screen has some power behind it. */
    const intensity =
      state.power * (fast ? 1 : 0.45) * (state.phase === "idle-prompt" ? 0.35 : 1);

    m.uniforms.uProgress.value = phase.current;
    m.uniforms.uIntensity.value = intensity;
    m.uniforms.uWidth.value = fast ? 0.035 : 0.055;
  });

  return (
    <mesh position={[0, 0, 0.012]} material={material}>
      <planeGeometry args={[SCREEN.width, SCREEN.height]} />
    </mesh>
  );
}
