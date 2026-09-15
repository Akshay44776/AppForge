"use client";

import { useCallback, useEffect, useRef } from "react";

/* ═══════════════════════════════════════════════════════════════════════════
   BlueprintBackground — "App wireframe assembling, then glitching away"
   Loops indefinitely behind the Three Problem Statements section.
   ═══════════════════════════════════════════════════════════════════════════ */

const GOLD = { r: 217, g: 169, b: 74 }; // #d9a94a

/* ─── Wireframe shape definitions ─── */
interface WireShape {
  // Each shape is an array of line segments relative to the phone frame
  lines: { x1: number; y1: number; x2: number; y2: number }[];
}

// Different app layout wireframes — each cycle picks a random one
const WIREFRAME_LAYOUTS: WireShape[] = [
  {
    // Layout A: navbar + 2 cards + button
    lines: [
      { x1: 0, y1: 0.08, x2: 1, y2: 0.08 },     // navbar bottom
      { x1: 0.1, y1: 0.04, x2: 0.4, y2: 0.04 },  // navbar title
      { x1: 0.7, y1: 0.03, x2: 0.9, y2: 0.05 },  // navbar icon
      { x1: 0.08, y1: 0.12, x2: 0.92, y2: 0.12 }, // card 1 top
      { x1: 0.08, y1: 0.12, x2: 0.08, y2: 0.35 }, // card 1 left
      { x1: 0.92, y1: 0.12, x2: 0.92, y2: 0.35 }, // card 1 right
      { x1: 0.08, y1: 0.35, x2: 0.92, y2: 0.35 }, // card 1 bottom
      { x1: 0.15, y1: 0.18, x2: 0.55, y2: 0.18 }, // text line 1
      { x1: 0.15, y1: 0.23, x2: 0.7, y2: 0.23 },  // text line 2
      { x1: 0.15, y1: 0.28, x2: 0.45, y2: 0.28 }, // text line 3
      { x1: 0.08, y1: 0.42, x2: 0.92, y2: 0.42 }, // card 2 top
      { x1: 0.08, y1: 0.42, x2: 0.08, y2: 0.62 }, // card 2 left
      { x1: 0.92, y1: 0.42, x2: 0.92, y2: 0.62 }, // card 2 right
      { x1: 0.08, y1: 0.62, x2: 0.92, y2: 0.62 }, // card 2 bottom
      { x1: 0.15, y1: 0.48, x2: 0.6, y2: 0.48 },  // text line
      { x1: 0.15, y1: 0.53, x2: 0.75, y2: 0.53 }, // text line
      { x1: 0.25, y1: 0.72, x2: 0.75, y2: 0.72 }, // button top
      { x1: 0.25, y1: 0.72, x2: 0.25, y2: 0.78 }, // button left
      { x1: 0.75, y1: 0.72, x2: 0.75, y2: 0.78 }, // button right
      { x1: 0.25, y1: 0.78, x2: 0.75, y2: 0.78 }, // button bottom
      { x1: 0.38, y1: 0.75, x2: 0.62, y2: 0.75 }, // button label
      { x1: 0, y1: 0.88, x2: 1, y2: 0.88 },       // tab bar
      { x1: 0.15, y1: 0.93, x2: 0.25, y2: 0.93 }, // tab 1
      { x1: 0.4, y1: 0.93, x2: 0.6, y2: 0.93 },   // tab 2
      { x1: 0.75, y1: 0.93, x2: 0.85, y2: 0.93 }, // tab 3
    ],
  },
  {
    // Layout B: search bar + list items
    lines: [
      { x1: 0.08, y1: 0.05, x2: 0.92, y2: 0.05 }, // search top
      { x1: 0.08, y1: 0.05, x2: 0.08, y2: 0.1 },   // search left
      { x1: 0.92, y1: 0.05, x2: 0.92, y2: 0.1 },   // search right
      { x1: 0.08, y1: 0.1, x2: 0.92, y2: 0.1 },    // search bottom
      { x1: 0.15, y1: 0.075, x2: 0.5, y2: 0.075 }, // search placeholder
      { x1: 0.82, y1: 0.065, x2: 0.88, y2: 0.09 }, // search icon
      // List items (5 rows)
      ...Array.from({ length: 5 }, (_, i) => {
        const y = 0.16 + i * 0.13;
        return [
          { x1: 0.08, y1: y, x2: 0.18, y2: y },         // avatar circle approx
          { x1: 0.08, y1: y, x2: 0.08, y2: y + 0.08 },
          { x1: 0.18, y1: y, x2: 0.18, y2: y + 0.08 },
          { x1: 0.08, y1: y + 0.08, x2: 0.18, y2: y + 0.08 },
          { x1: 0.22, y1: y + 0.02, x2: 0.55, y2: y + 0.02 }, // name
          { x1: 0.22, y1: y + 0.06, x2: 0.7, y2: y + 0.06 },  // subtitle
          { x1: 0, y1: y + 0.1, x2: 1, y2: y + 0.1 },          // divider
        ];
      }).flat(),
      { x1: 0, y1: 0.88, x2: 1, y2: 0.88 },       // tab bar
      { x1: 0.15, y1: 0.93, x2: 0.25, y2: 0.93 },
      { x1: 0.4, y1: 0.93, x2: 0.6, y2: 0.93 },
      { x1: 0.75, y1: 0.93, x2: 0.85, y2: 0.93 },
    ],
  },
  {
    // Layout C: dashboard with chart placeholder
    lines: [
      { x1: 0, y1: 0.07, x2: 1, y2: 0.07 },       // header
      { x1: 0.1, y1: 0.035, x2: 0.5, y2: 0.035 },  // header title
      { x1: 0.08, y1: 0.12, x2: 0.48, y2: 0.12 },  // stat 1 top
      { x1: 0.08, y1: 0.12, x2: 0.08, y2: 0.22 },
      { x1: 0.48, y1: 0.12, x2: 0.48, y2: 0.22 },
      { x1: 0.08, y1: 0.22, x2: 0.48, y2: 0.22 },
      { x1: 0.15, y1: 0.15, x2: 0.35, y2: 0.15 },  // stat label
      { x1: 0.15, y1: 0.19, x2: 0.25, y2: 0.19 },  // stat number
      { x1: 0.52, y1: 0.12, x2: 0.92, y2: 0.12 },  // stat 2 top
      { x1: 0.52, y1: 0.12, x2: 0.52, y2: 0.22 },
      { x1: 0.92, y1: 0.12, x2: 0.92, y2: 0.22 },
      { x1: 0.52, y1: 0.22, x2: 0.92, y2: 0.22 },
      { x1: 0.58, y1: 0.15, x2: 0.78, y2: 0.15 },
      { x1: 0.58, y1: 0.19, x2: 0.68, y2: 0.19 },
      // Chart area
      { x1: 0.08, y1: 0.28, x2: 0.92, y2: 0.28 },
      { x1: 0.08, y1: 0.28, x2: 0.08, y2: 0.6 },
      { x1: 0.92, y1: 0.28, x2: 0.92, y2: 0.6 },
      { x1: 0.08, y1: 0.6, x2: 0.92, y2: 0.6 },
      // Chart line (simplified)
      { x1: 0.12, y1: 0.55, x2: 0.28, y2: 0.42 },
      { x1: 0.28, y1: 0.42, x2: 0.45, y2: 0.48 },
      { x1: 0.45, y1: 0.48, x2: 0.6, y2: 0.33 },
      { x1: 0.6, y1: 0.33, x2: 0.75, y2: 0.38 },
      { x1: 0.75, y1: 0.38, x2: 0.88, y2: 0.32 },
      // Bottom list
      { x1: 0.08, y1: 0.66, x2: 0.65, y2: 0.66 },
      { x1: 0.08, y1: 0.72, x2: 0.5, y2: 0.72 },
      { x1: 0.08, y1: 0.78, x2: 0.7, y2: 0.78 },
      { x1: 0, y1: 0.88, x2: 1, y2: 0.88 },
      { x1: 0.15, y1: 0.93, x2: 0.25, y2: 0.93 },
      { x1: 0.4, y1: 0.93, x2: 0.6, y2: 0.93 },
      { x1: 0.75, y1: 0.93, x2: 0.85, y2: 0.93 },
    ],
  },
];

/* ─── Instance: one wireframe building/glitching at a position ─── */
interface WireframeInstance {
  // Position & size of the phone frame in canvas coordinates
  cx: number;
  cy: number;
  phoneW: number;
  phoneH: number;
  // Which layout
  layoutIdx: number;
  // Phase timing (all in seconds)
  phaseStartTime: number;
  phase: "draw" | "hold" | "glitch" | "fade";
  drawDuration: number;   // 3-5s
  holdDuration: number;   // 1-2s
  glitchDuration: number; // 1.5-2.5s
  fadeDuration: number;   // 1-1.5s
  // Glitch offsets per line (computed once at glitch start)
  glitchOffsets: number[];
  opacity: number;
}

function randomLayout(): number {
  return Math.floor(Math.random() * WIREFRAME_LAYOUTS.length);
}

function isMobile() {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(hover: none)").matches || window.innerWidth < 768;
}

export default function BlueprintBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef(0);
  const visibleRef = useRef(false);
  const reducedRef = useRef(false);
  const instancesRef = useRef<WireframeInstance[]>([]);
  const lastTimeRef = useRef(0);

  /* ─── Create instances across the section ─── */
  const initInstances = useCallback((w: number, h: number) => {
    const mobile = isMobile();
    const count = mobile ? 1 : 3;
    const instances: WireframeInstance[] = [];

    // Distribute across the width
    const positions = mobile
      ? [{ cx: w * 0.5, cy: h * 0.45 }]
      : [
          { cx: w * 0.12, cy: h * 0.35 },
          { cx: w * 0.52, cy: h * 0.55 },
          { cx: w * 0.88, cy: h * 0.3 },
        ];

    const phoneH = mobile ? Math.min(h * 0.4, 200) : Math.min(h * 0.55, 280);
    const phoneW = phoneH * 0.48;

    for (let i = 0; i < count; i++) {
      const scale = 0.7 + Math.random() * 0.4;
      instances.push({
        cx: positions[i].cx,
        cy: positions[i].cy,
        phoneW: phoneW * scale,
        phoneH: phoneH * scale,
        layoutIdx: randomLayout(),
        phaseStartTime: -i * 3.5, // offset each instance
        phase: "draw",
        drawDuration: 3 + Math.random() * 2,
        holdDuration: 1 + Math.random(),
        glitchDuration: 1.5 + Math.random(),
        fadeDuration: 1 + Math.random() * 0.5,
        glitchOffsets: [],
        opacity: 1,
      });
    }
    instancesRef.current = instances;
  }, []);

  /* ─── Init canvas ─── */
  const initCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.parentElement?.getBoundingClientRect();
    if (!rect) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(rect.width * dpr);
    canvas.height = Math.round(rect.height * dpr);
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;

    initInstances(rect.width, rect.height);
  }, [initInstances]);

  /* ─── Draw a single wireframe instance ─── */
  const drawInstance = useCallback(
    (ctx: CanvasRenderingContext2D, inst: WireframeInstance, now: number) => {
      const layout = WIREFRAME_LAYOUTS[inst.layoutIdx];
      if (!layout) return;

      const elapsed = now - inst.phaseStartTime;
      const totalLines = layout.lines.length;

      // Phone frame bounds
      const left = inst.cx - inst.phoneW / 2;
      const top = inst.cy - inst.phoneH / 2;

      // Determine phase transitions
      let localElapsed = elapsed;
      let phase = inst.phase;

      if (localElapsed < 0) return; // not started yet (offset)

      // Compute cycle position
      const cycleDuration =
        inst.drawDuration + inst.holdDuration + inst.glitchDuration + inst.fadeDuration;
      const cycleElapsed = localElapsed % cycleDuration;

      let drawProgress = 0;
      let holdFlicker = 1;
      let glitchIntensity = 0;
      let fadeAlpha = 1;

      if (cycleElapsed < inst.drawDuration) {
        phase = "draw";
        drawProgress = cycleElapsed / inst.drawDuration;
      } else if (cycleElapsed < inst.drawDuration + inst.holdDuration) {
        phase = "hold";
        drawProgress = 1;
        // Subtle flicker
        const holdT = (cycleElapsed - inst.drawDuration) / inst.holdDuration;
        holdFlicker = 0.85 + Math.sin(holdT * Math.PI * 8) * 0.1 + Math.sin(holdT * Math.PI * 13) * 0.05;
      } else if (cycleElapsed < inst.drawDuration + inst.holdDuration + inst.glitchDuration) {
        phase = "glitch";
        drawProgress = 1;
        glitchIntensity =
          (cycleElapsed - inst.drawDuration - inst.holdDuration) / inst.glitchDuration;
        // Generate glitch offsets if not yet done for this cycle
        const cycleIdx = Math.floor(localElapsed / cycleDuration);
        if (inst.glitchOffsets.length === 0 || (inst as any)._lastGlitchCycle !== cycleIdx) {
          inst.glitchOffsets = layout.lines.map(() => (Math.random() - 0.5) * 2);
          (inst as any)._lastGlitchCycle = cycleIdx;
        }
      } else {
        phase = "fade";
        drawProgress = 1;
        fadeAlpha = 1 - (cycleElapsed - inst.drawDuration - inst.holdDuration - inst.glitchDuration) / inst.fadeDuration;
        glitchIntensity = 1;
        // Reset layout for next cycle
        const cycleIdx = Math.floor(localElapsed / cycleDuration);
        if ((inst as any)._lastLayoutCycle !== cycleIdx) {
          let newLayout = randomLayout();
          while (newLayout === inst.layoutIdx && WIREFRAME_LAYOUTS.length > 1) {
            newLayout = randomLayout();
          }
          inst.layoutIdx = newLayout;
          inst.glitchOffsets = [];
          (inst as any)._lastLayoutCycle = cycleIdx;
        }
      }

      if (fadeAlpha <= 0) return;

      const baseAlpha = 0.18 * holdFlicker * Math.max(0, fadeAlpha);

      // Draw phone outline (rounded rect)
      ctx.save();
      ctx.strokeStyle = `rgba(${GOLD.r},${GOLD.g},${GOLD.b},${baseAlpha * 0.6})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      const radius = 8;
      ctx.moveTo(left + radius, top);
      ctx.lineTo(left + inst.phoneW - radius, top);
      ctx.arcTo(left + inst.phoneW, top, left + inst.phoneW, top + radius, radius);
      ctx.lineTo(left + inst.phoneW, top + inst.phoneH - radius);
      ctx.arcTo(left + inst.phoneW, top + inst.phoneH, left + inst.phoneW - radius, top + inst.phoneH, radius);
      ctx.lineTo(left + radius, top + inst.phoneH);
      ctx.arcTo(left, top + inst.phoneH, left, top + inst.phoneH - radius, radius);
      ctx.lineTo(left, top + radius);
      ctx.arcTo(left, top, left + radius, top, radius);
      ctx.closePath();
      ctx.stroke();
      ctx.restore();

      // Draw wireframe lines up to drawProgress
      const linesVisible = Math.floor(drawProgress * totalLines);
      const partialProgress =
        drawProgress * totalLines - linesVisible; // 0..1 for the currently-drawing line

      for (let i = 0; i <= linesVisible && i < totalLines; i++) {
        const line = layout.lines[i];
        const isPartial = i === linesVisible;
        const lineProgress = isPartial ? partialProgress : 1;

        // Convert normalized coords to canvas coords
        let x1 = left + line.x1 * inst.phoneW;
        let y1 = top + line.y1 * inst.phoneH;
        let x2 = left + line.x2 * inst.phoneW;
        let y2 = top + line.y2 * inst.phoneH;

        // Interpolate for partial draw
        const ex = x1 + (x2 - x1) * lineProgress;
        const ey = y1 + (y2 - y1) * lineProgress;

        // Apply glitch displacement
        let glitchX = 0;
        if (phase === "glitch" || phase === "fade") {
          const offset = inst.glitchOffsets[i] || 0;
          glitchX = offset * glitchIntensity * inst.phoneW * 0.15;
          // Some lines fragment (skip drawing) at high glitch intensity
          if (glitchIntensity > 0.5 && Math.abs(offset) > 0.7) continue;
        }

        ctx.save();
        ctx.strokeStyle = `rgba(${GOLD.r},${GOLD.g},${GOLD.b},${baseAlpha})`;
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.moveTo(x1 + glitchX, y1);
        ctx.lineTo(isPartial ? ex + glitchX : x2 + glitchX, isPartial ? ey : y2);
        ctx.stroke();

        // Cursor dot at the tip of currently-drawing line
        if (isPartial && lineProgress > 0.01 && phase === "draw") {
          ctx.fillStyle = `rgba(${GOLD.r},${GOLD.g},${GOLD.b},${baseAlpha * 2.5})`;
          ctx.beginPath();
          ctx.arc(ex, ey, 2.5, 0, Math.PI * 2);
          ctx.fill();

          // Small glow around cursor
          const grad = ctx.createRadialGradient(ex, ey, 0, ex, ey, 8);
          grad.addColorStop(0, `rgba(${GOLD.r},${GOLD.g},${GOLD.b},${baseAlpha * 1.5})`);
          grad.addColorStop(1, `rgba(${GOLD.r},${GOLD.g},${GOLD.b},0)`);
          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.arc(ex, ey, 8, 0, Math.PI * 2);
          ctx.fill();
        }

        ctx.restore();
      }

      // Glitch: horizontal scan line
      if (phase === "glitch" && glitchIntensity > 0.2) {
        const scanY = top + (Math.sin(now * 3) * 0.5 + 0.5) * inst.phoneH;
        ctx.save();
        ctx.strokeStyle = `rgba(${GOLD.r},${GOLD.g},${GOLD.b},${0.12 * glitchIntensity})`;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(left - 5, scanY);
        ctx.lineTo(left + inst.phoneW + 5, scanY);
        ctx.stroke();
        ctx.restore();
      }
    },
    []
  );

  /* ─── Main draw loop ─── */
  const loop = useCallback(
    (timestamp: number) => {
      if (!visibleRef.current || reducedRef.current) return;

      const canvas = canvasRef.current;
      if (!canvas) {
        rafRef.current = requestAnimationFrame(loop);
        return;
      }
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = canvas.width / dpr;
      const h = canvas.height / dpr;

      // Delta time in seconds
      const now = timestamp / 1000;
      if (lastTimeRef.current === 0) lastTimeRef.current = now;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);

      // Draw all instances
      for (const inst of instancesRef.current) {
        drawInstance(ctx, inst, now);
      }

      // Soft vignette
      const vignetteGrad = ctx.createRadialGradient(
        w / 2, h / 2, Math.min(w, h) * 0.2,
        w / 2, h / 2, Math.max(w, h) * 0.65
      );
      vignetteGrad.addColorStop(0, "rgba(7,9,13,0)");
      vignetteGrad.addColorStop(1, "rgba(7,9,13,0.5)");
      ctx.fillStyle = vignetteGrad;
      ctx.fillRect(0, 0, w, h);

      rafRef.current = requestAnimationFrame(loop);
    },
    [drawInstance]
  );

  /* ─── Static frame for reduced-motion ─── */
  const drawStaticFrame = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = canvas.width / dpr;
    const h = canvas.height / dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    // Draw instances frozen at ~40% draw progress
    for (const inst of instancesRef.current) {
      inst.phaseStartTime = -inst.drawDuration * 0.4;
      drawInstance(ctx, inst, 0);
    }

    // Vignette
    const vignetteGrad = ctx.createRadialGradient(
      w / 2, h / 2, Math.min(w, h) * 0.2,
      w / 2, h / 2, Math.max(w, h) * 0.65
    );
    vignetteGrad.addColorStop(0, "rgba(7,9,13,0)");
    vignetteGrad.addColorStop(1, "rgba(7,9,13,0.5)");
    ctx.fillStyle = vignetteGrad;
    ctx.fillRect(0, 0, w, h);
  }, [drawInstance]);

  /* ─── Setup ─── */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Reduced motion
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    reducedRef.current = mq.matches;
    const onMotion = (e: MediaQueryListEvent) => {
      reducedRef.current = e.matches;
      if (e.matches) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = 0;
        drawStaticFrame();
      } else if (visibleRef.current) {
        rafRef.current = requestAnimationFrame(loop);
      }
    };
    mq.addEventListener("change", onMotion);

    initCanvas();

    // Intersection observer
    const io = new IntersectionObserver(
      ([entry]) => {
        visibleRef.current = entry.isIntersecting;
        if (entry.isIntersecting) {
          if (reducedRef.current) {
            drawStaticFrame();
          } else if (rafRef.current === 0) {
            lastTimeRef.current = 0;
            rafRef.current = requestAnimationFrame(loop);
          }
        } else {
          cancelAnimationFrame(rafRef.current);
          rafRef.current = 0;
        }
      },
      { threshold: 0.05 }
    );
    io.observe(canvas);

    // Resize
    const onResize = () => {
      initCanvas();
      if (reducedRef.current) drawStaticFrame();
    };
    window.addEventListener("resize", onResize);

    return () => {
      mq.removeEventListener("change", onMotion);
      cancelAnimationFrame(rafRef.current);
      rafRef.current = 0;
      io.disconnect();
      window.removeEventListener("resize", onResize);
    };
  }, [initCanvas, loop, drawStaticFrame]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none"
      style={{ zIndex: 0 }}
      aria-hidden="true"
    />
  );
}
