"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { PerformanceMonitor } from "@react-three/drei";
import {
  Bloom,
  EffectComposer,
  Noise,
  Vignette,
} from "@react-three/postprocessing";
import { BlendFunction } from "postprocessing";

import BlueprintBackground from "./BlueprintBackground";
import {
  CAMERA,
  DUST,
  PADLOCK,
  PANEL_PLACEMENTS,
  POST,
  SCANLINE,
  TOKENS,
  WIRE_ARCHETYPES,
  PHONE,
  resolvePanelPhase,
  ease,
  clamp01,
  type PanelPlacement,
} from "@/lib/classifiedScene";

/* ═══════════════════════════════════════════════════════════════════════════
   ClassifiedBlueprintBg — ambient "vault" 3D background for #tracks.

   Replaces GenesisBackground with a restrained, premium gold-on-black scene:
   floating wireframe phone panels at varying depths, a solid 3D padlock,
   a vertical scanline sweep, and sparse gold dust particles.
   ═══════════════════════════════════════════════════════════════════════════ */

type Tier = "high" | "mid" | "low";

/* ─────────────────────────────────────────────────────────────────────────
   GoldDust — sparse upward-drifting point sprites
   ───────────────────────────────────────────────────────────────────────── */
function GoldDust({ tier }: { tier: Tier }) {
  const count =
    tier === "high" ? DUST.countHigh : tier === "mid" ? DUST.countMid : DUST.countLow;
  const meshRef = useRef<THREE.Points>(null);

  // Pre-allocate at max count so the buffer never needs resizing
  const maxCount = DUST.countHigh;
  const [positions, opacities] = useMemo(() => {
    const pos = new Float32Array(maxCount * 3);
    const opa = new Float32Array(maxCount);
    for (let i = 0; i < maxCount; i++) {
      pos[i * 3] = (Math.random() - 0.5) * DUST.spread[0];
      pos[i * 3 + 1] = (Math.random() - 0.5) * DUST.spread[1];
      pos[i * 3 + 2] = (Math.random() - 0.5) * DUST.spread[2] - 4;
      opa[i] = Math.random() * 0.2 + 0.1;
    }
    return [pos, opa];
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useFrame((_, delta) => {
    if (!meshRef.current) return;
    const geo = meshRef.current.geometry;
    const posAttr = geo.getAttribute("position") as THREE.BufferAttribute;
    const arr = posAttr.array as Float32Array;
    const dt = Math.min(delta, 0.05);

    // Only animate up to current tier's count
    for (let i = 0; i < count; i++) {
      arr[i * 3 + 1] += DUST.speed * dt * (0.8 + opacities[i] * 2);
      if (arr[i * 3 + 1] > DUST.spread[1] * 0.5) {
        arr[i * 3 + 1] = -DUST.spread[1] * 0.5;
        arr[i * 3] = (Math.random() - 0.5) * DUST.spread[0];
        arr[i * 3 + 2] = (Math.random() - 0.5) * DUST.spread[2] - 4;
      }
    }
    // Use draw range to limit visible particles to current tier count
    geo.setDrawRange(0, count);
    posAttr.needsUpdate = true;
  });

  return (
    <points ref={meshRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={maxCount}
          array={positions}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial
        color={TOKENS.gold}
        size={DUST.size}
        sizeAttenuation
        transparent
        opacity={0.18}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   ScanlinePlane — thin gold beam sweeping vertically through the scene
   ───────────────────────────────────────────────────────────────────────── */
function ScanlinePlane() {
  const meshRef = useRef<THREE.Mesh>(null);
  const matRef = useRef<THREE.MeshBasicMaterial>(null);

  useFrame(({ clock }) => {
    if (!meshRef.current || !matRef.current) return;
    const t = (clock.getElapsedTime() % SCANLINE.period) / SCANLINE.period;
    const y = (t - 0.5) * SCANLINE.range;
    meshRef.current.position.y = y;
    // Pulse opacity: brighter in center, fades at edges
    const centerDist = Math.abs(t - 0.5) * 2;
    matRef.current.opacity = 0.18 * (1 - centerDist * 0.4);
  });

  return (
    <mesh ref={meshRef} position={[0, 0, 0]}>
      <planeGeometry args={[16, SCANLINE.thickness]} />
      <meshBasicMaterial
        ref={matRef}
        color={TOKENS.gold}
        transparent
        opacity={0.15}
        side={THREE.DoubleSide}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </mesh>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   WireframePanel — a single floating phone wireframe with lifecycle
   ───────────────────────────────────────────────────────────────────────── */
function WireframePanel({ placement }: { placement: PanelPlacement }) {
  const groupRef = useRef<THREE.Group>(null);
  const linesRef = useRef<THREE.Group>(null);
  const tracerRef = useRef<THREE.Mesh>(null);
  const outlineRef = useRef<THREE.LineSegments>(null);

  const archetype = WIRE_ARCHETYPES[placement.archetypeIdx % WIRE_ARCHETYPES.length];
  const totalLines = archetype.lines.length;

  // Build line geometry for the wireframe content
  const wireGeo = useMemo(() => {
    const positions: number[] = [];
    const pw = PHONE.width * placement.scale;
    const ph = PHONE.height * placement.scale;

    for (const line of archetype.lines) {
      positions.push(
        (line.x1 - 0.5) * pw, (0.5 - line.y1) * ph, 0,
        (line.x2 - 0.5) * pw, (0.5 - line.y2) * ph, 0
      );
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    return geo;
  }, [archetype, placement.scale]);

  // Phone outline
  const outlineGeo = useMemo(() => {
    const pw = PHONE.width * placement.scale;
    const ph = PHONE.height * placement.scale;
    const hpw = pw / 2;
    const hph = ph / 2;
    const r = PHONE.radius * placement.scale;
    const positions: number[] = [];
    const steps = 6;

    // Top edge
    positions.push(-hpw + r, hph, 0, hpw - r, hph, 0);
    // Top-right corner
    for (let i = 0; i < steps; i++) {
      const a1 = (i / steps) * (Math.PI / 2);
      const a2 = ((i + 1) / steps) * (Math.PI / 2);
      positions.push(
        hpw - r + Math.sin(a1) * r, hph - r + Math.cos(a1) * r, 0,
        hpw - r + Math.sin(a2) * r, hph - r + Math.cos(a2) * r, 0
      );
    }
    // Right edge
    positions.push(hpw, hph - r, 0, hpw, -hph + r, 0);
    // Bottom-right corner
    for (let i = 0; i < steps; i++) {
      const a1 = (Math.PI / 2) + (i / steps) * (Math.PI / 2);
      const a2 = (Math.PI / 2) + ((i + 1) / steps) * (Math.PI / 2);
      positions.push(
        hpw - r + Math.sin(a1) * r, -hph + r + Math.cos(a1) * r, 0,
        hpw - r + Math.sin(a2) * r, -hph + r + Math.cos(a2) * r, 0
      );
    }
    // Bottom edge
    positions.push(hpw - r, -hph, 0, -hpw + r, -hph, 0);
    // Bottom-left corner
    for (let i = 0; i < steps; i++) {
      const a1 = Math.PI + (i / steps) * (Math.PI / 2);
      const a2 = Math.PI + ((i + 1) / steps) * (Math.PI / 2);
      positions.push(
        -hpw + r + Math.sin(a1) * r, -hph + r + Math.cos(a1) * r, 0,
        -hpw + r + Math.sin(a2) * r, -hph + r + Math.cos(a2) * r, 0
      );
    }
    // Left edge
    positions.push(-hpw, -hph + r, 0, -hpw, hph - r, 0);
    // Top-left corner
    for (let i = 0; i < steps; i++) {
      const a1 = (3 * Math.PI / 2) + (i / steps) * (Math.PI / 2);
      const a2 = (3 * Math.PI / 2) + ((i + 1) / steps) * (Math.PI / 2);
      positions.push(
        -hpw + r + Math.sin(a1) * r, hph - r + Math.cos(a1) * r, 0,
        -hpw + r + Math.sin(a2) * r, hph - r + Math.cos(a2) * r, 0
      );
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    return geo;
  }, [placement.scale]);

  // Base drift animation
  const driftSeed = useMemo(() => ({
    px: Math.random() * Math.PI * 2,
    py: Math.random() * Math.PI * 2,
    rx: Math.random() * Math.PI * 2,
  }), []);

  useFrame(({ clock }) => {
    if (!groupRef.current || !linesRef.current) return;

    const time = clock.getElapsedTime();
    const { phase, t } = resolvePanelPhase(time, placement.phaseOffset);

    // Gentle idle drift
    const driftX = Math.sin(time * 0.08 + driftSeed.px) * 0.12;
    const driftY = Math.sin(time * 0.06 + driftSeed.py) * 0.08;
    const driftRx = Math.sin(time * 0.04 + driftSeed.rx) * 0.015;

    groupRef.current.position.set(
      placement.position[0] + driftX,
      placement.position[1] + driftY,
      placement.position[2]
    );
    groupRef.current.rotation.set(
      placement.rotation[0] + driftRx,
      placement.rotation[1],
      placement.rotation[2]
    );

    // Phase-based visibility
    let wireOpacity = 0;
    let outlineOpacity = 0;
    let tracerVisible = false;
    let tracerProgress = 0;
    let glitchOffset = 0;

    switch (phase) {
      case "draw":
        wireOpacity = ease.outCubic(t) * 0.25;
        outlineOpacity = ease.outCubic(Math.min(t * 3, 1)) * 0.18;
        tracerVisible = t < 0.95;
        tracerProgress = t;
        break;
      case "hold":
        wireOpacity = 0.25 + Math.sin(time * 3.5) * 0.03; // voltage flicker
        outlineOpacity = 0.18 + Math.sin(time * 3.5) * 0.02;
        break;
      case "glitch":
        wireOpacity = 0.22;
        outlineOpacity = 0.15;
        glitchOffset = (Math.random() - 0.5) * 0.02 * (1 - t);
        break;
      case "fade":
        wireOpacity = 0.25 * (1 - ease.inCubic(t));
        outlineOpacity = 0.18 * (1 - ease.inCubic(t));
        break;
    }

    // Apply wireframe draw range (reveal lines progressively)
    const drawCount = phase === "draw"
      ? Math.floor(t * totalLines * 2) * 2
      : totalLines * 2;
    wireGeo.setDrawRange(0, drawCount);

    // Glitch horizontal displacement
    if (linesRef.current) {
      linesRef.current.position.x = glitchOffset;
    }

    // Update material opacities
    const wireMat = (linesRef.current?.children[0] as THREE.LineSegments)?.material as THREE.LineBasicMaterial;
    if (wireMat) wireMat.opacity = wireOpacity;

    const outMat = outlineRef.current?.material as THREE.LineBasicMaterial;
    if (outMat) outMat.opacity = outlineOpacity;

    // Tracer dot
    if (tracerRef.current) {
      tracerRef.current.visible = tracerVisible;
      if (tracerVisible) {
        const lineIdx = Math.min(
          Math.floor(tracerProgress * totalLines),
          totalLines - 1
        );
        const line = archetype.lines[lineIdx];
        const lineProg = (tracerProgress * totalLines) - lineIdx;
        const pw = PHONE.width * placement.scale;
        const ph = PHONE.height * placement.scale;
        const tx = ((line.x1 + (line.x2 - line.x1) * lineProg) - 0.5) * pw;
        const ty = (0.5 - (line.y1 + (line.y2 - line.y1) * lineProg)) * ph;
        tracerRef.current.position.set(tx, ty, 0.01);
      }
    }
  });

  return (
    <group ref={groupRef} position={placement.position as any} rotation={placement.rotation as any}>
      <group ref={linesRef}>
        <lineSegments geometry={wireGeo}>
          <lineBasicMaterial
            color={TOKENS.gold}
            transparent
            opacity={0}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
          />
        </lineSegments>
      </group>

      <lineSegments ref={outlineRef} geometry={outlineGeo}>
        <lineBasicMaterial
          color={TOKENS.gold}
          transparent
          opacity={0}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </lineSegments>

      {/* Tracer dot */}
      <mesh ref={tracerRef} visible={false}>
        <circleGeometry args={[0.012, 8]} />
        <meshBasicMaterial
          color={TOKENS.goldBright}
          transparent
          opacity={0.9}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
    </group>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   Padlock3D — solid gold padlock as focal "sealed dossier" motif
   ───────────────────────────────────────────────────────────────────────── */
function Padlock3D() {
  const groupRef = useRef<THREE.Group>(null);

  // Glass panel behind the padlock
  const panelRef = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    if (!groupRef.current) return;
    const t = clock.getElapsedTime();
    // Very slow hover
    groupRef.current.position.y = PADLOCK.position[1] + Math.sin(t * 0.3) * 0.05;
    groupRef.current.rotation.y = PADLOCK.rotation[1] + Math.sin(t * 0.15) * 0.06;
  });

  const goldMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: TOKENS.gold,
        metalness: 0.85,
        roughness: 0.2,
        emissive: TOKENS.gold,
        emissiveIntensity: 0.08,
      }),
    []
  );

  const glassMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: TOKENS.surface,
        metalness: 0.1,
        roughness: 0.05,
        transparent: true,
        opacity: 0.12,
        side: THREE.DoubleSide,
      }),
    []
  );

  return (
    <group
      ref={groupRef}
      position={PADLOCK.position as any}
      rotation={PADLOCK.rotation as any}
      scale={PADLOCK.scale}
    >
      {/* Lock body */}
      <mesh material={goldMat} position={[0, -0.1, 0]}>
        <boxGeometry args={[PADLOCK.bodyWidth, PADLOCK.bodyHeight, PADLOCK.bodyDepth]} />
      </mesh>

      {/* Shackle — torus arc */}
      <mesh
        material={goldMat}
        position={[0, 0.22, 0]}
        rotation={[0, 0, 0]}
      >
        <torusGeometry args={[PADLOCK.shackleRadius, PADLOCK.shackleThickness, 8, 20, Math.PI]} />
      </mesh>

      {/* Keyhole */}
      <mesh position={[0, -0.15, PADLOCK.bodyDepth / 2 + 0.001]}>
        <circleGeometry args={[0.07, 12]} />
        <meshBasicMaterial color={TOKENS.ink} />
      </mesh>
      <mesh position={[0, -0.23, PADLOCK.bodyDepth / 2 + 0.001]}>
        <planeGeometry args={[0.04, 0.1]} />
        <meshBasicMaterial color={TOKENS.ink} />
      </mesh>

      {/* Glass/acrylic panel behind */}
      <mesh ref={panelRef} material={glassMat} position={[0, 0, -0.25]}>
        <planeGeometry args={[1.8, 1.6]} />
      </mesh>
    </group>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   CameraController — very gentle orbit + mouse parallax
   ───────────────────────────────────────────────────────────────────────── */
function CameraController({
  mouseRef,
}: {
  mouseRef: React.MutableRefObject<{ x: number; y: number }>;
}) {
  const { camera } = useThree();

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    const ox =
      Math.sin(t * ((2 * Math.PI) / CAMERA.orbitPeriod[0])) *
      CAMERA.orbitAmplitude[0];
    const oy =
      Math.sin(t * ((2 * Math.PI) / CAMERA.orbitPeriod[1])) *
      CAMERA.orbitAmplitude[1];
    const oz =
      Math.sin(t * ((2 * Math.PI) / CAMERA.orbitPeriod[2])) *
      CAMERA.orbitAmplitude[2];

    const mx = mouseRef.current.x * CAMERA.mouseParallax;
    const my = mouseRef.current.y * CAMERA.mouseParallax;

    camera.position.set(
      CAMERA.position[0] + ox + mx,
      CAMERA.position[1] + oy + my,
      CAMERA.position[2] + oz
    );
    camera.lookAt(CAMERA.lookAt[0], CAMERA.lookAt[1], CAMERA.lookAt[2]);
  });

  return null;
}

/* ─────────────────────────────────────────────────────────────────────────
   Lighting — single warm gold key + faint ambient
   ───────────────────────────────────────────────────────────────────────── */
function Lighting() {
  return (
    <>
      <ambientLight intensity={0.08} />
      <directionalLight
        position={[-2, 3, 3]}
        intensity={0.4}
        color={TOKENS.gold}
      />
      <pointLight
        position={[0.5, 0.5, 2]}
        intensity={0.6}
        distance={8}
        decay={2}
        color={TOKENS.goldBright}
      />
    </>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   FogSetup — exponential fog matching --ink
   ───────────────────────────────────────────────────────────────────────── */
function FogSetup() {
  const { scene, gl } = useThree();

  useEffect(() => {
    scene.fog = new THREE.FogExp2(new THREE.Color(TOKENS.ink), 0.08);
    gl.setClearColor(new THREE.Color(TOKENS.ink), 0);
    return () => {
      scene.fog = null;
    };
  }, [scene, gl]);

  return null;
}

/* ─────────────────────────────────────────────────────────────────────────
   Scene — assembled scene graph
   ───────────────────────────────────────────────────────────────────────── */
function Scene({
  tier,
  mouseRef,
}: {
  tier: Tier;
  mouseRef: React.MutableRefObject<{ x: number; y: number }>;
}) {
  return (
    <>
      <FogSetup />
      <CameraController mouseRef={mouseRef} />
      <Lighting />

      {/* Wireframe panels */}
      {PANEL_PLACEMENTS.map((p, i) => (
        <WireframePanel key={i} placement={p} />
      ))}

      {/* 3D padlock */}
      <Padlock3D />

      {/* Scanline sweep */}
      <ScanlinePlane />

      {/* Gold dust particles */}
      <GoldDust tier={tier} />
    </>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   PostEffects
   ───────────────────────────────────────────────────────────────────────── */
function PostEffects({ tier }: { tier: Tier }) {
  if (tier === "low") return null;

  return (
    <EffectComposer multisampling={0} enableNormalPass={false}>
      <Bloom
        intensity={POST.bloomIntensity}
        luminanceThreshold={POST.bloomThreshold}
        luminanceSmoothing={POST.bloomSmoothing}
        mipmapBlur
        radius={0.55}
      />
      {(tier === "high" && (
        <Noise opacity={POST.noiseOpacity} blendFunction={BlendFunction.OVERLAY} />
      )) as any}
      <Vignette
        eskil={false}
        offset={POST.vignetteOffset}
        darkness={POST.vignetteDarkness}
      />
    </EffectComposer>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   Top-level component
   ═══════════════════════════════════════════════════════════════════════════ */
export default function ClassifiedBlueprintBg() {
  const hostRef = useRef<HTMLDivElement>(null);
  const mouseRef = useRef({ x: 0, y: 0 });

  const [mode, setMode] = useState<"unknown" | "three" | "fallback">("unknown");
  const [tier, setTier] = useState<Tier>("high");
  const [frameloop, setFrameloop] = useState<"always" | "never">("never");

  /* ── Capability detection ────────────────────────────────── */
  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");

    const hasWebGL2 = (() => {
      try {
        const c = document.createElement("canvas");
        return !!c.getContext("webgl2");
      } catch {
        return false;
      }
    })();

    const decide = () => {
      if (reduced.matches || !hasWebGL2) {
        setMode("fallback");
        return;
      }
      setMode("three");
    };

    decide();
    reduced.addEventListener("change", decide);

    const cores = navigator.hardwareConcurrency ?? 4;
    const coarse = window.matchMedia("(hover: none)").matches;
    const narrow = window.innerWidth < 768;
    if (coarse || narrow || cores <= 4) setTier("mid");
    if (cores <= 2) setTier("low");

    return () => {
      reduced.removeEventListener("change", decide);
    };
  }, []);

  /* ── Pause when off-screen ─────────────────────────────── */
  useEffect(() => {
    if (mode !== "three") return;
    const el = hostRef.current;
    if (!el) return;

    const io = new IntersectionObserver(
      ([entry]) => {
        setFrameloop(entry.isIntersecting ? "always" : "never");
      },
      { threshold: 0.02 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [mode]);

  /* ── Pointer parallax ─────────────────────────────────── */
  useEffect(() => {
    if (mode !== "three") return;
    if (window.matchMedia("(hover: none)").matches) return;

    const onMove = (e: PointerEvent) => {
      mouseRef.current.x = (e.clientX / window.innerWidth) * 2 - 1;
      mouseRef.current.y = -((e.clientY / window.innerHeight) * 2 - 1);
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => window.removeEventListener("pointermove", onMove);
  }, [mode]);

  /* ── PerformanceMonitor callbacks ─────────────────────── */
  const onDecline = useCallback(() => {
    setTier((t) => (t === "high" ? "mid" : "low"));
  }, []);

  /* ── Fallback ───────────────────────────────────────────── */
  if (mode !== "three") {
    return <BlueprintBackground />;
  }

  return (
    <div
      ref={hostRef}
      className="absolute inset-0 pointer-events-none"
      style={{ zIndex: 0, opacity: POST.canvasOpacity }}
      aria-hidden="true"
    >
      <div
        className="absolute inset-0"
        style={{
          maskImage:
            "radial-gradient(ellipse 130% 100% at 50% 50%, #000 40%, transparent 100%)",
          WebkitMaskImage:
            "radial-gradient(ellipse 130% 100% at 50% 50%, #000 40%, transparent 100%)",
        }}
      >
        <Canvas
          frameloop={frameloop}
          dpr={[1, 2]}
          gl={{
            antialias: false,
            alpha: true,
            powerPreference: "high-performance",
            stencil: false,
            depth: true,
          }}
          camera={{
            fov: CAMERA.fov,
            position: CAMERA.position,
            near: 0.1,
            far: 50,
          }}
          onCreated={({ gl }) => {
            gl.setClearColor(new THREE.Color(TOKENS.ink), 0);
            gl.toneMapping = THREE.ACESFilmicToneMapping;
            gl.toneMappingExposure = 1.0;
          }}
        >
          <PerformanceMonitor
            onDecline={onDecline}
            flipflops={3}
            onFallback={() => setTier("low")}
          >
            <Scene tier={tier} mouseRef={mouseRef} />
            <PostEffects tier={tier} />
          </PerformanceMonitor>
        </Canvas>
      </div>
    </div>
  );
}
