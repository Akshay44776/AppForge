"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { Canvas, useFrame } from "@react-three/fiber";
import { RoundedBox } from "@react-three/drei";

/* ═══════════════════════════════════════════════════════════════════════════
   HoverPhoneReveal — single shared overlay that shows a rotating wireframe
   phone above the card grid when a domain card is hovered/focused/tapped.

   Architecture:
     - ONE instance rendered in Tracks, NOT one per card.
     - Receives `activeCard` index (0/1/2 or null) and `cardRects` array.
     - Positions itself above the active card using absolute positioning.
     - R3F Canvas for the wireframe phone (already a project dependency).
     - SVG converging light streams layered above background.
     - Debounced: rapid hover changes don't stack animations.
     - Touch: toggles on tap. Keyboard: focus-visible triggers.
     - prefers-reduced-motion: disabled entirely.
     - Mobile (<768px): simple fade/scale, no 3D rotation.

   Cleanup:
     - Canvas/WebGL context disposed on unmount via R3F's built-in cleanup.
     - All timers cleaned up.
   ═══════════════════════════════════════════════════════════════════════════ */

const GOLD_HEX = "#d9a94a";
const GOLD_BRIGHT_HEX = "#f4c862";

interface HoverPhoneRevealProps {
  activeCard: number | null;
  /** Bounding rect info for positioning the overlay above the active card */
  cardRefs: React.RefObject<(HTMLDivElement | null)[]>;
  containerRef: React.RefObject<HTMLDivElement | null>;
}

export default function HoverPhoneReveal({
  activeCard,
  cardRefs,
  containerRef,
}: HoverPhoneRevealProps) {
  const [show, setShow] = useState(false);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const [reducedMotion, setReducedMotion] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mql.matches);
    setIsMobile(window.innerWidth < 768);
    const onMotion = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    const onResize = () => setIsMobile(window.innerWidth < 768);
    mql.addEventListener("change", onMotion);
    window.addEventListener("resize", onResize, { passive: true });
    return () => {
      mql.removeEventListener("change", onMotion);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  // Position + show/hide when activeCard changes
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (activeCard === null || reducedMotion) {
      debounceRef.current = setTimeout(() => setShow(false), 80);
      return;
    }

    debounceRef.current = setTimeout(() => {
      const cards = cardRefs.current;
      const container = containerRef.current;
      if (!cards || !container) return;

      const card = cards[activeCard];
      if (!card) return;

      const cardRect = card.getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();

      setPos({
        x: cardRect.left - containerRect.left + cardRect.width / 2,
        y: cardRect.top - containerRect.top - 20,
      });
      setShow(true);
    }, 120);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [activeCard, cardRefs, containerRef, reducedMotion]);

  if (reducedMotion) return null;

  return (
    <div
      className="absolute pointer-events-none"
      style={{
        zIndex: 20,
        left: `${pos.x}px`,
        top: `${pos.y}px`,
        transform: "translate(-50%, -100%)",
        width: isMobile ? "100px" : "160px",
        height: isMobile ? "180px" : "280px",
        opacity: show ? 1 : 0,
        transition: "opacity 0.45s ease, transform 0.45s ease",
      }}
      aria-hidden="true"
    >
      {/* SVG light streams */}
      {show && !isMobile && <LightStreams />}

      {/* 3D wireframe phone */}
      {!isMobile ? (
        <Canvas
          dpr={[1, 2]}
          gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
          camera={{ position: [0, 0, 3.5], fov: 40 }}
          style={{ width: "100%", height: "100%" }}
          onCreated={({ gl }) => {
            gl.setClearColor(0x000000, 0);
          }}
        >
          <WireframePhone visible={show} />
        </Canvas>
      ) : (
        /* Mobile fallback: CSS perspective phone */
        <div
          className="w-full h-full flex items-center justify-center"
          style={{
            perspective: "400px",
            opacity: show ? 1 : 0,
            transition: "opacity 0.4s ease",
          }}
        >
          <div
            style={{
              width: "60px",
              height: "110px",
              border: `1.5px solid ${GOLD_HEX}`,
              borderRadius: "10px",
              animation: show ? "css-phone-rotate 4s ease-in-out infinite" : "none",
              opacity: 0.6,
            }}
          />
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   WireframePhone — R3F component: rounded box, amber wireframe, slow rotate
   ───────────────────────────────────────────────────────────────────────── */
function WireframePhone({ visible }: { visible: boolean }) {
  const groupRef = useRef<THREE.Group>(null);
  const matRef = useRef<THREE.MeshBasicMaterial>(null);

  const targetOpacity = visible ? 0.7 : 0;
  const targetScale = visible ? 1 : 0.6;

  useFrame((_, delta) => {
    if (!groupRef.current || !matRef.current) return;
    const dt = Math.min(delta, 0.05);

    // Slow Y-axis rotation
    groupRef.current.rotation.y += dt * 0.4;
    // Gentle idle sway
    groupRef.current.rotation.x = Math.sin(Date.now() * 0.001) * 0.08;

    // Lerp opacity
    matRef.current.opacity += (targetOpacity - matRef.current.opacity) * dt * 4;

    // Lerp scale
    const s = groupRef.current.scale.x;
    const ns = s + (targetScale - s) * dt * 4;
    groupRef.current.scale.setScalar(ns);
  });

  return (
    <group ref={groupRef} scale={0.6}>
      <ambientLight intensity={0.3} />
      <directionalLight position={[2, 3, 2]} intensity={0.5} color={GOLD_BRIGHT_HEX} />

      {/* Phone body */}
      <RoundedBox args={[0.9, 1.8, 0.08]} radius={0.08} smoothness={4}>
        <meshBasicMaterial
          ref={matRef}
          color={GOLD_HEX}
          wireframe
          transparent
          opacity={0}
          side={THREE.DoubleSide}
        />
      </RoundedBox>

      {/* Screen plane (slightly inset) */}
      <mesh position={[0, 0, 0.045]}>
        <planeGeometry args={[0.72, 1.5]} />
        <meshBasicMaterial
          color={GOLD_HEX}
          transparent
          opacity={0.05}
          side={THREE.DoubleSide}
        />
      </mesh>
    </group>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   LightStreams — animated SVG converging lines
   ───────────────────────────────────────────────────────────────────────── */
function LightStreams() {
  const streams = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const angle = (i / 7) * Math.PI * 2 + Math.random() * 0.3;
      const radius = 80 + Math.random() * 40;
      return {
        startX: Math.cos(angle) * radius,
        startY: Math.sin(angle) * radius + 60,
        delay: i * 0.08,
      };
    });
  }, []);

  return (
    <svg
      className="absolute inset-0 w-full h-full overflow-visible"
      viewBox="-120 -120 240 320"
      style={{ opacity: 0.5 }}
    >
      {streams.map((s, i) => (
        <line
          key={i}
          x1={s.startX}
          y1={s.startY}
          x2={0}
          y2={0}
          stroke={GOLD_HEX}
          strokeWidth="0.8"
          opacity="0.4"
          style={{
            animation: `stream-sweep 1.2s ease ${s.delay}s both`,
          }}
        >
          <animate
            attributeName="opacity"
            values="0;0.5;0.2"
            dur="1.5s"
            begin={`${s.delay}s`}
            fill="freeze"
          />
        </line>
      ))}
    </svg>
  );
}
