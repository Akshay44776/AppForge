"use client";

import { useMemo, useRef } from "react";
import type * as THREE from "three";
import { useFrame } from "@react-three/fiber";

import { ARCHETYPES, type SceneState } from "@/lib/genesisScene";

import CardPiece from "./CardPiece";
import ChartPiece from "./ChartPiece";
import ListRowPiece from "./ListRowPiece";
import NavBarPiece from "./NavBarPiece";
import { toRect } from "./shared";

/* ═══════════════════════════════════════════════════════════════════════════
   UIAssembly — turns archetype DATA into the animated 3D UI.

   Key structural decision: ALL THREE ARCHETYPES ARE MOUNTED AT ONCE and the
   inactive ones are simply hidden. Mounting/unmounting per cycle would mean
   compiling shaders and allocating geometry mid-animation — exactly when a
   frame drop is most visible. Instead every piece exists from first paint and
   gates itself on `state.archetype`.

   The whole layer is ~35 quads sharing one geometry, so keeping them all
   resident costs far less than the churn would.
   ═══════════════════════════════════════════════════════════════════════════ */

export interface UIAssemblyProps {
  state: SceneState;
}

/** Deterministic per-piece seed so a given piece always fractures the same way. */
function seedFor(archetypeIdx: number, pieceIdx: number) {
  return (archetypeIdx * 131 + pieceIdx * 37.7) % 100;
}

/* ─────────────────────────────────────────────────────────────────────────
   ArchetypeLayer — all the pieces of one archetype.
   ───────────────────────────────────────────────────────────────────────── */
function ArchetypeLayer({ index, state }: { index: number; state: SceneState }) {
  const archetype = ARCHETYPES[index];

  /* Rects are pure geometry — computed once, never per frame. */
  const rects = useMemo(
    () => archetype.pieces.map((def, i) => toRect(def, i)),
    [archetype]
  );

  return (
    <group name={`archetype-${archetype.id}`}>
      {archetype.pieces.map((def, i) => {
        const common = {
          def,
          rect: rects[i],
          seed: seedFor(index, i),
          state,
        };
        const key = `${archetype.id}-${i}`;

        switch (def.kind) {
          case "nav":
            return <NavBarPiece key={key} {...common} />;
          case "row":
            return <ListRowPiece key={key} {...common} />;
          case "chart":
            return <ChartPiece key={key} {...common} />;
          /* pills and FABs are cards with different proportions and radii —
             a separate component would duplicate CardPiece for no
             behavioural difference. */
          case "pill":
          case "fab":
          case "card":
          default:
            return <CardPiece key={key} {...common} />;
        }
      })}
    </group>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   ArchetypeGate — a one-line useFrame that toggles a whole archetype.
   Split out so this cheap check isn't tangled up with the per-piece work.
   ───────────────────────────────────────────────────────────────────────── */
function ArchetypeGate({ index, state }: { index: number; state: SceneState }) {
  const ref = useRef<THREE.Group>(null);

  useFrame(() => {
    const g = ref.current;
    if (!g) return;
    /* Only the archetype for the current cycle renders. During `dissolving`
       the outgoing archetype stays visible until its shards have faded — that
       works out automatically, because state.archetype only advances when the
       cycle counter rolls over at the very end of the dissolve. */
    g.visible = state.archetype === index && state.uiOpacity > 0.001;
  });

  return (
    <group ref={ref} visible={false}>
      <ArchetypeLayer index={index} state={state} />
    </group>
  );
}

export default function UIAssembly({ state }: UIAssemblyProps) {
  return (
    <group>
      {ARCHETYPES.map((a, i) => (
        <ArchetypeGate key={a.id} index={i} state={state} />
      ))}
    </group>
  );
}
