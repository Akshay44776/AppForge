"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useEffect, useMemo, useRef, useState } from "react";

function Field({ count }: { count: number }) {
  const pointsRef = useRef<THREE.Points>(null);
  const linesRef = useRef<THREE.LineSegments>(null);
  const mouse = useRef(new THREE.Vector2(999, 999));

  const { base, seeds } = useMemo(() => {
    const b = new Float32Array(count * 3);
    const s = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      b[i * 3] = (Math.random() - 0.5) * 13;
      b[i * 3 + 1] = (Math.random() - 0.5) * 7.5;
      b[i * 3 + 2] = (Math.random() - 0.5) * 5;
      s[i * 3] = Math.random() * Math.PI * 2;
      s[i * 3 + 1] = Math.random() * Math.PI * 2;
      s[i * 3 + 2] = 0.5 + Math.random();
    }
    return { base: b, seeds: s };
  }, [count]);

  const pointGeom = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(count * 3), 3));
    return g;
  }, [count]);

  const maxPairs = (count * (count - 1)) / 2;
  const lineGeom = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(maxPairs * 6), 3));
    return g;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [count]);

  useEffect(() => {
    const fine = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
    if (!fine) return;
    const onMove = (e: PointerEvent) => {
      mouse.current.set((e.clientX / window.innerWidth) * 13 - 6.5,
                        -((e.clientY / window.innerHeight) * 7.5 - 3.75));
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => window.removeEventListener("pointermove", onMove);
  }, []);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    const pa = pointGeom.attributes.position as THREE.BufferAttribute;
    const arr = pa.array as Float32Array;
    const mp = mouse.current;
    for (let i = 0; i < count; i++) {
      let x = base[i * 3] + Math.sin(t * 0.18 * seeds[i * 3 + 2] + seeds[i * 3]) * 0.55;
      let y = base[i * 3 + 1] + Math.cos(t * 0.15 * seeds[i * 3 + 2] + seeds[i * 3 + 1]) * 0.45;
      const dx = x - mp.x, dy = y - mp.y;
      const d2 = dx * dx + dy * dy;
      if (d2 < 2.25 && d2 > 0.0001) { // 1.5 world-unit (~150px) repel radius
        const d = Math.sqrt(d2);
        const f = (1.5 - d) / d;
        x += dx * f * 0.35; y += dy * f * 0.35;
      }
      arr[i * 3] = x; arr[i * 3 + 1] = y; arr[i * 3 + 2] = base[i * 3 + 2];
    }
    pa.needsUpdate = true;

    const la = lineGeom.attributes.position as THREE.BufferAttribute;
    const larr = la.array as Float32Array;
    const THRESH = 2.1, THRESH2 = THRESH * THRESH;
    let seg = 0;
    for (let i = 0; i < count; i++) {
      for (let j = i + 1; j < count; j++) {
        const dx = arr[i * 3] - arr[j * 3];
        const dy = arr[i * 3 + 1] - arr[j * 3 + 1];
        const dz = arr[i * 3 + 2] - arr[j * 3 + 2];
        if (dx * dx + dy * dy + dz * dz < THRESH2) {
          const o = seg * 6;
          larr[o] = arr[i * 3]; larr[o + 1] = arr[i * 3 + 1]; larr[o + 2] = arr[i * 3 + 2];
          larr[o + 3] = arr[j * 3]; larr[o + 4] = arr[j * 3 + 1]; larr[o + 5] = arr[j * 3 + 2];
          seg += 1;
        }
      }
    }
    lineGeom.setDrawRange(0, seg * 2);
    la.needsUpdate = true;
  });

  return (
    <group>
      <points ref={pointsRef} geometry={pointGeom}>
        <pointsMaterial size={0.07} color="#d9a94a" transparent opacity={0.9} sizeAttenuation depthWrite={false} />
      </points>
      <lineSegments ref={linesRef} geometry={lineGeom} frustumCulled={false}>
        <lineBasicMaterial color="#d9a94a" transparent opacity={0.22} depthWrite={false} />
      </lineSegments>
    </group>
  );
}

export default function NetworkFieldCanvas() {
  const [count, setCount] = useState(120);
  const [active, setActive] = useState(true);
  const [visible, setVisible] = useState(true);
  const holder = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setCount(window.matchMedia("(max-width: 640px)").matches ? 40 : 120);
    const io = new IntersectionObserver((es) => setVisible(es[0].isIntersecting), { rootMargin: "100px" });
    if (holder.current) io.observe(holder.current);
    const onVis = () => setActive(!document.hidden);
    document.addEventListener("visibilitychange", onVis);
    return () => { io.disconnect(); document.removeEventListener("visibilitychange", onVis); };
  }, []);

  if (!visible || !active) return <div ref={holder} className="absolute inset-0 network-fallback" aria-hidden />;
  return (
    <div ref={holder} className="absolute inset-0" aria-hidden>
      <Canvas dpr={0.75} camera={{ position: [0, 0, 8], fov: 55 }} gl={{ antialias: false, alpha: true }}>
        <Field count={count} />
      </Canvas>
    </div>
  );
}
