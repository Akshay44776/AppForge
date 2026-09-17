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
   ChartPiece — the panel that sells "dashboard".

   Three layered animations, deliberately sequenced:
     1. the panel pops in (same wireframe→solid treatment as a card),
     2. the sparkline STROKE DRAWS ITSELF via geometry.setDrawRange — a real
        progressive draw, vertex by vertex, not a mask sliding over a
        finished line,
     3. once the stroke is most of the way across, 4 data points pop in along
        it, staggered, with an eased overshoot.

   The curve is built once at a fixed resolution and the draw range walks it,
   so there is no per-frame buffer rewrite.
   ═══════════════════════════════════════════════════════════════════════════ */

/** resolution of the sparkline — enough that the draw reads as continuous */
const SEGMENTS = 96;

/** the shape of the data: 6 control points, smoothed with a Catmull-Rom */
const CONTROL: [number, number][] = [
  [0.0, -0.18],
  [0.2, 0.1],
  [0.38, -0.05],
  [0.58, 0.26],
  [0.78, 0.08],
  [1.0, 0.3],
];

/** where along the curve the data points sit */
const DOT_U = [0.18, 0.42, 0.66, 0.92];

export default function ChartPiece(props: PieceProps) {
  const { def, rect, seed, state } = props;

  const groupRef = useRef<THREE.Group>(null);
  const panelRef = useRef<THREE.Mesh>(null);
  const dotsRef = useRef<THREE.Group>(null);

  const material = useMemo(
    () => makePieceMaterial(seed, rect.w / rect.h, def.accent ? 1 : 0, 0.02, 0.06),
    [seed, rect.w, rect.h, def.accent]
  );

  /* ── Build the smoothed sparkline once ───────────────────────────────── */
  const { lineObject, lineGeometry, lineMaterial, dotPositions } = useMemo(() => {
    const curve = new THREE.CatmullRomCurve3(
      CONTROL.map(([x, y]) => new THREE.Vector3(x - 0.5, y, 0)),
      false,
      "catmullrom",
      0.4
    );

    const pts = curve.getPoints(SEGMENTS);
    const geo = new THREE.BufferGeometry().setFromPoints(pts);
    geo.setDrawRange(0, 0); // nothing drawn until the animation starts

    const mat = new THREE.LineBasicMaterial({
      color: "#f4c862",
      transparent: true,
      opacity: 0,
      depthWrite: false,
      toneMapped: false,
    });

    /* Constructed imperatively and mounted via <primitive>: R3F's `line`
       intrinsic collides with the SVG `line` element in TSX, and this avoids
       the whole problem. */
    const obj = new THREE.Line(geo, mat);
    obj.frustumCulled = false;

    const dots = DOT_U.map((u) => curve.getPointAt(u));

    return { lineObject: obj, lineGeometry: geo, lineMaterial: mat, dotPositions: dots };
  }, []);

  const dotMaterial = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: "#f4c862",
        transparent: true,
        opacity: 0,
        depthWrite: false,
        toneMapped: false,
      }),
    []
  );

  const drive = usePieceDrive(props, material);

  useFrame(() => {
    const g = groupRef.current;
    const panel = panelRef.current;
    const dots = dotsRef.current;
    if (!g || !panel || !dots) return;

    const { enter, shatter, visible } = drive();
    g.visible = visible;
    if (!visible) return;

    const e = ease.outQuint(enter);

    /* ── Panel placement ───────────────────────────────────────────────── */
    if (def.float) {
      const f = ease.outCubic(enter);
      g.position.set(
        rect.x + def.float.x * f,
        rect.y + def.float.y * f,
        rect.z + def.float.z * f + shatter * 0.35
      );
      g.rotation.set(
        def.float.rot * 0.45 * f,
        def.float.rot * f,
        def.float.rot * 0.22 * f
      );
    } else {
      g.position.set(rect.x, rect.y, rect.z + (1 - e) * -0.15);
      g.rotation.set(0, 0, 0);
    }
    panel.scale.set(rect.w * (0.9 + e * 0.1), rect.h * (0.9 + e * 0.1), 1);

    /* ── Stroke draw-range ────────────────────────────────────────────────
       Begins at 35% of the entrance, so the panel exists before the data
       lands in it. inOutCubic gives the pen a natural accelerate/settle
       rather than a constant-speed sweep. */
    const drawT = ease.inOutCubic(Math.max(0, (enter - 0.35) / 0.65));
    lineGeometry.setDrawRange(0, Math.max(2, Math.floor(drawT * (SEGMENTS + 1))));
    lineMaterial.opacity =
      Math.min(drawT * 2, 1) * 0.95 * state.uiOpacity * (1 - shatter);

    const sx = rect.w * 0.82;
    const sy = rect.h * 0.62;
    lineObject.scale.set(sx, sy, 1);
    lineObject.position.set(0, -rect.h * 0.04, 0.0012);

    /* ── Data points ──────────────────────────────────────────────────────
       Positioned in the panel's own space (not parented to the scaled line)
       so they stay perfectly round regardless of the panel's aspect. */
    for (let i = 0; i < dots.children.length; i++) {
      const child = dots.children[i] as THREE.Mesh;
      const p = dotPositions[i];

      const appear = ease.outBack(
        Math.max(0, Math.min(1, (drawT - 0.5 - i * 0.09) / 0.3))
      );
      child.visible = appear > 0.02;
      if (!child.visible) continue;

      child.position.set(p.x * sx, p.y * sy - rect.h * 0.04, 0.0016);
      const s = appear * 0.016;
      child.scale.set(s, s, 1);
    }
    dotMaterial.opacity =
      Math.max(0, Math.min(1, (drawT - 0.5) / 0.3)) * state.uiOpacity * (1 - shatter);

    material.uniforms.uTime.value = state.time;
  });

  return (
    <group ref={groupRef} visible={false}>
      <mesh ref={panelRef} geometry={PIECE_GEOMETRY} material={material} />

      {/* self-drawing sparkline */}
      <primitive object={lineObject} />

      {/* data points */}
      <group ref={dotsRef}>
        {dotPositions.map((_, i) => (
          <mesh key={i} visible={false} material={dotMaterial}>
            <circleGeometry args={[1, 14]} />
          </mesh>
        ))}
      </group>
    </group>
  );
}
