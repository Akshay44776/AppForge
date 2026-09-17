"use client";

import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";

import {
  PARTICLES,
  SCREEN,
  TOKENS,
  type SceneState,
} from "@/lib/genesisScene";
import {
  ParticleGlowMaterial,
  type ParticleGlowMaterialImpl,
} from "./materials/particleGlowMaterial";

/* ═══════════════════════════════════════════════════════════════════════════
   ParticleField — one InstancedMesh, two behaviours.

   During `assembling` it is the data rain: motes streaming down out of the
   dark and converging into the screen plane, so the UI reads as condensing
   out of raw data. During `dissolving` the same instances become the shatter
   debris flung back out of the screen.

   Nothing about instance placement is computed in JS per frame. Every
   instance carries two static attributes (aSeed, aOrigin) uploaded once at
   mount, and the vertex shader in particleGlowMaterial.ts derives position,
   rotation, scale, colour and alpha from those plus the clock. The per-frame
   JS cost of the entire field is four uniform writes.
   ═══════════════════════════════════════════════════════════════════════════ */

export interface ParticleFieldProps {
  state: SceneState;
  /** device tier chosen by GenesisBackground; drives the instance budget */
  tier: "high" | "mid" | "low";
}

export default function ParticleField({ state, tier }: ParticleFieldProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const matRef = useRef<ParticleGlowMaterialImpl | null>(null);

  const count =
    tier === "high"
      ? PARTICLES.countHigh
      : tier === "mid"
      ? PARTICLES.countMid
      : PARTICLES.countLow;

  /* ── Shard geometry ────────────────────────────────────────────────────
     A flat quad, not a box. Boxes at this size render as grey mush; flat
     shards catch the light like the metallic flecks in the reference and
     cost a quarter of the vertices. The material tumbles them in 3D, so the
     flatness reads as glinting rather than as billboards. */
  const geometry = useMemo(() => {
    const base = new THREE.PlaneGeometry(1, 1.9);
    const geo = new THREE.InstancedBufferGeometry();
    geo.index = base.index;
    /* setAttribute rather than assigning to geo.attributes directly, so three's
       internal bookkeeping (version counters, VAO invalidation) stays correct.
       The source geometry is NOT disposed: these buffers are now shared with
       it, and disposing would signal three to release them. */
    geo.setAttribute("position", base.attributes.position);
    geo.setAttribute("uv", base.attributes.uv);
    geo.setAttribute("normal", base.attributes.normal);

    /* ── Static per-instance attributes ──────────────────────────────────
       Built here, inside the same useMemo, so the geometry is COMPLETE the
       moment it is handed to the mesh. Populating them in a useEffect would
       leave one frame where the shader reads missing attributes.

       aOrigin is where the mote lands / launches from: a point scattered over
       the screen plane, biased toward the centre so the stream reads as a
       column rather than a curtain. */
    const seeds = new Float32Array(count * 3);
    const origins = new Float32Array(count * 3);

    for (let i = 0; i < count; i++) {
      seeds[i * 3 + 0] = Math.random();
      seeds[i * 3 + 1] = Math.random();
      seeds[i * 3 + 2] = Math.random();

      /* Centre-biased scatter: cubing a signed uniform pulls samples inward
         while still letting a few reach the edges. */
      const bx = Math.pow(Math.random() * 2 - 1, 3);
      const by = Math.random() * 2 - 1;

      origins[i * 3 + 0] = bx * SCREEN.width * 0.52;
      origins[i * 3 + 1] = by * SCREEN.height * 0.48;
      origins[i * 3 + 2] = (Math.random() - 0.5) * 0.09;
    }

    geo.setAttribute("aSeed", new THREE.InstancedBufferAttribute(seeds, 3));
    geo.setAttribute("aOrigin", new THREE.InstancedBufferAttribute(origins, 3));

    geo.instanceCount = count;
    return geo;
  }, [count]);

  useEffect(() => () => geometry.dispose(), [geometry]);

  const material = useMemo(() => {
    const m = new ParticleGlowMaterial() as unknown as ParticleGlowMaterialImpl;
    m.transparent = true;
    m.depthWrite = false;
    /* Additive blending is what makes overlapping motes build into the bright
       column seen in the reference, rather than flatly occluding each other. */
    m.blending = THREE.AdditiveBlending;
    m.side = THREE.DoubleSide;
    m.toneMapped = false;

    m.uniforms.uGold.value = new THREE.Color(TOKENS.gold);
    m.uniforms.uGoldBright.value = new THREE.Color(TOKENS.goldBright);
    m.uniforms.uMuted.value = new THREE.Color(TOKENS.muted);
    m.uniforms.uRainHeight.value = PARTICLES.rainHeight;
    m.uniforms.uDebrisRadius.value = PARTICLES.debrisRadius;

    matRef.current = m;
    return m;
  }, []);

  useFrame(() => {
    const m = matRef.current;
    const mesh = meshRef.current;
    if (!m || !mesh) return;

    m.uniforms.uTime.value = state.time;
    m.uniforms.uRain.value = state.rain;
    m.uniforms.uDebris.value = state.debris;
    /* Quality degradation shrinks the motes rather than changing the count —
       resizing an instance buffer mid-animation would stall the GPU. */
    m.uniforms.uScale.value = state.quality;
    m.uniforms.uOpacity.value = 1;

    /* Skip the draw entirely when neither behaviour is active. */
    mesh.visible = state.rain > 0.002 || state.debris > 0.002;
  });

  /* A plain <mesh> carrying an InstancedBufferGeometry — NOT an <instancedMesh>.
     three renders any geometry flagged isInstancedBufferGeometry through
     renderInstances(), so we get instancing without InstancedMesh's
     instanceMatrix buffer, which this shader never reads and which would
     otherwise be 45KB of zeroes uploaded for nothing. */
  return (
    <mesh
      ref={meshRef}
      geometry={geometry}
      material={material}
      frustumCulled={false}
      visible={false}
    />
  );
}
