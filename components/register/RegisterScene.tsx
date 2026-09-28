"use client";

/* ═══════════════════════════════════════════════════════════════════════════
   RegisterScene — cinematic 3D background for #register.

   Reuses the exact react-three-fiber + drei + postprocessing stack already
   established by ForgeCoreScene (Rulebook) and GenesisBackground/
   ClassifiedBlueprintBg (Tracks): PerformanceMonitor for tier fallback,
   EffectComposer+Bloom tuned to gold-emissive surfaces only, ACES tone
   mapping, and an IntersectionObserver-gated frameloop that goes fully idle
   when the section is off-screen. Colour tokens are the same hex values as
   app/globals.css (see genesisScene.ts's TOKENS) — no second palette.

   The assembly intro (§3 of the brief) is a single 0..1 progress ref driven
   by a plain rAF, read by every child in its own useFrame — nothing is
   choreographed through React state, so nothing can drift out of sync.
   ═══════════════════════════════════════════════════════════════════════════ */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { Canvas, useFrame } from "@react-three/fiber";
import { MeshReflectorMaterial, PerformanceMonitor } from "@react-three/drei";
import { Bloom, EffectComposer } from "@react-three/postprocessing";

type Tier = "high" | "mid" | "low";

/* ── tokens — mirrors app/globals.css exactly, see lib/genesisScene.ts ── */
const INK = "#07090d";
const GOLD = "#d9a94a";
const GOLD_BRIGHT = "#f4c862";
const OBSIDIAN = "#05060a";

const FLOOR_Y = -1.9;

/* ── easing helpers, same style as RuleGrid.tsx's applyCardLanding ── */
const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const expoOut = (t: number) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t));
const easeInOutCubic = (t: number) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

interface MouseRef {
  x: number;
  y: number;
}

/* ═══════════════════════════════════════════════════════════════════════════
   Core — the obsidian-glass geodesic shell, gold seam wireframe, and the
   nested emissive icosahedron that bleeds light through the facet gaps.
   Assembly progress (0..1) drives scale/opacity in and the "brightest
   moment" emissive peak; past p=1 it settles into a slow breathing pulse.
   ═══════════════════════════════════════════════════════════════════════════ */
function Core({
  progress,
  reducedMotion,
}: {
  progress: React.MutableRefObject<number>;
  reducedMotion: boolean;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const shellMatRef = useRef<THREE.MeshPhysicalMaterial>(null);
  const innerMatRef = useRef<THREE.MeshStandardMaterial>(null);
  const edgeMatRef = useRef<THREE.LineBasicMaterial>(null);

  // detail=1 gives 80 low-poly facets — close to the spec's "40-60" and reads
  // as a proper geodesic dome; an exact 40-60 count needs a fractional-
  // frequency geodesic construction that isn't worth the added risk here.
  const shellGeo = useMemo(() => new THREE.IcosahedronGeometry(1, 1), []);
  const edgesGeo = useMemo(() => new THREE.EdgesGeometry(shellGeo, 1), [shellGeo]);
  const innerGeo = useMemo(() => new THREE.IcosahedronGeometry(0.55, 0), []);

  useFrame(({ clock }, delta) => {
    const g = groupRef.current;
    if (!g) return;
    const t = clock.getElapsedTime();
    const p = progress.current;

    if (!reducedMotion) {
      g.rotation.y += delta * 0.045; // ~2.5°/s, within the 2-4°/s spec range
      g.rotation.x = 0.16 + Math.sin(t * 0.15) * 0.05;
      g.rotation.z = 0.06;
    }

    const scale = 0.6 + 0.4 * expoOut(p);
    g.scale.setScalar(scale);

    if (shellMatRef.current) shellMatRef.current.opacity = clamp01(p * 1.3);
    if (edgeMatRef.current) edgeMatRef.current.opacity = clamp01(p * 1.3) * 0.85;

    if (innerMatRef.current) {
      let intensity: number;
      if (p < 1) {
        // brightest moment around p≈0.65 (the spec's "2.0-3.5s of 5s" window)
        const rise = clamp01(p / 0.62);
        const fall = clamp01((p - 0.62) / 0.38);
        intensity = expoOut(rise) * (1 - fall) + fall * 0.16;
      } else if (reducedMotion) {
        intensity = 0.16;
      } else {
        intensity = 0.15 + Math.sin((t * Math.PI * 2) / 5.2) * 0.06; // ~5s breathing
      }
      innerMatRef.current.emissiveIntensity = intensity;
    }
  });

  return (
    <group ref={groupRef}>
      <mesh geometry={shellGeo}>
        <meshPhysicalMaterial
          ref={shellMatRef}
          color={OBSIDIAN}
          metalness={0.25}
          roughness={0.16}
          clearcoat={0.7}
          clearcoatRoughness={0.15}
          transparent
          opacity={0}
          side={THREE.DoubleSide}
        />
      </mesh>
      <lineSegments geometry={edgesGeo}>
        <lineBasicMaterial ref={edgeMatRef} color={GOLD} transparent opacity={0} />
      </lineSegments>
      <mesh geometry={innerGeo}>
        <meshStandardMaterial
          ref={innerMatRef}
          color={GOLD}
          emissive={GOLD_BRIGHT}
          emissiveIntensity={0}
          roughness={1}
          metalness={0}
        />
      </mesh>
    </group>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   ShardSwarm — the shards that fly in from the section's edges and converge
   into the core, plus their fading gold guide-lines. Unmounts for good once
   fully converged; the assembled shell (Core) has already taken over by then.
   ═══════════════════════════════════════════════════════════════════════════ */
const SHARD_COUNT = 26;

interface ShardState {
  start: THREE.Vector3;
  rot: THREE.Euler;
  scale: number;
}

function ShardSwarm({
  progress,
  reducedMotion,
}: {
  progress: React.MutableRefObject<number>;
  reducedMotion: boolean;
}) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const lineRef = useRef<THREE.LineSegments>(null);
  const [visible, setVisible] = useState(!reducedMotion);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const shardGeo = useMemo(() => new THREE.TetrahedronGeometry(1, 0), []);

  const states = useMemo<ShardState[]>(() => {
    const arr: ShardState[] = [];
    for (let i = 0; i < SHARD_COUNT; i++) {
      const angle = Math.random() * Math.PI * 2;
      const radius = 3.4 + Math.random() * 2.6;
      arr.push({
        start: new THREE.Vector3(
          Math.cos(angle) * radius,
          (Math.random() - 0.5) * 3.6,
          (Math.random() - 0.5) * 2.4 - 0.4
        ),
        rot: new THREE.Euler(
          Math.random() * Math.PI,
          Math.random() * Math.PI,
          Math.random() * Math.PI
        ),
        scale: 0.09 + Math.random() * 0.16,
      });
    }
    return arr;
  }, []);

  const shardMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: OBSIDIAN,
        emissive: new THREE.Color(GOLD),
        emissiveIntensity: 0.35,
        transparent: true,
        opacity: 1,
        roughness: 0.3,
        metalness: 0.4,
      }),
    []
  );

  const lineGeo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute(
      "position",
      new THREE.BufferAttribute(new Float32Array(SHARD_COUNT * 6), 3)
    );
    return g;
  }, []);
  const lineMaterial = useMemo(
    () => new THREE.LineBasicMaterial({ color: GOLD, transparent: true, opacity: 0 }),
    []
  );

  useFrame(() => {
    if (reducedMotion || !visible) return;
    const mesh = meshRef.current;
    const line = lineRef.current;
    if (!mesh || !line) return;

    // shards finish converging well before the core's own p=1 settle point
    const p = clamp01(progress.current / 0.8);
    if (p >= 1) {
      setVisible(false);
      return;
    }

    const eased = easeInOutCubic(p);
    const posArr = line.geometry.attributes.position.array as Float32Array;

    for (let i = 0; i < SHARD_COUNT; i++) {
      const st = states[i];
      const x = THREE.MathUtils.lerp(st.start.x, 0, eased);
      const y = THREE.MathUtils.lerp(st.start.y, 0, eased);
      const z = THREE.MathUtils.lerp(st.start.z, 0, eased);
      const s = Math.max(st.scale * (1 - eased * 0.85), 0.001);

      dummy.position.set(x, y, z);
      dummy.rotation.set(st.rot.x + eased * 4, st.rot.y + eased * 4, st.rot.z);
      dummy.scale.setScalar(s);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);

      const o = i * 6;
      posArr[o] = st.start.x;
      posArr[o + 1] = st.start.y;
      posArr[o + 2] = st.start.z;
      posArr[o + 3] = x;
      posArr[o + 4] = y;
      posArr[o + 5] = z;
    }
    mesh.instanceMatrix.needsUpdate = true;
    line.geometry.attributes.position.needsUpdate = true;

    // guide-lines brighten then fade as convergence proceeds (§3 of the brief)
    lineMaterial.opacity = Math.sin(eased * Math.PI) * 0.55;
    shardMaterial.opacity = 1 - eased * 0.3;
  });

  if (!visible) return null;

  return (
    <>
      <instancedMesh ref={meshRef} args={[shardGeo, shardMaterial, SHARD_COUNT]} />
      <lineSegments ref={lineRef} geometry={lineGeo} material={lineMaterial} />
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   ShardField — ambient background/foreground drifting shard layers with
   independent parallax response (§4 of the brief).
   ═══════════════════════════════════════════════════════════════════════════ */
interface FieldConfig {
  count: number;
  spread: [number, number, number];
  scaleRange: [number, number];
  speed: number;
  parallax: number;
  opacity: number;
}

function ShardField({
  config,
  mouse,
  reducedMotion,
}: {
  config: FieldConfig;
  mouse: React.MutableRefObject<MouseRef>;
  reducedMotion: boolean;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const geo = useMemo(() => new THREE.TetrahedronGeometry(1, 0), []);
  const material = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: OBSIDIAN,
        emissive: new THREE.Color(GOLD),
        emissiveIntensity: 0.22,
        transparent: true,
        opacity: config.opacity,
        roughness: 0.4,
        metalness: 0.35,
      }),
    [config.opacity]
  );

  const states = useMemo(() => {
    const [sx, sy, sz] = config.spread;
    return Array.from({ length: config.count }, () => ({
      pos: new THREE.Vector3(
        (Math.random() - 0.5) * sx,
        (Math.random() - 0.5) * sy,
        (Math.random() - 0.5) * sz
      ),
      rot: new THREE.Euler(
        Math.random() * Math.PI,
        Math.random() * Math.PI,
        Math.random() * Math.PI
      ),
      rv: (Math.random() - 0.5) * 0.4,
      scale:
        config.scaleRange[0] +
        Math.random() * (config.scaleRange[1] - config.scaleRange[0]),
      drift: (Math.random() - 0.5) * config.speed,
    }));
  }, [config]);

  useFrame((_, delta) => {
    const mesh = meshRef.current;
    const group = groupRef.current;
    if (!mesh) return;

    if (group && !reducedMotion) {
      const mx = mouse.current.x * config.parallax * 0.6;
      const my = mouse.current.y * config.parallax * -0.4;
      group.position.x += (mx - group.position.x) * 0.04;
      group.position.y += (my - group.position.y) * 0.04;
    }

    if (reducedMotion) return;

    const sy = config.spread[1];
    for (let i = 0; i < states.length; i++) {
      const st = states[i];
      st.pos.y += st.drift * delta;
      if (st.pos.y > sy / 2) st.pos.y = -sy / 2;
      if (st.pos.y < -sy / 2) st.pos.y = sy / 2;
      st.rot.z += st.rv * delta;

      dummy.position.copy(st.pos);
      dummy.rotation.copy(st.rot);
      dummy.scale.setScalar(st.scale);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  });

  return (
    <group ref={groupRef}>
      <instancedMesh ref={meshRef} args={[geo, material, config.count]} />
    </group>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   Dust — fine gold particles drifting slowly upward, looping (§8 of the brief).
   ═══════════════════════════════════════════════════════════════════════════ */
function Dust({ count, reducedMotion }: { count: number; reducedMotion: boolean }) {
  const pointsRef = useRef<THREE.Points>(null);
  const positions = useMemo(() => {
    const arr = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      arr[i * 3] = (Math.random() - 0.5) * 9;
      arr[i * 3 + 1] = (Math.random() - 0.5) * 5;
      arr[i * 3 + 2] = (Math.random() - 0.5) * 4;
    }
    return arr;
  }, [count]);
  const speeds = useMemo(
    () => Array.from({ length: count }, () => 0.15 + Math.random() * 0.25),
    [count]
  );

  useFrame((_, delta) => {
    if (reducedMotion) return;
    const pts = pointsRef.current;
    if (!pts) return;
    const arr = pts.geometry.attributes.position.array as Float32Array;
    for (let i = 0; i < count; i++) {
      arr[i * 3 + 1] += speeds[i] * delta * 0.3;
      if (arr[i * 3 + 1] > 2.6) arr[i * 3 + 1] = -2.6;
    }
    pts.geometry.attributes.position.needsUpdate = true;
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" count={count} array={positions} itemSize={3} />
      </bufferGeometry>
      <pointsMaterial
        color={GOLD}
        size={0.018}
        sizeAttenuation
        transparent
        opacity={0.35}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   Embers — a sparse handful of falling motes that glint on landing (§8).
   Individual meshes (not instanced) since the count is tiny either way.
   ═══════════════════════════════════════════════════════════════════════════ */
const EMBER_COUNT = 7;

function Embers({ reducedMotion }: { reducedMotion: boolean }) {
  const emberRefs = useRef<(THREE.Mesh | null)[]>([]);
  const glintRefs = useRef<(THREE.Mesh | null)[]>([]);
  const state = useMemo(
    () =>
      Array.from({ length: EMBER_COUNT }, () => ({
        x: (Math.random() - 0.5) * 5,
        y: 2 + Math.random() * 2.5,
        z: (Math.random() - 0.5) * 2,
        speed: 0.18 + Math.random() * 0.22,
        glint: 0,
      })),
    []
  );

  useFrame((_, delta) => {
    if (reducedMotion) return;
    for (let i = 0; i < EMBER_COUNT; i++) {
      const s = state[i];
      s.y -= s.speed * delta;
      if (s.y <= FLOOR_Y) {
        s.glint = 1;
        s.y = 2 + Math.random() * 2.5;
        s.x = (Math.random() - 0.5) * 5;
        s.z = (Math.random() - 0.5) * 2;
      }
      s.glint = Math.max(0, s.glint - delta * 1.6);

      const em = emberRefs.current[i];
      if (em) em.position.set(s.x, Math.max(s.y, FLOOR_Y), s.z);

      const gl = glintRefs.current[i];
      if (gl) {
        gl.position.set(s.x, FLOOR_Y + 0.01, s.z);
        gl.scale.setScalar(0.4 + s.glint * 1.1);
        (gl.material as THREE.MeshBasicMaterial).opacity = s.glint * 0.7;
      }
    }
  });

  return (
    <group>
      {state.map((_, i) => (
        <mesh key={`ember-${i}`} ref={(el) => { emberRefs.current[i] = el; }}>
          <sphereGeometry args={[0.02, 6, 6]} />
          <meshBasicMaterial color={GOLD_BRIGHT} transparent opacity={0.85} />
        </mesh>
      ))}
      {state.map((_, i) => (
        <mesh
          key={`glint-${i}`}
          ref={(el) => { glintRefs.current[i] = el; }}
          rotation={[-Math.PI / 2, 0, 0]}
        >
          <circleGeometry args={[0.18, 16]} />
          <meshBasicMaterial
            color={GOLD}
            transparent
            opacity={0}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
          />
        </mesh>
      ))}
    </group>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   ReflectiveFloor — glossy dark floor reflecting the scene above (§1.2 of
   the brief). Low tier gets a plain dark plane instead of the reflector
   render-target pass, which is the single most expensive effect here.
   ═══════════════════════════════════════════════════════════════════════════ */
function ReflectiveFloor({ tier }: { tier: Tier }) {
  if (tier === "low") {
    return (
      <mesh position={[0, FLOOR_Y, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[16, 10]} />
        <meshBasicMaterial color={OBSIDIAN} transparent opacity={0.5} />
      </mesh>
    );
  }
  return (
    <mesh position={[0, FLOOR_Y, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[16, 10]} />
      <MeshReflectorMaterial
        resolution={tier === "high" ? 512 : 256}
        mixBlur={1}
        mixStrength={35}
        blur={[300, 100]}
        depthScale={0.4}
        minDepthThreshold={0.4}
        maxDepthThreshold={1.2}
        color={OBSIDIAN}
        metalness={0.6}
        roughness={1}
        mirror={0.35}
      />
    </mesh>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   Lighting — one warm gold key + a bright rim point, matching the same
   fixture pattern used by GenesisBackground/ClassifiedBlueprintBg.
   ═══════════════════════════════════════════════════════════════════════════ */
function Lighting() {
  return (
    <>
      <ambientLight intensity={0.12} />
      <directionalLight position={[-2, 3, 3]} intensity={0.5} color={GOLD} />
      <pointLight position={[1.6, 0.6, 2.6]} intensity={1.5} distance={9} decay={2} color={GOLD_BRIGHT} />
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   SceneContents / Post
   ═══════════════════════════════════════════════════════════════════════════ */
function SceneContents({
  tier,
  reducedMotion,
  mouse,
  progress,
}: {
  tier: Tier;
  reducedMotion: boolean;
  mouse: React.MutableRefObject<MouseRef>;
  progress: React.MutableRefObject<number>;
}) {
  const bgCount = tier === "high" ? 42 : tier === "mid" ? 26 : 14;
  const fgCount = tier === "high" ? 16 : tier === "mid" ? 10 : 6;
  const dustCount = tier === "high" ? 90 : tier === "mid" ? 55 : 28;

  return (
    <>
      <Lighting />
      <fogExp2 attach="fog" args={[INK, 0.055]} />
      <Core progress={progress} reducedMotion={reducedMotion} />
      <ShardSwarm progress={progress} reducedMotion={reducedMotion} />
      <ShardField
        config={{ count: bgCount, spread: [10, 6, 3], scaleRange: [0.05, 0.14], speed: 0.35, parallax: 0.12, opacity: 0.22 }}
        mouse={mouse}
        reducedMotion={reducedMotion}
      />
      <ShardField
        config={{ count: fgCount, spread: [11, 6, 2], scaleRange: [0.12, 0.26], speed: 0.55, parallax: 0.32, opacity: 0.3 }}
        mouse={mouse}
        reducedMotion={reducedMotion}
      />
      <Dust count={dustCount} reducedMotion={reducedMotion} />
      {tier !== "low" && <Embers reducedMotion={reducedMotion} />}
      <ReflectiveFloor tier={tier} />
    </>
  );
}

function Post({ tier }: { tier: Tier }) {
  if (tier === "low") return null;
  return (
    <EffectComposer multisampling={0} enableNormalPass={false}>
      <Bloom intensity={0.7} luminanceThreshold={0.65} luminanceSmoothing={0.3} mipmapBlur radius={0.5} />
    </EffectComposer>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   Top-level component
   ═══════════════════════════════════════════════════════════════════════════ */
export default function RegisterScene() {
  const hostRef = useRef<HTMLDivElement>(null);
  const mouseRef = useRef<MouseRef>({ x: 0, y: 0 });
  const progressRef = useRef(0);
  const hasPlayedRef = useRef(false);

  const [mode, setMode] = useState<"unknown" | "three" | "fallback">("unknown");
  const [tier, setTier] = useState<Tier>("high");
  const [frameloop, setFrameloop] = useState<"always" | "never" | "demand">("never");
  const [reducedMotion, setReducedMotion] = useState(false);
  const [inView, setInView] = useState(false);

  /* ── capability + reduced-motion detection ── */
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
      setReducedMotion(reduced.matches);
      setMode(hasWebGL2 ? "three" : "fallback");
    };
    decide();
    reduced.addEventListener("change", decide);

    const cores = navigator.hardwareConcurrency ?? 4;
    const coarse = window.matchMedia("(hover: none)").matches;
    const narrow = window.innerWidth < 768;
    if (coarse || narrow || cores <= 4) setTier("mid");
    if (cores <= 2) setTier("low");

    return () => reduced.removeEventListener("change", decide);
  }, []);

  /* ── lazy-mount / pause when the section scrolls out of view ── */
  useEffect(() => {
    if (mode !== "three") return;
    const el = hostRef.current;
    if (!el) return;
    const section = el.closest("section") ?? el;
    const io = new IntersectionObserver(
      ([entry]) => {
        setInView(entry.isIntersecting);
        if (entry.isIntersecting) hasPlayedRef.current = true;
      },
      { threshold: 0.05 }
    );
    io.observe(section);
    return () => io.disconnect();
  }, [mode]);

  useEffect(() => {
    if (mode !== "three") return;
    if (reducedMotion) {
      progressRef.current = 1; // settle immediately, no assembly intro
      setFrameloop("demand");
      return;
    }
    setFrameloop(inView ? "always" : "never");
  }, [mode, inView, reducedMotion]);

  /* ── one-shot assembly progress — plays once per page load ── */
  useEffect(() => {
    if (mode !== "three" || reducedMotion || !inView) return;
    if (progressRef.current >= 1) return;
    let raf = 0;
    let start = 0;
    const DURATION = 3600; // ms, matches the ~3.5s assembly window in the brief
    const tick = (now: number) => {
      if (!start) start = now;
      const p = clamp01((now - start) / DURATION);
      progressRef.current = p;
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [mode, reducedMotion, inView]);

  /* ── pointer parallax (desktop only) ── */
  useEffect(() => {
    if (mode !== "three") return;
    if (window.matchMedia("(hover: none)").matches) return;
    const onMove = (e: PointerEvent) => {
      const el = hostRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      mouseRef.current.x = ((e.clientX - r.left) / r.width) * 2 - 1;
      mouseRef.current.y = -(((e.clientY - r.top) / r.height) * 2 - 1);
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => window.removeEventListener("pointermove", onMove);
  }, [mode]);

  const onDecline = useCallback(() => {
    setTier((t) => (t === "high" ? "mid" : "low"));
  }, []);

  if (mode === "fallback") {
    return <div className="reg-scene-canvas reg-scene-canvas--fallback" aria-hidden="true" />;
  }
  if (mode === "unknown") return null;

  return (
    <div ref={hostRef} className="reg-scene-canvas" aria-hidden="true">
      <Canvas
        frameloop={frameloop}
        dpr={[1, 2]}
        gl={{ antialias: false, alpha: true, powerPreference: "high-performance", stencil: false }}
        camera={{ fov: 36, position: [0, 0.4, 8], near: 0.1, far: 40 }}
        style={{ background: "transparent" }}
        onCreated={({ gl }) => {
          gl.setClearColor(new THREE.Color(INK), 0);
          gl.toneMapping = THREE.ACESFilmicToneMapping;
        }}
      >
        <PerformanceMonitor onDecline={onDecline} flipflops={3} onFallback={() => setTier("low")}>
          <SceneContents tier={tier} reducedMotion={reducedMotion} mouse={mouseRef} progress={progressRef} />
          <Post tier={tier} />
        </PerformanceMonitor>
      </Canvas>
    </div>
  );
}
