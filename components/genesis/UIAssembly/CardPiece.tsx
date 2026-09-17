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
   CardPiece — the workhorse. Used for cards, search bars, stat tiles and the
   large panels that drift OFF the phone (the "exploded UI" halo in the
   reference).

   Entrance: z-pop from behind the screen plane + fade.
   The card starts recessed *into* the phone and pushes forward through the
   glass, which is what sells it as being extruded out of the device rather
   than pasted on top of it.
   ═══════════════════════════════════════════════════════════════════════════ */

export default function CardPiece(props: PieceProps) {
  const { def, rect, seed } = props;
  const meshRef = useRef<THREE.Mesh>(null);

  const material = useMemo(
    () => makePieceMaterial(seed, rect.w / rect.h, def.accent ? 1 : 0, 0.022, 0.07),
    [seed, rect.w, rect.h, def.accent]
  );

  const drive = usePieceDrive(props, material);

  useFrame(() => {
    const m = meshRef.current;
    if (!m) return;

    const { enter, shatter, visible } = drive();
    m.visible = visible;
    if (!visible) return;

    /* ── Entrance: recessed → forward, with a fast settle ──────────────── */
    const e = ease.outQuint(enter);
    const popZ = (1 - e) * -0.17;

    if (def.float) {
      /* Floating halo panels drift outward from the phone and tip as they go.
         Their travel is longer and slower, so they read as a secondary layer
         rather than competing with the on-screen build. */
      const f = ease.outCubic(enter);
      m.position.set(
        rect.x + def.float.x * f,
        rect.y + def.float.y * f,
        rect.z + def.float.z * f + popZ * 0.4
      );
      m.rotation.set(
        def.float.rot * 0.45 * f,
        def.float.rot * f,
        def.float.rot * 0.22 * f
      );
      /* shatter pushes them further out as they break up */
      m.position.z += shatter * 0.35;
    } else {
      m.position.set(rect.x, rect.y, rect.z + popZ);
      m.rotation.set(0, 0, 0);
    }

    /* Scale settles from slightly small — avoids the "slide" look */
    const s = 0.9 + e * 0.1;
    m.scale.set(rect.w * s, rect.h * s, 1);
  });

  return (
    <mesh ref={meshRef} geometry={PIECE_GEOMETRY} material={material} visible={false} />
  );
}
