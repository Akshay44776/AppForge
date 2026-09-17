"use client";

import { useRef } from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";

import { CAMERA, type SceneState } from "@/lib/genesisScene";

/* ═══════════════════════════════════════════════════════════════════════════
   CameraRig — scroll-linked parallax, deliberately almost imperceptible.

   Three inputs, blended:
     • scroll   — #tracks' progress through the viewport, mapped to a small
                  dolly + vertical pan. The scene opens slightly further away
                  and higher, and settles closer and level as the section
                  centres. This is NOT scroll-jacking: total travel is ~0.55
                  world units over an entire section's worth of scrolling.
     • pointer  — a very small lateral/vertical offset toward the cursor.
     • idle     — a slow eased orbit so the scene is alive even if the page
                  is completely still.

   Everything is critically damped toward its target, so a fast scroll can
   never snap the camera; it always glides.
   ═══════════════════════════════════════════════════════════════════════════ */

function damp(current: number, target: number, lambda: number, dt: number) {
  return current + (target - current) * (1 - Math.exp(-lambda * dt));
}

export interface CameraRigProps {
  state: SceneState;
}

export default function CameraRig({ state }: CameraRigProps) {
  const { camera, size } = useThree();

  const pos = useRef(new THREE.Vector3(...CAMERA.base));
  const look = useRef(new THREE.Vector3(...CAMERA.lookAt));
  const target = useRef(new THREE.Vector3());

  useFrame((_, rawDelta) => {
    const dt = Math.min(rawDelta, 1 / 20);

    /* ── Responsive framing ───────────────────────────────────────────────
       The canvas is now a TALL, NARROW side panel rather than a full-bleed
       background, so aspect sits well below 1 and the horizontal field of
       view is the binding constraint. Pull back proportionally to how narrow
       the panel is, otherwise the phone and its drifting halo panels get
       clipped at the left and right edges. Derived from aspect rather than a
       breakpoint so it stays continuous while the window is dragged. */
    const aspect = size.width / Math.max(size.height, 1);
    const distanceBoost = aspect < 1.2 ? (1.2 - aspect) * 2.2 : 0;

    /* ── Scroll term ──────────────────────────────────────────────────────
       state.scroll is 0 as #tracks enters from below, 1 as it leaves above.
       Centred at 0.5 so the "settled" framing is mid-section. */
    const s = (state.scroll - 0.5) * 2; // -1 .. 1

    const tx =
      CAMERA.base[0] + s * CAMERA.pan * 0.35 + state.mouseX * CAMERA.mouse;
    const ty =
      CAMERA.base[1] - s * CAMERA.pan + state.mouseY * CAMERA.mouse * 0.6;
    const tz =
      CAMERA.base[2] + Math.abs(s) * CAMERA.dolly + distanceBoost;

    /* ── Idle drift ───────────────────────────────────────────────────────
       An eased Lissajous at very low frequency — the two rates are
       incommensurable so the path never visibly repeats. */
    const t = state.time;
    const idleX = Math.sin(t * 0.081) * 0.09 + Math.sin(t * 0.137) * 0.035;
    const idleY = Math.sin(t * 0.063 + 1.7) * 0.06;

    target.current.set(tx + idleX, ty + idleY, tz);

    pos.current.x = damp(pos.current.x, target.current.x, 2.2, dt);
    pos.current.y = damp(pos.current.y, target.current.y, 2.2, dt);
    pos.current.z = damp(pos.current.z, target.current.z, 1.8, dt);
    camera.position.copy(pos.current);

    /* Look target leans slightly opposite the pan, which keeps the phone
       roughly centred in frame while still letting the camera move. */
    look.current.x = damp(look.current.x, CAMERA.lookAt[0] - s * 0.06, 2.0, dt);
    look.current.y = damp(look.current.y, CAMERA.lookAt[1] + s * 0.10, 2.0, dt);
    look.current.z = CAMERA.lookAt[2];
    camera.lookAt(look.current);

    camera.updateProjectionMatrix();
  });

  return null;
}
