"use client";

import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";

import {
  PIECE_GEOMETRY,
  makePieceMaterial,
  usePieceDrive,
  type PieceProps,
} from "./shared";
import { ease } from "@/lib/genesisScene";

/* ═══════════════════════════════════════════════════════════════════════════
   NavBarPiece — top chrome and bottom tab bar.

   Entrance: scale-Y from 0 with an eased overshoot (outBack). It snaps open
   like a shutter, which is why it's the first thing to land in every
   archetype — it establishes the frame the rest of the UI builds inside.

   The bar also carries three small "tab" quads, so the bottom bar reads as a
   tab bar rather than a plain stripe. They use the same material, so they
   wireframe-to-solid along with their parent for free.
   ═══════════════════════════════════════════════════════════════════════════ */

export default function NavBarPiece(props: PieceProps) {
  const { rect, seed } = props;
  const groupRef = useRef<THREE.Group>(null);
  const barRef = useRef<THREE.Mesh>(null);

  const material = useMemo(
    () => makePieceMaterial(seed, rect.w / rect.h, 0, 0.018, 0.02),
    [seed, rect.w, rect.h]
  );

  /* Tabs get their own material so their border thickness stays proportional
     to their (much smaller) size instead of inheriting the bar's aspect. */
  const tabMaterial = useMemo(
    () => makePieceMaterial(seed + 3.7, 1.6, 1, 0.08, 0.18),
    [seed]
  );

  const drive = usePieceDrive(props, material);

  const TAB_XS = useMemo(() => [-0.3, 0, 0.3], []);

  useFrame(() => {
    const g = groupRef.current;
    const bar = barRef.current;
    if (!g || !bar) return;

    const { enter, solid, shatter, visible } = drive();
    g.visible = visible;
    if (!visible) return;

    /* Keep the tab material in lockstep with the bar's phase. */
    tabMaterial.uniforms.uTime.value = props.state.time;
    tabMaterial.uniforms.uEnter.value = ease.outCubic(Math.max(0, enter * 1.4 - 0.4));
    tabMaterial.uniforms.uSolid.value = solid;
    tabMaterial.uniforms.uShatter.value = shatter;
    tabMaterial.uniforms.uOpacity.value = props.state.uiOpacity;

    g.position.set(rect.x, rect.y, rect.z);

    /* Scale-Y from 0 with overshoot. X is eased separately and faster, so the
       bar widens a hair before it opens vertically — a small detail that
       reads as mechanical rather than as a uniform zoom. */
    const sy = ease.outBack(enter);
    const sx = 0.94 + ease.outQuint(enter) * 0.06;
    bar.scale.set(rect.w * sx, rect.h * Math.max(sy, 0.001), 1);
  });

  return (
    <group ref={groupRef} visible={false}>
      <mesh ref={barRef} geometry={PIECE_GEOMETRY} material={material} />

      {/* tab glyph stand-ins */}
      {TAB_XS.map((tx, i) => (
        <mesh
          key={i}
          geometry={PIECE_GEOMETRY}
          material={tabMaterial}
          position={[rect.w * tx, 0, 0.0004]}
          scale={[rect.h * 0.46, rect.h * 0.29, 1]}
        />
      ))}
    </group>
  );
}
