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
import { SCREEN, ease } from "@/lib/genesisScene";

/* ═══════════════════════════════════════════════════════════════════════════
   ListRowPiece — a feed/list row.

   Entrance: slides in from screen-left while fading up, then a thin gold
   underline draws itself left→right underneath. The underline is a separate
   quad whose X scale is the animation — a real draw, not a reveal mask.

   Each row also carries an avatar chip on the left, which is what makes a
   stack of rows read as a list of *people/items* rather than as stripes.
   ═══════════════════════════════════════════════════════════════════════════ */

export default function ListRowPiece(props: PieceProps) {
  const { def, rect, seed, state } = props;

  const groupRef = useRef<THREE.Group>(null);
  const rowRef = useRef<THREE.Mesh>(null);
  const ruleRef = useRef<THREE.Mesh>(null);

  const material = useMemo(
    () => makePieceMaterial(seed, rect.w / rect.h, def.accent ? 1 : 0, 0.02, 0.05),
    [seed, rect.w, rect.h, def.accent]
  );

  /* Avatar chip — square aspect, heavy corner radius so it reads as a circle */
  const avatarMaterial = useMemo(
    () => makePieceMaterial(seed + 9.1, 1, 1, 0.1, 0.5),
    [seed]
  );

  /* The underline is drawn with a plain basic material: it's a pure gold
     stroke, and running it through the wireframe/solid shader would only
     dilute it. It is also the brightest thing on a row, so it is one of the
     few elements intended to catch the bloom pass. */
  const ruleMaterial = useMemo(() => {
    const m = new THREE.MeshBasicMaterial({
      color: "#f4c862",
      transparent: true,
      opacity: 0,
      depthWrite: false,
      toneMapped: false,
    });
    return m;
  }, []);

  const drive = usePieceDrive(props, material);

  useFrame(() => {
    const g = groupRef.current;
    const row = rowRef.current;
    const rule = ruleRef.current;
    if (!g || !row || !rule) return;

    const { enter, solid, shatter, visible } = drive();
    g.visible = visible;
    if (!visible) return;

    avatarMaterial.uniforms.uTime.value = state.time;
    avatarMaterial.uniforms.uEnter.value = ease.outCubic(Math.max(0, enter * 1.5 - 0.5));
    avatarMaterial.uniforms.uSolid.value = solid;
    avatarMaterial.uniforms.uShatter.value = shatter;
    avatarMaterial.uniforms.uOpacity.value = state.uiOpacity;

    /* ── Slide in from screen-left ─────────────────────────────────────── */
    const e = ease.outQuint(enter);
    const slide = (1 - e) * -SCREEN.width * 0.42;
    g.position.set(rect.x + slide, rect.y, rect.z);

    row.scale.set(rect.w, rect.h, 1);

    /* ── Underline draws itself once the row has landed ─────────────────
       Starts at 60% of the entrance so the stroke chases the row in. */
    const draw = ease.outExpo(Math.max(0, (enter - 0.6) / 0.4));
    rule.scale.set(Math.max(rect.w * draw, 0.0001), rect.h * 0.035, 1);
    /* scale grows from the left edge, so shift the centre accordingly */
    rule.position.x = -rect.w / 2 + (rect.w * draw) / 2;
    ruleMaterial.opacity = draw * 0.85 * state.uiOpacity * (1 - shatter);
  });

  return (
    <group ref={groupRef} visible={false}>
      <mesh ref={rowRef} geometry={PIECE_GEOMETRY} material={material} />

      {/* avatar chip */}
      <mesh
        geometry={PIECE_GEOMETRY}
        material={avatarMaterial}
        position={[-rect.w / 2 + rect.h * 0.46, 0, 0.0005]}
        scale={[rect.h * 0.62, rect.h * 0.62, 1]}
      />

      {/* self-drawing gold underline */}
      <mesh ref={ruleRef} position={[0, -rect.h / 2, 0.0008]} material={ruleMaterial}>
        <planeGeometry args={[1, 1]} />
      </mesh>
    </group>
  );
}
