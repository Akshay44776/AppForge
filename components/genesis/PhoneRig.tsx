"use client";

import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { RoundedBox } from "@react-three/drei";

import {
  PHONE,
  SCREEN,
  TOKENS,
  type SceneState,
} from "@/lib/genesisScene";
import {
  ChassisMaterial,
  GlassMaterial,
  type ChassisMaterialImpl,
  type GlassMaterialImpl,
} from "./materials/glassMaterial";

/* ═══════════════════════════════════════════════════════════════════════════
   PhoneRig — chassis + screen plane + the idle motion of the whole object.

   The phone never uses a default material. The body is ChassisMaterial
   (brushed metal, fresnel rim, noise grain) and the screen is GlassMaterial
   (smoked glass, power glow, shatter lattice, specular streak).

   Idle rotation is deliberately NOT a raw sine wobble. It's a 3-octave value
   noise sampled over time, then critically damped toward — the result drifts
   the way a physical object hanging in a field would, with no detectable
   period. The video reference reads as "floating in space", not "oscillating".
   ═══════════════════════════════════════════════════════════════════════════ */

/* ── 1D value noise, smooth and periodless at the timescales we sample ───── */
function hash1(n: number) {
  const s = Math.sin(n * 127.1) * 43758.5453;
  return s - Math.floor(s);
}
function noise1(x: number) {
  const i = Math.floor(x);
  const f = x - i;
  const u = f * f * (3 - 2 * f);
  return hash1(i) * (1 - u) + hash1(i + 1) * u;
}
/** fBm: 3 octaves, halving amplitude — gives slow drift + small jitter */
function fbm(x: number) {
  return noise1(x) * 0.6 + noise1(x * 2.13 + 11.3) * 0.28 + noise1(x * 4.7 + 41.7) * 0.12;
}

/** critically-damped spring step — frame-rate independent */
function damp(current: number, target: number, lambda: number, dt: number) {
  return current + (target - current) * (1 - Math.exp(-lambda * dt));
}

export interface PhoneRigProps {
  state: SceneState;
  children?: React.ReactNode;
}

export default function PhoneRig({ state, children }: PhoneRigProps) {
  const groupRef = useRef<THREE.Group>(null);
  const chassisMatRef = useRef<ChassisMaterialImpl>(null);
  const glassMatRef = useRef<GlassMaterialImpl>(null);

  /* Materials are instantiated once and attached via <primitive>, which keeps
     us clear of JSX intrinsic-element augmentation entirely. */
  const chassisMat = useMemo(() => {
    const m = new ChassisMaterial() as unknown as ChassisMaterialImpl;
    m.transparent = true;
    m.uniforms.uGold.value = new THREE.Color(TOKENS.gold);
    m.uniforms.uInk.value = new THREE.Color(TOKENS.ink);
    m.uniforms.uSurface.value = new THREE.Color(TOKENS.surface);
    m.uniforms.uMuted.value = new THREE.Color(TOKENS.muted);
    chassisMatRef.current = m;
    return m;
  }, []);

  const glassMat = useMemo(() => {
    const m = new GlassMaterial() as unknown as GlassMaterialImpl;
    m.transparent = true;
    m.depthWrite = false;
    m.uniforms.uGold.value = new THREE.Color(TOKENS.gold);
    m.uniforms.uGoldBright.value = new THREE.Color(TOKENS.goldBright);
    m.uniforms.uInk.value = new THREE.Color(TOKENS.ink);
    m.uniforms.uSurface.value = new THREE.Color(TOKENS.surface);
    glassMatRef.current = m;
    return m;
  }, []);

  /* Base pose: the phone lies back and to the side, matching the reference
     framing — long edge running lower-left to upper-right, face tipped toward
     camera just enough to read the screen. */
  const BASE_ROT = useMemo(() => new THREE.Euler(-0.92, 0.42, -0.34), []);

  const rot = useRef({ x: BASE_ROT.x, y: BASE_ROT.y, z: BASE_ROT.z, py: 0 });

  useFrame((_, rawDelta) => {
    const dt = Math.min(rawDelta, 1 / 20); // clamp so tab-switches don't jump
    const t = state.time;

    /* ── Idle drift targets from fBm, not sine ─────────────────────────── */
    const nx = (fbm(t * 0.11) - 0.5) * 2;
    const ny = (fbm(t * 0.087 + 31.7) - 0.5) * 2;
    const nz = (fbm(t * 0.065 + 77.1) - 0.5) * 2;
    const nb = (fbm(t * 0.09 + 5.5) - 0.5) * 2;

    /* Pointer parallax leans the phone very slightly toward the cursor. */
    const targetX = BASE_ROT.x + nx * 0.055 + state.mouseY * 0.05;
    const targetY = BASE_ROT.y + ny * 0.085 + state.mouseX * 0.09;
    const targetZ = BASE_ROT.z + nz * 0.04;
    const targetPY = nb * 0.055; // vertical bob

    rot.current.x = damp(rot.current.x, targetX, 1.6, dt);
    rot.current.y = damp(rot.current.y, targetY, 1.4, dt);
    rot.current.z = damp(rot.current.z, targetZ, 1.2, dt);
    rot.current.py = damp(rot.current.py, targetPY, 1.1, dt);

    const g = groupRef.current;
    if (g) {
      g.rotation.set(rot.current.x, rot.current.y, rot.current.z);
      g.position.y = rot.current.py;
      /* Micro "breathing" during hold — an eased base with a tiny additive
         sine, never sine as the primary driver. */
      const breathe =
        state.phase === "holding" ? 1 + Math.sin(t * 2.1) * 0.006 : 1;
      g.scale.setScalar(breathe);
    }

    /* ── Push drive signals into the shaders ───────────────────────────── */
    const cm = chassisMatRef.current;
    if (cm) cm.uniforms.uTime.value = t;

    const gm = glassMatRef.current;
    if (gm) {
      gm.uniforms.uTime.value = t;
      gm.uniforms.uPower.value = state.power;
      gm.uniforms.uFlash.value = state.flash;
      gm.uniforms.uShatter.value = state.shatter;
    }
  });

  return (
    <group ref={groupRef}>
      {/* ── Chassis ──────────────────────────────────────────────────────
          RoundedBox gives us a machined edge with real bevel normals, which
          is what the fresnel term in ChassisMaterial needs to read correctly.
          A plain BoxGeometry would have hard 90° normals and the rim light
          would look painted on. */}
      <RoundedBox
        args={[PHONE.width, PHONE.height, PHONE.depth]}
        radius={PHONE.radius}
        smoothness={5}
        bevelSegments={4}
        creaseAngle={0.5}
        material={chassisMat}
      />

      {/* ── Side detail: volume rocker + power key ────────────────────────
          Three tiny extrusions. They cost nothing and they are the difference
          between "a phone" and "a rounded box". */}
      <group>
        <mesh position={[-PHONE.width / 2 - 0.004, 0.42, 0]} material={chassisMat}>
          <boxGeometry args={[0.014, 0.17, 0.05]} />
        </mesh>
        <mesh position={[-PHONE.width / 2 - 0.004, 0.21, 0]} material={chassisMat}>
          <boxGeometry args={[0.014, 0.17, 0.05]} />
        </mesh>
        <mesh position={[PHONE.width / 2 + 0.004, 0.33, 0]} material={chassisMat}>
          <boxGeometry args={[0.014, 0.24, 0.05]} />
        </mesh>
      </group>

      {/* ── Screen glass ─────────────────────────────────────────────────
          Floats just in front of the chassis face. depthWrite is off so the
          UI pieces layered on top of it composite cleanly. */}
      <mesh position={[0, 0, PHONE.screenZ]} material={glassMat}>
        <planeGeometry args={[SCREEN.width, SCREEN.height, 1, 1]} />
      </mesh>

      {/* ── Notch / camera island ────────────────────────────────────────── */}
      <mesh position={[0, PHONE.height / 2 - 0.115, PHONE.screenZ + 0.001]}>
        <planeGeometry args={[0.24, 0.048]} />
        <meshBasicMaterial color={TOKENS.ink} transparent opacity={0.92} />
      </mesh>

      {/* UI assembly + scanline mount onto the screen plane */}
      <group position={[0, 0, PHONE.screenZ + 0.004]}>{children}</group>
    </group>
  );
}
