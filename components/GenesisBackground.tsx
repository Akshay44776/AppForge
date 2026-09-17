"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { PerformanceMonitor } from "@react-three/drei";
import {
  Bloom,
  ChromaticAberration,
  EffectComposer,
  Noise,
  Vignette,
} from "@react-three/postprocessing";
import { BlendFunction } from "postprocessing";

import BlueprintBackground from "./BlueprintBackground";
import CameraRig from "./genesis/CameraRig";
import ParticleField from "./genesis/ParticleField";
import PhoneRig from "./genesis/PhoneRig";
import PromptTypewriter from "./genesis/PromptTypewriter";
import ScanlineSweep from "./genesis/ScanlineSweep";
import UIAssembly from "./genesis/UIAssembly";

import {
  CAMERA,
  POST,
  TOKENS,
  createSceneState,
  updateSceneState,
  type SceneState,
} from "@/lib/genesisScene";

/* ═══════════════════════════════════════════════════════════════════════════
   GenesisBackground — ambient 3D background for the #tracks section.

   Drop-in replacement for <BlueprintBackground />, which it keeps and reuses
   as the fallback for reduced-motion and for browsers without WebGL2.

   It is deliberately an ENVIRONMENT, not a hero: canvas opacity is capped,
   bloom is threshold-gated to gold only, and a vignette overlay sits between
   the canvas and the dossier cards so paper-white text on --surface stays
   fully legible over the busiest frame of the assembly.
   ═══════════════════════════════════════════════════════════════════════════ */

type Tier = "high" | "mid" | "low";

/* ─────────────────────────────────────────────────────────────────────────
   SceneDirector — writes the shared state object once per frame.

   Mounted as the FIRST child of the canvas so its useFrame subscription runs
   before every other one (R3F preserves insertion order within a priority).
   All callbacks stay at priority 0 — assigning any non-zero priority would
   disable R3F's automatic render, which is not what we want here.
   ───────────────────────────────────────────────────────────────────────── */
function SceneDirector({
  state,
  running,
}: {
  state: SceneState;
  running: React.MutableRefObject<boolean>;
}) {
  const clock = useRef(0);
  const { gl, scene } = useThree();

  /* exp2 fog, --ink coloured, so particles and panel edges fall off at depth
     instead of ending abruptly at the far plane. */
  useEffect(() => {
    scene.fog = new THREE.FogExp2(new THREE.Color(TOKENS.ink), 0.145);
    return () => {
      scene.fog = null;
    };
  }, [scene]);

  useEffect(() => {
    gl.setClearColor(new THREE.Color(TOKENS.ink), 0);
  }, [gl]);

  useFrame((_, rawDelta) => {
    /* Clamped delta: returning to a backgrounded tab must not fast-forward
       the loop through three whole cycles in one frame. */
    const dt = Math.min(rawDelta, 1 / 20);
    if (running.current) clock.current += dt;
    updateSceneState(state, clock.current);
  });

  return null;
}

/* ─────────────────────────────────────────────────────────────────────────
   Lighting — three fixed sources.
   The custom materials do most of their own shading, so these exist mainly
   to seat the scene: ambient stops blacks crushing to zero, the gold key
   sits behind/above for the fresnel rim, the cool fill barely registers.
   ───────────────────────────────────────────────────────────────────────── */
function Lighting() {
  return (
    <>
      <ambientLight intensity={0.15} />
      <directionalLight
        position={[-2.4, 3.6, 2.2]}
        intensity={0.55}
        color={TOKENS.gold}
      />
      <directionalLight
        position={[2.0, -2.4, 1.4]}
        intensity={0.12}
        color={TOKENS.muted}
      />
      {/* Rim from directly behind — separates the chassis silhouette from
          the fog without lighting the face. */}
      <pointLight
        position={[0.4, 0.8, -1.6]}
        intensity={2.2}
        distance={5}
        decay={2}
        color={TOKENS.goldBright}
      />
    </>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   Scene graph
   ───────────────────────────────────────────────────────────────────────── */
function Scene({
  state,
  running,
  tier,
}: {
  state: SceneState;
  running: React.MutableRefObject<boolean>;
  tier: Tier;
}) {
  return (
    <>
      <SceneDirector state={state} running={running} />
      <CameraRig state={state} />
      <Lighting />

      <PhoneRig state={state}>
        <UIAssembly state={state} />
        <ScanlineSweep state={state} />
        <ParticleField state={state} tier={tier} />
        <PromptTypewriter state={state} />
      </PhoneRig>
    </>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   Post-processing
   ───────────────────────────────────────────────────────────────────────── */
function Post({ tier }: { tier: Tier }) {
  const chromaOffset = useMemo(
    () => new THREE.Vector2(POST.chromaticOffset, POST.chromaticOffset * 0.6),
    []
  );

  /* On low-tier devices the whole composer is dropped — the scene still
     reads correctly, it just loses the glow. That is a far better trade than
     a stuttering bloom pass. */
  if (tier === "low") return null;

  return (
    <EffectComposer multisampling={0} enableNormalPass={false}>
      {/* Threshold 0.72 with tight smoothing: only gold-emissive surfaces
          (the wireframe outlines, the caret, the underlines, the hot motes)
          cross it. The chassis is hard-clamped to 0.62 in its own shader, so
          it can never bloom no matter how the lighting is tuned. */}
      <Bloom
        intensity={POST.bloomIntensity}
        luminanceThreshold={POST.bloomThreshold}
        luminanceSmoothing={POST.bloomSmoothing}
        mipmapBlur
        radius={0.62}
      />
      <ChromaticAberration
        offset={chromaOffset}
        radialModulation={false}
        modulationOffset={0}
        blendFunction={BlendFunction.NORMAL}
      />
      {/* `cond && <X/>` yields `false`, which EffectComposer drops cleanly.
         An empty fragment would NOT be dropped and breaks the effect chain. */}
      {(tier === "high" && (
        <Noise opacity={POST.noiseOpacity} blendFunction={BlendFunction.OVERLAY} />
      )) as any}
      <Vignette
        eskil={false}
        offset={0.28}
        darkness={POST.vignetteDarkness}
      />
    </EffectComposer>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   Top-level component
   ═══════════════════════════════════════════════════════════════════════════ */
export default function GenesisBackground() {
  const hostRef = useRef<HTMLDivElement>(null);

  /* One state object for the whole scene's lifetime. Mutated in place, never
     set — so the 60fps loop triggers exactly zero React re-renders. */
  const state = useMemo(() => createSceneState(), []);
  const running = useRef(false);

  /* "unknown" until we've checked on the client, so SSR and the first client
     render agree and there's no hydration mismatch. */
  const [mode, setMode] = useState<"unknown" | "three" | "fallback">("unknown");
  const [tier, setTier] = useState<Tier>("high");
  const [frameloop, setFrameloop] = useState<"always" | "never">("never");

  /* ── Capability + preference detection ────────────────────────────────── */
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
      /* Three independent reasons to fall back to the 2D canvas:
           1. the user asked for reduced motion,
           2. the browser has no WebGL2,
           3. the viewport is too narrow to HAVE a gutter — below
              POST.panelMinWidth, .wrap spans the full width and a side panel
              would sit under the cards again, which is the exact problem
              this layout change exists to fix. */
      const wide = window.innerWidth >= POST.panelMinWidth;
      if (reduced.matches || !hasWebGL2 || !wide) {
        setMode("fallback");
        return;
      }
      setMode("three");
    };

    decide();
    reduced.addEventListener("change", decide);
    window.addEventListener("resize", decide, { passive: true });

    /* Initial tier from cheap, reliable signals. PerformanceMonitor refines
       it from there once frames are actually being measured. */
    const cores = navigator.hardwareConcurrency ?? 4;
    const coarse = window.matchMedia("(hover: none)").matches;
    const narrow = window.innerWidth < 768;
    if (coarse || narrow || cores <= 4) setTier("mid");
    if (cores <= 2) setTier("low");

    return () => {
      reduced.removeEventListener("change", decide);
      window.removeEventListener("resize", decide);
    };
  }, []);

  /* ── Pause when #tracks is off-screen ─────────────────────────────────────
     Mirrors the IntersectionObserver pattern in BlueprintBackground: the
     render loop is not throttled, it is stopped. frameloop="never" means R3F
     does not schedule a single rAF, so GPU usage goes to zero. */
  useEffect(() => {
    if (mode !== "three") return;
    const el = hostRef.current;
    if (!el) return;

    const io = new IntersectionObserver(
      ([entry]) => {
        const on = entry.isIntersecting;
        running.current = on;
        setFrameloop(on ? "always" : "never");
      },
      { threshold: 0.02 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [mode]);

  /* ── Scroll progress of the host section, written straight into state ──── */
  useEffect(() => {
    if (mode !== "three") return;
    const el = hostRef.current;
    if (!el) return;

    let raf = 0;
    const read = () => {
      raf = 0;
      const r = el.getBoundingClientRect();
      const vh = window.innerHeight || 1;
      /* 0 as the section's top reaches the bottom of the viewport,
         1 as its bottom leaves the top. */
      const p = (vh - r.top) / (vh + r.height);
      state.scroll = Math.min(1, Math.max(0, p));
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(read);
    };

    read();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    return () => {
      if (raf) cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [mode, state]);

  /* ── Pointer parallax (desktop only; a coarse pointer has no hover) ────── */
  useEffect(() => {
    if (mode !== "three") return;
    if (window.matchMedia("(hover: none)").matches) return;

    const onMove = (e: PointerEvent) => {
      state.mouseX = (e.clientX / window.innerWidth) * 2 - 1;
      state.mouseY = -((e.clientY / window.innerHeight) * 2 - 1);
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => window.removeEventListener("pointermove", onMove);
  }, [mode, state]);

  /* ── PerformanceMonitor callbacks ─────────────────────────────────────── */
  const onDecline = useCallback(() => {
    setTier((t) => (t === "high" ? "mid" : "low"));
    state.quality = 0.7;
  }, [state]);

  const onIncline = useCallback(() => {
    state.quality = 1;
  }, [state]);

  /* ── Fallback: the existing 2D canvas, untouched ──────────────────────── */
  if (mode !== "three") {
    return <BlueprintBackground />;
  }

  return (
    <div
      ref={hostRef}
      /* The scene lives in the empty gutter to the RIGHT of .wrap, not behind
         it. Previously this was `absolute inset-0`, which put the phone
         directly underneath the dossier cards where it was almost entirely
         occluded. .wrap is max-w-6xl and centred, so on wide viewports there
         is a real column of dead space on either side; this claims the right
         one. It still sits at z-0, below `.wrap`'s z-10, so nothing can
         overlap the copy even at the widest framing. */
      className="absolute inset-y-0 right-0 pointer-events-none"
      style={{ zIndex: 0, width: POST.panelWidth }}
      aria-hidden="true"
    >
      <div
        className="absolute inset-0"
        style={{
          opacity: POST.canvasOpacity,
          /* Feather every edge so the panel dissolves into the section
             instead of reading as a hard-edged video box. Weighted toward
             75% across, so the fade is strongest on the left edge — the one
             facing the text. */
          maskImage:
            "radial-gradient(ellipse 120% 90% at 50% 50%, #000 50%, transparent 100%)",
          WebkitMaskImage:
            "radial-gradient(ellipse 120% 90% at 50% 50%, #000 50%, transparent 100%)",
        }}
      >
        <Canvas
          frameloop={frameloop}
          /* DPR clamped to 2 — beyond that the cost is real and the visible
             difference on an ambient background is not. */
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
            position: CAMERA.base,
            near: 0.1,
            far: 40,
          }}
          onCreated={({ gl }) => {
            gl.setClearColor(new THREE.Color(TOKENS.ink), 0);
            gl.toneMapping = THREE.ACESFilmicToneMapping;
            gl.toneMappingExposure = 1.05;
          }}
        >
          <PerformanceMonitor
            onDecline={onDecline}
            onIncline={onIncline}
            flipflops={3}
            /* After three flip-flops, stop adapting and stay at the lower
               setting rather than oscillating for the rest of the session. */
            onFallback={() => setTier("low")}
          >
            <Scene state={state} running={running} tier={tier} />
            <Post tier={tier} />
          </PerformanceMonitor>
        </Canvas>
      </div>
    </div>
  );
}
