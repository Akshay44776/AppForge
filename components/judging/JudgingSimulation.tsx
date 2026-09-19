"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import * as THREE from "three";
import { Canvas } from "@react-three/fiber";
import { PerformanceMonitor } from "@react-three/drei";
import { Bloom, EffectComposer, Vignette } from "@react-three/postprocessing";

import JudgingWall from "../JudgingWall";
import SimulationBackground from "../SimulationBackground";
import JudgingScene, { type LiveColors } from "./JudgingScene";
import { CRITERIA, DEFAULT_INDEX, TOTAL } from "./criteria";
import { createSimState, finale, focus, updateSim } from "./simState";

/* ═══════════════════════════════════════════════════════════════════════════
   JudgingSimulation — the "How teams are judged" section.

   A WebGL stage (shell, core, beams, particle glyph) with a crisp HTML layer
   on top for anything that has to stay readable and selectable: the progress
   ring, the description, and the six-card dock.

   Nothing else on the site changes. When WebGL is unavailable or the visitor
   asked for reduced motion, this renders the existing <JudgingWall /> exactly
   as it is today.
   ═══════════════════════════════════════════════════════════════════════════ */

type Tier = "high" | "mid" | "low";

export default function JudgingSimulation() {
  const sim = useMemo(() => createSimState(), []);
  const colors = useMemo<LiveColors>(
    () => ({
      cur: new THREE.Color(CRITERIA[DEFAULT_INDEX].accent),
      hi: new THREE.Color(CRITERIA[DEFAULT_INDEX].accentHi),
    }),
    []
  );

  const [mode, setMode] = useState<"unknown" | "three" | "fallback">("unknown");
  const [tier, setTier] = useState<Tier>("high");
  const [frameloop, setFrameloop] = useState<"always" | "never">("never");
  const [active, setActive] = useState(-1);

  const hostRef = useRef<HTMLElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);
  const labelRef = useRef<HTMLDivElement>(null);
  const descRef = useRef<HTMLParagraphElement>(null);
  const descBoxRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const liveRef = useRef<HTMLParagraphElement>(null);

  const interacted = useRef(false);
  const autoTimer = useRef<number | null>(null);
  const hoverTimer = useRef<number | null>(null);
  const canHover = useRef(false);
  const btnRefs = useRef<(HTMLButtonElement | null)[]>([]);

  /* ── capability + preference detection ────────────────────────────────── */
  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const hasWebGL2 = (() => {
      try {
        return !!document.createElement("canvas").getContext("webgl2");
      } catch {
        return false;
      }
    })();

    const decide = () => setMode(reduced.matches || !hasWebGL2 ? "fallback" : "three");
    decide();
    reduced.addEventListener("change", decide);

    const cores = navigator.hardwareConcurrency ?? 4;
    const coarse = window.matchMedia("(hover: none)").matches;
    canHover.current = !coarse;
    if (coarse || window.innerWidth < 900 || cores <= 4) setTier("mid");
    if (cores <= 2) setTier("low");

    return () => reduced.removeEventListener("change", decide);
  }, []);

  /* ── selection ────────────────────────────────────────────────────────── */
  const select = useCallback(
    (index: number, byUser: boolean) => {
      if (byUser) {
        interacted.current = true;
        if (autoTimer.current) {
          window.clearTimeout(autoTimer.current);
          autoTimer.current = null;
        }
      }
      focus(sim, index);
      setActive(index);
      const c = CRITERIA[index];
      if (liveRef.current) {
        liveRef.current.textContent = `${c.title}, ${c.index} of ${TOTAL}. ${c.description}`;
      }
    },
    [sim]
  );

  /* ── pause the whole stage whenever it is off-screen ──────────────────── */
  useEffect(() => {
    if (mode !== "three") return;
    const el = hostRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        const on = entry.isIntersecting;
        sim.running = on;
        setFrameloop(on ? "always" : "never");
      },
      { threshold: 0 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [mode, sim]);

  /* ── the first time the stage itself is properly in view, focus a card so
        the section is never sitting there empty ─────────────────────────── */
  useEffect(() => {
    if (mode !== "three") return;
    const el = stageRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        io.disconnect();
        if (interacted.current || sim.selected >= 0) return;
        autoTimer.current = window.setTimeout(() => {
          autoTimer.current = null;
          if (!interacted.current) select(DEFAULT_INDEX, false);
        }, 2000);
      },
      { threshold: 0.45 }
    );
    io.observe(el);
    return () => {
      io.disconnect();
      if (autoTimer.current) window.clearTimeout(autoTimer.current);
    };
  }, [mode, sim, select]);

  /* ── pointer parallax ─────────────────────────────────────────────────── */
  useEffect(() => {
    if (mode !== "three") return;
    if (window.matchMedia("(hover: none)").matches) return;
    const el = stageRef.current;
    if (!el) return;
    const onMove = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      sim.mouseX = ((e.clientX - r.left) / r.width) * 2 - 1;
      sim.mouseY = -(((e.clientY - r.top) / r.height) * 2 - 1);
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => window.removeEventListener("pointermove", onMove);
  }, [mode, sim]);

  /* ── the clock: one rAF drives the simulation and repaints the overlay ─── */
  useEffect(() => {
    if (mode !== "three") return;
    let raf = 0;
    let last = 0;

    /* the loop runs at 60fps, so every write is gated on an actual change:
       rewriting these text nodes every frame would force a layout for nothing */
    const prev = {
      label: -1,
      desc: -1,
      ringOp: -1,
      descOp: -1,
      id: "",
    };

    const paint = () => {
      const v = sim.v;
      const c = CRITERIA[sim.selected >= 0 ? sim.selected : DEFAULT_INDEX];
      const changed = prev.id !== c.id;
      if (changed) prev.id = c.id;

      const ringOp = Math.round(Math.min(1, v.glyphIn * 1.6) * 100) / 100;
      if (ringRef.current && ringOp !== prev.ringOp) {
        prev.ringOp = ringOp;
        ringRef.current.style.opacity = String(ringOp);
      }

      const ln = Math.round(v.type * c.ringLabel.length);
      if (labelRef.current && (ln !== prev.label || changed)) {
        prev.label = ln;
        labelRef.current.textContent = c.ringLabel.slice(0, ln);
      }

      const dn = Math.round(Math.min(1, v.type * 1.15) * c.description.length);
      if (descRef.current && (dn !== prev.desc || changed)) {
        prev.desc = dn;
        descRef.current.textContent = c.description.slice(0, dn);
      }

      const descOp = Math.round(Math.min(1, v.type * 4) * 100) / 100;
      if (descBoxRef.current && descOp !== prev.descOp) {
        prev.descOp = descOp;
        descBoxRef.current.style.opacity = String(descOp);
      }
    };

    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      if (!last) last = now;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (!sim.running) return;
      updateSim(sim, dt);
      paint();
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [mode, sim]);

  /* ── dock: slide the strip so the chosen card sits dead centre ─────────── */
  const placed = useRef(false);

  const slide = useCallback(() => {
    const track = trackRef.current;
    if (!track) return;
    const items = track.children;
    if (items.length < 2) return;
    const a = items[0] as HTMLElement;
    const b = items[1] as HTMLElement;
    const pitch = b.offsetLeft - a.offsetLeft;
    const idx = active >= 0 ? active : DEFAULT_INDEX;
    const centre = idx * pitch + a.offsetWidth / 2;

    /* the very first placement is a jump, not a slide — otherwise the dock
       visibly glides in from the left on page load */
    if (!placed.current) {
      placed.current = true;
      track.style.transition = "none";
      track.style.transform = `translateX(${-centre}px)`;
      void track.offsetWidth;
      track.style.transition = "";
      return;
    }
    track.style.transform = `translateX(${-centre}px)`;
  }, [active]);

  useLayoutEffect(() => {
    slide();
  }, [slide]);

  useEffect(() => {
    if (mode !== "three") return;
    const onResize = () => slide();
    window.addEventListener("resize", onResize, { passive: true });
    return () => window.removeEventListener("resize", onResize);
  }, [mode, slide]);

  /* ── hover to focus.

     Deliberately driven by pointermove and not pointerenter: picking a card
     slides the strip, and a moving strip would otherwise walk new cards under
     a stationary cursor and fire selection after selection. A short dwell
     keeps a fast sweep across the dock from triggering six runs. ─────────── */
  const hoverSelect = useCallback(
    (i: number) => {
      /* touch devices never hover-select: there a pointermove is a scroll */
      if (!canHover.current) return;
      if (i === active) return;
      if (hoverTimer.current) window.clearTimeout(hoverTimer.current);
      hoverTimer.current = window.setTimeout(() => {
        hoverTimer.current = null;
        select(i, true);
      }, 230);
    },
    [active, select]
  );

  const cancelHover = useCallback(() => {
    if (hoverTimer.current) {
      window.clearTimeout(hoverTimer.current);
      hoverTimer.current = null;
    }
  }, []);

  useEffect(() => () => cancelHover(), [cancelHover]);

  /* ── keyboard ─────────────────────────────────────────────────────────── */
  const go = (next: number) => {
    select(next, true);
    /* a tablist moves focus with the selection, or the next arrow press
       would start from the card the user already left */
    btnRefs.current[next]?.focus();
  };

  const onKey = (e: ReactKeyboardEvent<HTMLButtonElement>, i: number) => {
    if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      e.preventDefault();
      go((i + 1) % TOTAL);
    } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      e.preventDefault();
      go((i - 1 + TOTAL) % TOTAL);
    } else if (e.key === "Home") {
      e.preventDefault();
      go(0);
    } else if (e.key === "End") {
      e.preventDefault();
      go(TOTAL - 1);
    }
  };

  if (mode !== "three") return <JudgingWall />;

  const shown = CRITERIA[active >= 0 ? active : DEFAULT_INDEX];

  return (
    <section
      id="evaluation"
      className="relative overflow-hidden"
      ref={hostRef}
      style={{
        /* the stage is tall and mostly empty at the top, so the usual
           section-pad left a dead band under the twist deck */
        marginTop: "clamp(-7rem, -7vw, -2rem)",
        paddingTop: "clamp(1rem, 2.5vw, 2rem)",
        paddingBottom: "clamp(3rem, 7vw, 5.5rem)",
      }}
    >
      <SimulationBackground variant="judging" />
      <div className="wrap relative z-10">
        <div className="text-center mb-10">
          <p className="kicker mb-3">Judging</p>
          <h2 className="font-display text-3xl sm:text-5xl leading-tight">
            How teams are judged
          </h2>
          <p className="mt-5 text-muted leading-relaxed mx-auto" style={{ maxWidth: "60ch" }}>
            Six criteria. Hover or tap a card to bring it into focus.
          </p>
        </div>
      </div>

      <div
        ref={stageRef}
        className="jsim-stage"
        style={
          {
            "--jaccent": shown.accent,
            "--jaccent-hi": shown.accentHi,
          } as CSSProperties
        }
      >
        <Canvas
          frameloop={frameloop}
          dpr={[1, tier === "high" ? 1.75 : 1.4]}
          gl={{
            antialias: tier === "high",
            alpha: true,
            powerPreference: "high-performance",
            stencil: false,
          }}
          camera={{ fov: 32, position: [0, 1.1, 10.4], near: 0.1, far: 60 }}
          onCreated={({ gl }) => {
            gl.setClearColor(new THREE.Color("#07090d"), 0);
            gl.toneMapping = THREE.ACESFilmicToneMapping;
            gl.toneMappingExposure = 1.04;
          }}
        >
          <PerformanceMonitor
            flipflops={3}
            onDecline={() => setTier((t) => (t === "high" ? "mid" : "low"))}
            onFallback={() => setTier("low")}
          >
            <JudgingScene
              sim={sim}
              colors={colors}
              tier={tier}
              onCoreClick={() => {
                interacted.current = true;
                if (sim.selected < 0) select(DEFAULT_INDEX, true);
                finale(sim);
              }}
              ringAnchorRef={ringRef}
            />
            {tier !== "low" && (
              <EffectComposer multisampling={0} enableNormalPass={false}>
                <Bloom
                  intensity={0.62}
                  luminanceThreshold={0.34}
                  luminanceSmoothing={0.3}
                  mipmapBlur
                  radius={0.62}
                />
                <Vignette eskil={false} offset={0.3} darkness={0.55} />
              </EffectComposer>
            )}
          </PerformanceMonitor>
        </Canvas>

        {/* ── crisp HTML layer ── */}
        <div className="jsim-overlay" aria-hidden="true">
          <div className="jsim-counter">
            <span>{String(shown.index).padStart(2, "0")}</span> / {String(TOTAL).padStart(2, "0")}
          </div>

          <div className="jsim-desc" ref={descBoxRef}>
            <p className="jsim-desc-h">Description</p>
            <p className="jsim-desc-b" ref={descRef} />
          </div>

          <div className="jsim-ring" ref={ringRef}>
            <div className="jsim-ringlabel" ref={labelRef} />
          </div>
        </div>

        <button
          type="button"
          className="jsim-overview"
          onClick={() => {
            interacted.current = true;
            if (sim.selected < 0) select(DEFAULT_INDEX, true);
            finale(sim);
          }}
        >
          Overview
        </button>

        {/* ── dock ── */}
        <div className="jsim-dock">
          <div
            className="jsim-dock-track"
            ref={trackRef}
            role="tablist"
            aria-label="Judging criteria"
          >
            {CRITERIA.map((c, i) => {
              const d = Math.abs(i - (active >= 0 ? active : DEFAULT_INDEX));
              const isActive = i === active;
              return (
                <button
                  key={c.id}
                  ref={(el) => {
                    btnRefs.current[i] = el;
                  }}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  tabIndex={isActive || (active < 0 && i === DEFAULT_INDEX) ? 0 : -1}
                  className={`jsim-card${isActive ? " is-active" : ""}`}
                  style={
                    {
                      "--c": c.accent,
                      "--c-hi": c.accentHi,
                      transform: `scale(${1 - Math.min(d, 3) * 0.045})`,
                      opacity: 1 - Math.min(d, 3) * 0.16,
                    } as CSSProperties
                  }
                  onClick={() => {
                    cancelHover();
                    select(i, true);
                  }}
                  onPointerMove={() => hoverSelect(i)}
                  onPointerLeave={cancelHover}
                  onFocus={() => select(i, true)}
                  onKeyDown={(e) => onKey(e, i)}
                >
                  <svg
                    className="jsim-card-icon"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    {c.icon.map((d2, k) => (
                      <path key={k} d={d2} />
                    ))}
                  </svg>
                  <span className="jsim-card-title">
                    {c.titleLines.map((l, k) => (
                      <span key={k}>{l}</span>
                    ))}
                  </span>
                  <span className="jsim-card-tag">{c.tagline}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* description repeated in flow for narrow screens + screen readers */}
      <div className="wrap relative z-10">
        <p className="jsim-desc-flow">{shown.description}</p>
        <p className="sr-only" aria-live="polite" ref={liveRef} />
      </div>
    </section>
  );
}
