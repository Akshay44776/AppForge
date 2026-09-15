"use client";

import { useEffect, useRef, useCallback } from "react";

/* ═══════════════════════════════════════════
   Configuration
   Mirrors DriftingDeckBackground patterns for consistency
   ═══════════════════════════════════════════ */
const NODE_COUNT_DESKTOP = 32;
const NODE_COUNT_MOBILE = 16;
const NODE_RADIUS_MIN = 1.5;
const NODE_RADIUS_MAX = 3;
const NODE_OPACITY_MIN = 0.15;
const NODE_OPACITY_MAX = 0.25;
const DRIFT_SPEED = 0.12;
const LINE_PROXIMITY = 140;
const LINE_OPACITY_BASE = 0.04;
const LINE_OPACITY_CURSOR = 0.12;
const REPULSION_RADIUS = 150;
const REPULSION_STRENGTH = 0.6;
// Spark pulse — intentionally dimmer than the reel's active glow
const SPARK_OPACITY = 0.18;    // lower than reel glow (~0.35) for clear hierarchy
const SPARK_DURATION = 400;     // ms
const AMBER = "#d9a94a";        // matches var(--gold)

interface Node {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  opacity: number;
}

interface Spark {
  i: number;
  j: number;
  timer: number;       // ms remaining
  peakOpacity: number;
}

function randomBetween(min: number, max: number) {
  return min + Math.random() * (max - min);
}

function createNode(w: number, h: number): Node {
  return {
    x: Math.random() * w,
    y: Math.random() * h,
    vx: randomBetween(-DRIFT_SPEED, DRIFT_SPEED),
    vy: randomBetween(-DRIFT_SPEED, DRIFT_SPEED),
    radius: randomBetween(NODE_RADIUS_MIN, NODE_RADIUS_MAX),
    opacity: randomBetween(NODE_OPACITY_MIN, NODE_OPACITY_MAX),
  };
}

/* ═══════════════════════════════════════════
   Component
   ═══════════════════════════════════════════ */
export default function ConstellationBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const nodesRef = useRef<Node[]>([]);
  const sparksRef = useRef<Spark[]>([]);
  const mouseRef = useRef({ x: -9999, y: -9999 });
  const rafRef = useRef(0);
  const lastTimeRef = useRef(0);
  const isVisibleRef = useRef(true);
  const reducedMotionRef = useRef(false);
  // Track previous distances for spark detection (closest-approach trigger)
  const prevDistsRef = useRef<Map<string, number>>(new Map());

  const initNodes = useCallback((w: number, h: number) => {
    const isMobile = w < 640;
    const count = isMobile ? NODE_COUNT_MOBILE : NODE_COUNT_DESKTOP;
    nodesRef.current = Array.from({ length: count }, () => createNode(w, h));
    prevDistsRef.current.clear();
    sparksRef.current = [];
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Reduced motion
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    reducedMotionRef.current = mq.matches;
    const handleMotionChange = (e: MediaQueryListEvent) => {
      reducedMotionRef.current = e.matches;
    };
    mq.addEventListener("change", handleMotionChange);

    // Resize — matches DriftingDeckBackground pattern
    const resize = () => {
      const parent = canvas.parentElement;
      if (!parent) return;
      const rect = parent.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      if (nodesRef.current.length === 0) {
        initNodes(rect.width, rect.height);
      }
    };
    resize();
    window.addEventListener("resize", resize);

    // Pause when off-screen — matches DriftingDeckBackground pattern
    const observer = new IntersectionObserver(
      ([entry]) => { isVisibleRef.current = entry.isIntersecting; },
      { threshold: 0.05 }
    );
    const section = canvas.closest("section");
    if (section) observer.observe(section);

    // ─── Animation loop ───
    const loop = (time: number) => {
      rafRef.current = requestAnimationFrame(loop);

      if (!isVisibleRef.current) return;

      const dt = lastTimeRef.current ? Math.min(time - lastTimeRef.current, 50) : 16;
      lastTimeRef.current = time;

      const parent = canvas.parentElement;
      if (!parent) return;
      const rect = parent.getBoundingClientRect();
      const W = rect.width;
      const H = rect.height;

      ctx.clearRect(0, 0, W, H);

      const nodes = nodesRef.current;
      const mx = mouseRef.current.x;
      const my = mouseRef.current.y;
      const isReduced = reducedMotionRef.current;
      const isMobile = W < 640;

      if (!isReduced) {
        // Update positions
        for (const node of nodes) {
          // Cursor repulsion (desktop only)
          if (!isMobile) {
            const dx = node.x - mx;
            const dy = node.y - my;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < REPULSION_RADIUS && dist > 0) {
              const force = (1 - dist / REPULSION_RADIUS) * REPULSION_STRENGTH;
              node.vx += (dx / dist) * force;
              node.vy += (dy / dist) * force;
            }
          }

          // Velocity damping
          node.vx *= 0.997;
          node.vy *= 0.997;

          // Ensure minimum drift speed
          const speed = Math.sqrt(node.vx * node.vx + node.vy * node.vy);
          if (speed < DRIFT_SPEED * 0.3) {
            node.vx += randomBetween(-0.02, 0.02);
            node.vy += randomBetween(-0.02, 0.02);
          }

          // Move
          node.x += node.vx * (dt / 16);
          node.y += node.vy * (dt / 16);

          // Boundary wrap
          if (node.x < -10) node.x = W + 5;
          if (node.x > W + 10) node.x = -5;
          if (node.y < -10) node.y = H + 5;
          if (node.y > H + 10) node.y = -5;
        }
      }

      // ── Draw connections + detect spark triggers ──
      const sparkMap = new Map<string, Spark>();
      for (const spark of sparksRef.current) {
        sparkMap.set(`${spark.i}-${spark.j}`, spark);
      }

      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const a = nodes[i];
          const b = nodes[j];
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist > LINE_PROXIMITY) continue;

          const key = `${i}-${j}`;
          const prevDist = prevDistsRef.current.get(key);

          // Detect closest-approach moment (distance was decreasing, now increasing)
          if (!isReduced && prevDist !== undefined && prevDist < dist && prevDist < LINE_PROXIMITY * 0.4) {
            if (!sparkMap.has(key)) {
              const newSpark: Spark = { i, j, timer: SPARK_DURATION, peakOpacity: SPARK_OPACITY };
              sparksRef.current.push(newSpark);
              sparkMap.set(key, newSpark);
            }
          }
          prevDistsRef.current.set(key, dist);

          // Check cursor proximity to the line midpoint
          const midX = (a.x + b.x) / 2;
          const midY = (a.y + b.y) / 2;
          const cursorDist = Math.sqrt((midX - mx) * (midX - mx) + (midY - my) * (midY - my));
          const cursorBoost = !isMobile && cursorDist < REPULSION_RADIUS
            ? LINE_OPACITY_CURSOR * (1 - cursorDist / REPULSION_RADIUS)
            : 0;

          // Base line opacity (fades with distance)
          const proximity = 1 - dist / LINE_PROXIMITY;
          let lineOpacity = LINE_OPACITY_BASE * proximity + cursorBoost;

          // Check for active spark on this pair
          const activeSpark = sparkMap.get(key);
          let lineColor = `rgba(255,255,255,${lineOpacity})`;

          if (activeSpark && activeSpark.timer > 0) {
            const sparkProgress = activeSpark.timer / SPARK_DURATION;
            const sparkAlpha = activeSpark.peakOpacity * Math.sin(sparkProgress * Math.PI);
            // Use amber for spark, blended over the base line
            lineColor = `rgba(217,169,74,${Math.max(lineOpacity, sparkAlpha)})`;
          }

          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.strokeStyle = lineColor;
          ctx.lineWidth = 0.8;
          ctx.stroke();
        }
      }

      // Update spark timers
      if (!isReduced) {
        sparksRef.current = sparksRef.current.filter((s) => {
          s.timer -= dt;
          return s.timer > 0;
        });
      }

      // ── Draw nodes ──
      for (const node of nodes) {
        ctx.beginPath();
        ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,255,255,${node.opacity})`;
        ctx.fill();
      }
    };

    rafRef.current = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener("resize", resize);
      mq.removeEventListener("change", handleMotionChange);
      if (section) observer.unobserve(section);
    };
  }, [initNodes]);

  // Mouse tracking on the section wrapper (NOT the canvas)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const section = canvas.closest("section");
    if (!section) return;

    const handleMove = (e: MouseEvent) => {
      const rect = section.getBoundingClientRect();
      mouseRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };
    const handleLeave = () => {
      mouseRef.current = { x: -9999, y: -9999 };
    };

    section.addEventListener("mousemove", handleMove);
    section.addEventListener("mouseleave", handleLeave);
    return () => {
      section.removeEventListener("mousemove", handleMove);
      section.removeEventListener("mouseleave", handleLeave);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="absolute inset-0 w-full h-full pointer-events-none"
      style={{ zIndex: 0 }}
    />
  );
}
