"use client";

import { useCallback, useEffect, useRef } from "react";

/* ═══════════════════════════════════════════════════════════════════════════
   ConstellationBg — amber plexus particle network background.

   A field of small gold dots connected by thin amber lines, drifting slowly.
   Occasional pulse flares travel along edges. Respects prefers-reduced-motion
   and pauses via IntersectionObserver when off-screen.
   ═══════════════════════════════════════════════════════════════════════════ */

/* --- Tokens (from :root CSS vars, hardcoded for canvas context) --- */
const GOLD = { r: 217, g: 169, b: 74 };
const GOLD_BRIGHT = { r: 244, g: 200, b: 98 };
const INK = "#07090d";

/* --- Configuration --- */
const LINK_DIST = 160;
const NODE_COUNT_DESKTOP = 85;
const NODE_COUNT_MOBILE = 35;
const BASE_SPEED = 0.15;
const PULSE_INTERVAL_MIN = 3000;
const PULSE_INTERVAL_MAX = 7000;
const PULSE_SPEED = 3.5; // 0..1 per second
const PULSE_TRAIL_LEN = 0.35;

interface Node {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  opacity: number;
}

interface Pulse {
  fromIdx: number;
  toIdx: number;
  progress: number; // 0..1
  intensity: number;
}

function rgba(c: { r: number; g: number; b: number }, a: number) {
  return `rgba(${c.r},${c.g},${c.b},${a.toFixed(3)})`;
}

function makeNodes(count: number, w: number, h: number): Node[] {
  const nodes: Node[] = [];
  for (let i = 0; i < count; i++) {
    const speed = BASE_SPEED * (0.3 + Math.random() * 0.7);
    const angle = Math.random() * Math.PI * 2;
    nodes.push({
      x: Math.random() * w,
      y: Math.random() * h,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      size: 1.2 + Math.random() * 1.8,
      opacity: 0.25 + Math.random() * 0.55,
    });
  }
  return nodes;
}

export default function ConstellationBg() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  const nodesRef = useRef<Node[]>([]);
  const pulsesRef = useRef<Pulse[]>([]);
  const pulseTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const runningRef = useRef(false);
  const reducedMotionRef = useRef(false);
  const sizeRef = useRef({ w: 0, h: 0 });

  /* --- Spawn a pulse along a random edge --- */
  const spawnPulse = useCallback(() => {
    const nodes = nodesRef.current;
    if (nodes.length < 2) return;

    // Pick a random node and find its nearest neighbor
    const fromIdx = Math.floor(Math.random() * nodes.length);
    const from = nodes[fromIdx];
    let bestDist = Infinity;
    let toIdx = -1;

    for (let j = 0; j < nodes.length; j++) {
      if (j === fromIdx) continue;
      const dx = from.x - nodes[j].x;
      const dy = from.y - nodes[j].y;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d < LINK_DIST && d < bestDist) {
        bestDist = d;
        toIdx = j;
      }
    }

    if (toIdx >= 0) {
      pulsesRef.current.push({
        fromIdx,
        toIdx,
        progress: 0,
        intensity: 0.6 + Math.random() * 0.4,
      });
    }

    // Schedule next pulse
    if (!reducedMotionRef.current) {
      pulseTimerRef.current = setTimeout(
        spawnPulse,
        PULSE_INTERVAL_MIN + Math.random() * (PULSE_INTERVAL_MAX - PULSE_INTERVAL_MIN)
      );
    }
  }, []);

  /* --- Main init + animation loop --- */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const mql = window.matchMedia("(prefers-reduced-motion: reduce)");
    reducedMotionRef.current = mql.matches;

    const isMobile = window.innerWidth < 768;
    const count = isMobile ? NODE_COUNT_MOBILE : NODE_COUNT_DESKTOP;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    const resize = () => {
      const parent = canvas.parentElement;
      if (!parent) return;
      const w = parent.clientWidth;
      const h = parent.clientHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      sizeRef.current = { w, h };

      // Re-init nodes on resize if they haven't been created or count changed dramatically
      if (nodesRef.current.length === 0) {
        nodesRef.current = makeNodes(count, w, h);
      }
    };

    resize();
    window.addEventListener("resize", resize, { passive: true });

    /* --- Reduced-motion: render one frame, no loop --- */
    if (reducedMotionRef.current) {
      renderFrame(ctx, nodesRef.current, pulsesRef.current, sizeRef.current, 0);
      return () => {
        window.removeEventListener("resize", resize);
      };
    }

    /* --- IntersectionObserver: pause when off-screen --- */
    const io = new IntersectionObserver(
      ([entry]) => {
        runningRef.current = entry.isIntersecting;
        if (entry.isIntersecting && !animRef.current) {
          lastTimeRef.current = 0;
          animRef.current = requestAnimationFrame(loop);
        }
      },
      { threshold: 0.02 }
    );
    io.observe(canvas);

    const lastTimeRef = { current: 0 };

    const loop = (time: number) => {
      if (!runningRef.current) {
        animRef.current = 0;
        return;
      }

      const dt = lastTimeRef.current ? Math.min((time - lastTimeRef.current) / 1000, 0.05) : 0.016;
      lastTimeRef.current = time;

      const { w, h } = sizeRef.current;
      const nodes = nodesRef.current;
      const pulses = pulsesRef.current;

      // Move nodes
      for (const n of nodes) {
        n.x += n.vx * dt * 60;
        n.y += n.vy * dt * 60;
        // Bounce off edges
        if (n.x < 0 || n.x > w) n.vx *= -1;
        if (n.y < 0 || n.y > h) n.vy *= -1;
        n.x = Math.max(0, Math.min(w, n.x));
        n.y = Math.max(0, Math.min(h, n.y));
      }

      // Advance pulses
      for (let i = pulses.length - 1; i >= 0; i--) {
        pulses[i].progress += PULSE_SPEED * dt;
        if (pulses[i].progress > 1 + PULSE_TRAIL_LEN) {
          pulses.splice(i, 1);
        }
      }

      renderFrame(ctx, nodes, pulses, sizeRef.current, time);
      animRef.current = requestAnimationFrame(loop);
    };

    // Kick off
    animRef.current = requestAnimationFrame(loop);

    // Start pulse timer
    pulseTimerRef.current = setTimeout(
      spawnPulse,
      1500 + Math.random() * 2000
    );

    // Listen for reduced-motion changes
    const onMotionChange = (e: MediaQueryListEvent) => {
      reducedMotionRef.current = e.matches;
      if (e.matches) {
        if (animRef.current) {
          cancelAnimationFrame(animRef.current);
          animRef.current = 0;
        }
        if (pulseTimerRef.current) clearTimeout(pulseTimerRef.current);
        renderFrame(ctx, nodesRef.current, pulsesRef.current, sizeRef.current, 0);
      }
    };
    mql.addEventListener("change", onMotionChange);

    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
      animRef.current = 0;
      if (pulseTimerRef.current) clearTimeout(pulseTimerRef.current);
      io.disconnect();
      window.removeEventListener("resize", resize);
      mql.removeEventListener("change", onMotionChange);
    };
  }, [spawnPulse]);

  return (
    <div
      className="absolute inset-0 pointer-events-none overflow-hidden"
      style={{ zIndex: 0 }}
    >
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        className="absolute inset-0 w-full h-full"
        style={{ opacity: 0.85 }}
      />
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   Render one frame
   ───────────────────────────────────────────────────────────────────────── */
function renderFrame(
  ctx: CanvasRenderingContext2D,
  nodes: Node[],
  pulses: Pulse[],
  size: { w: number; h: number },
  _time: number
) {
  const { w, h } = size;
  ctx.clearRect(0, 0, w, h);

  const linkDistSq = LINK_DIST * LINK_DIST;

  // Build a set of pulsing edges for glow lookup
  const pulseEdges = new Map<string, number>(); // "fromIdx-toIdx" -> glow intensity
  for (const p of pulses) {
    const glow = Math.max(0, p.intensity * (1 - Math.abs(p.progress - 0.5) * 2));
    const key1 = `${p.fromIdx}-${p.toIdx}`;
    const key2 = `${p.toIdx}-${p.fromIdx}`;
    pulseEdges.set(key1, Math.max(pulseEdges.get(key1) || 0, glow));
    pulseEdges.set(key2, Math.max(pulseEdges.get(key2) || 0, glow));
  }

  // Draw links
  for (let i = 0; i < nodes.length; i++) {
    const a = nodes[i];
    for (let j = i + 1; j < nodes.length; j++) {
      const b = nodes[j];
      const dx = a.x - b.x;
      const dy = a.y - b.y;
      const distSq = dx * dx + dy * dy;
      if (distSq > linkDistSq) continue;

      const dist = Math.sqrt(distSq);
      const baseAlpha = (1 - dist / LINK_DIST) * 0.12;

      // Check if this edge has a pulse
      const key = `${i}-${j}`;
      const pulseGlow = pulseEdges.get(key) || 0;
      const alpha = baseAlpha + pulseGlow * 0.45;

      const color = pulseGlow > 0.1 ? GOLD_BRIGHT : GOLD;

      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.strokeStyle = rgba(color, alpha);
      ctx.lineWidth = pulseGlow > 0.3 ? 1.5 : 0.7;
      ctx.stroke();
    }
  }

  // Draw nodes
  for (const n of nodes) {
    ctx.beginPath();
    ctx.arc(n.x, n.y, n.size, 0, Math.PI * 2);
    ctx.fillStyle = rgba(GOLD, n.opacity);
    ctx.fill();

    // Glow halo for brighter nodes
    if (n.opacity > 0.5) {
      ctx.beginPath();
      ctx.arc(n.x, n.y, n.size * 2.5, 0, Math.PI * 2);
      ctx.fillStyle = rgba(GOLD, 0.05);
      ctx.fill();
    }
  }

  // Draw pulse bloom dots
  for (const p of pulses) {
    if (p.progress < 0 || p.progress > 1) continue;
    const a = nodes[p.fromIdx];
    const b = nodes[p.toIdx];
    if (!a || !b) continue;

    const px = a.x + (b.x - a.x) * p.progress;
    const py = a.y + (b.y - a.y) * p.progress;
    const glowSize = 4 + p.intensity * 3;

    ctx.beginPath();
    ctx.arc(px, py, glowSize, 0, Math.PI * 2);
    ctx.fillStyle = rgba(GOLD_BRIGHT, 0.35 * p.intensity);
    ctx.fill();

    ctx.beginPath();
    ctx.arc(px, py, glowSize * 0.4, 0, Math.PI * 2);
    ctx.fillStyle = rgba(GOLD_BRIGHT, 0.7 * p.intensity);
    ctx.fill();
  }
}
