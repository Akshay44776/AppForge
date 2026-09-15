"use client";

import { useEffect, useRef, useCallback } from "react";

/* ═══════════════════════════════════════════
   Configuration
   ═══════════════════════════════════════════ */
const CARD_COUNT_DESKTOP = 16;
const CARD_COUNT_MOBILE = 8;
const CARD_W = 70;          // base width of silhouette card
const CARD_H = 98;          // base height (matches ~70:98 ≈ real card aspect ratio)
const CARD_RADIUS = 8;      // corner radius
const REPULSION_RADIUS = 140;
const REPULSION_STRENGTH = 0.8;
const DRAW_INTERVAL_MIN = 8000;  // ms
const DRAW_INTERVAL_MAX = 15000;
const DRAW_HOLD_MS = 700;
const DRIFT_SPEED = 0.15;   // max px/frame
const TUMBLE_SPEED = 0.006; // radians/frame base
const AMBER = "#d9a94a";    // matches --gold

interface FloatingCard {
  x: number;
  y: number;
  vx: number;
  vy: number;
  scale: number;         // 0.6–1.2, simulates depth
  opacity: number;       // base opacity for this card
  rotation: number;      // current visual rotation (radians)
  rotationSpeed: number;
  flipPhase: number;     // 0–2π, drives the Y-axis "flip" sine
  flipSpeed: number;
  // Draw event state
  drawState: "idle" | "locking" | "pulsing" | "fading";
  drawTimer: number;     // ms remaining in current draw phase
}

function randomBetween(min: number, max: number) {
  return min + Math.random() * (max - min);
}

function createCard(w: number, h: number): FloatingCard {
  return {
    x: Math.random() * w,
    y: Math.random() * h,
    vx: randomBetween(-DRIFT_SPEED, DRIFT_SPEED),
    vy: randomBetween(-DRIFT_SPEED, DRIFT_SPEED),
    scale: randomBetween(0.6, 1.2),
    opacity: randomBetween(0.12, 0.22),
    rotation: Math.random() * Math.PI * 2,
    rotationSpeed: randomBetween(-TUMBLE_SPEED, TUMBLE_SPEED),
    flipPhase: Math.random() * Math.PI * 2,
    flipSpeed: randomBetween(0.003, 0.008),
    drawState: "idle",
    drawTimer: 0,
  };
}

/* ═══════════════════════════════════════════
   Component
   ═══════════════════════════════════════════ */
export default function DriftingDeckBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cardsRef = useRef<FloatingCard[]>([]);
  const mouseRef = useRef({ x: -9999, y: -9999 });
  const rafRef = useRef<number>(0);
  const lastTimeRef = useRef(0);
  const nextDrawRef = useRef(0);
  const isVisibleRef = useRef(true);
  const reducedMotionRef = useRef(false);

  const initCards = useCallback((w: number, h: number) => {
    const isMobile = w < 640;
    const count = isMobile ? CARD_COUNT_MOBILE : CARD_COUNT_DESKTOP;
    cardsRef.current = Array.from({ length: count }, () => createCard(w, h));
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Check reduced motion preference
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    reducedMotionRef.current = mq.matches;
    const handleMotionChange = (e: MediaQueryListEvent) => {
      reducedMotionRef.current = e.matches;
    };
    mq.addEventListener("change", handleMotionChange);

    // Resize handler
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

      if (cardsRef.current.length === 0) {
        initCards(rect.width, rect.height);
      }
    };
    resize();
    window.addEventListener("resize", resize);

    // IntersectionObserver — pause when off-screen
    const observer = new IntersectionObserver(
      ([entry]) => { isVisibleRef.current = entry.isIntersecting; },
      { threshold: 0.05 }
    );
    const section = canvas.closest("section");
    if (section) observer.observe(section);

    // Schedule first draw event
    nextDrawRef.current = performance.now() + randomBetween(DRAW_INTERVAL_MIN, DRAW_INTERVAL_MAX);

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

      const cards = cardsRef.current;
      const mx = mouseRef.current.x;
      const my = mouseRef.current.y;
      const isReduced = reducedMotionRef.current;
      const isMobile = W < 640;

      // Check if it's time for a draw event
      if (!isReduced && time > nextDrawRef.current) {
        const eligible = cards.filter(c => c.drawState === "idle");
        if (eligible.length > 0) {
          const pick = eligible[Math.floor(Math.random() * eligible.length)];
          pick.drawState = "locking";
          pick.drawTimer = 400; // deceleration phase
        }
        nextDrawRef.current = time + randomBetween(DRAW_INTERVAL_MIN, DRAW_INTERVAL_MAX);
      }

      for (const card of cards) {
        if (!isReduced) {
          // ── Draw event state machine ──
          if (card.drawState === "locking") {
            card.drawTimer -= dt;
            card.vx *= 0.92;
            card.vy *= 0.92;
            card.rotationSpeed *= 0.92;
            if (card.drawTimer <= 0) {
              card.drawState = "pulsing";
              card.drawTimer = DRAW_HOLD_MS;
              card.vx = 0;
              card.vy = 0;
              card.rotationSpeed = 0;
            }
          } else if (card.drawState === "pulsing") {
            card.drawTimer -= dt;
            if (card.drawTimer <= 0) {
              card.drawState = "fading";
              card.drawTimer = 500;
            }
          } else if (card.drawState === "fading") {
            card.drawTimer -= dt;
            if (card.drawTimer <= 0) {
              // Respawn
              Object.assign(card, createCard(W, H));
            }
          }

          // ── Cursor repulsion (desktop only) ──
          if (!isMobile && card.drawState === "idle") {
            const dx = card.x - mx;
            const dy = card.y - my;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < REPULSION_RADIUS && dist > 0) {
              const force = (1 - dist / REPULSION_RADIUS) * REPULSION_STRENGTH;
              card.vx += (dx / dist) * force;
              card.vy += (dy / dist) * force;
            }
          }

          // ── Velocity damping ──
          card.vx *= 0.995;
          card.vy *= 0.995;

          // ── Position update ──
          card.x += card.vx * (dt / 16);
          card.y += card.vy * (dt / 16);

          // ── Boundary wrap ──
          const margin = CARD_W * card.scale;
          if (card.x < -margin) card.x = W + margin * 0.5;
          if (card.x > W + margin) card.x = -margin * 0.5;
          if (card.y < -margin) card.y = H + margin * 0.5;
          if (card.y > H + margin) card.y = -margin * 0.5;

          // ── Rotation / tumble ──
          card.rotation += card.rotationSpeed * (dt / 16);
          card.flipPhase += card.flipSpeed * (dt / 16);
        }

        // ── Draw the card silhouette ──
        const flipScale = Math.abs(Math.cos(card.flipPhase)); // 0–1, fakes Y-axis flip
        const cw = CARD_W * card.scale * Math.max(flipScale, 0.05);
        const ch = CARD_H * card.scale;
        const cr = CARD_RADIUS * card.scale;

        // Determine opacity and stroke color
        let strokeColor: string;
        let strokeOpacity: number;

        if (card.drawState === "pulsing") {
          const pulse = 0.4 + 0.2 * Math.sin((card.drawTimer / DRAW_HOLD_MS) * Math.PI);
          strokeColor = AMBER;
          strokeOpacity = pulse;
        } else if (card.drawState === "fading") {
          const fadeProgress = card.drawTimer / 500;
          strokeColor = AMBER;
          strokeOpacity = 0.4 * fadeProgress;
        } else if (card.drawState === "locking") {
          const lockProgress = 1 - card.drawTimer / 400;
          strokeOpacity = card.opacity + lockProgress * 0.2;
          strokeColor = `rgba(255,255,255,${strokeOpacity})`;
        } else {
          strokeOpacity = card.opacity;
          strokeColor = `rgba(255,255,255,${strokeOpacity})`;
        }

        ctx.save();
        ctx.translate(card.x, card.y);
        if (!isReduced) {
          ctx.rotate(card.rotation);
        }

        // Draw rounded rectangle (stroke only)
        ctx.beginPath();
        ctx.roundRect(-cw / 2, -ch / 2, cw, ch, cr);
        
        if (card.drawState === "pulsing" || card.drawState === "fading") {
          // Amber glow effect
          ctx.shadowColor = AMBER;
          ctx.shadowBlur = 18 * (card.drawState === "pulsing" ? 1 : card.drawTimer / 500);
          ctx.strokeStyle = strokeColor;
          ctx.globalAlpha = strokeOpacity;
        } else {
          ctx.strokeStyle = strokeColor;
          ctx.globalAlpha = 1;
        }
        
        ctx.lineWidth = card.drawState === "pulsing" ? 2 : 1.5;
        ctx.stroke();

        // Inner border detail for locked/pulsing cards
        if (card.drawState === "pulsing") {
          ctx.beginPath();
          const inset = 4 * card.scale;
          ctx.roundRect(-cw / 2 + inset, -ch / 2 + inset, cw - inset * 2, ch - inset * 2, cr * 0.6);
          ctx.globalAlpha = strokeOpacity * 0.3;
          ctx.strokeStyle = AMBER;
          ctx.lineWidth = 0.5;
          ctx.stroke();
        }

        ctx.restore();
      }
    };

    rafRef.current = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener("resize", resize);
      mq.removeEventListener("change", handleMotionChange);
      if (section) observer.unobserve(section);
    };
  }, [initCards]);

  // Mouse tracking on the section wrapper
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
