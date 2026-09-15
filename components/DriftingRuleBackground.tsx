"use client";

import { useEffect, useRef, useCallback } from "react";

/* ═══════════════════════════════════════════
   Configuration
   ═══════════════════════════════════════════ */
const TILE_COUNT_DESKTOP = 14;
const TILE_COUNT_MOBILE = 6;
const TILE_W = 90;          
const TILE_H = 26;          
const TILE_RADIUS = 4;      
const REPULSION_RADIUS = 140;
const REPULSION_STRENGTH = 0.8;
const DRAW_INTERVAL_MIN = 8000;  // ms
const DRAW_INTERVAL_MAX = 15000;
const LOCKING_MS = 400;
const STAMPING_MS = 700;
const FADING_MS = 500;
const DRIFT_SPEED = 0.15;   
const TUMBLE_SPEED = 0.004; 
const AMBER = "#d9a94a";    

interface FloatingTile {
  x: number;
  y: number;
  vx: number;
  vy: number;
  scale: number;         // 0.6–1.1
  opacity: number;       // 0.10–0.20
  rotation: number;      
  rotationSpeed: number;
  
  // Stamp event state
  drawState: "idle" | "locking" | "stamping" | "fading";
  drawTimer: number;     // ms remaining in current phase
  lockX: number;
  lockY: number;
  lockRotation: number;
}

function randomBetween(min: number, max: number) {
  return min + Math.random() * (max - min);
}

function createTile(w: number, h: number): FloatingTile {
  return {
    x: Math.random() * w,
    y: Math.random() * h,
    vx: randomBetween(-DRIFT_SPEED, DRIFT_SPEED),
    vy: randomBetween(-DRIFT_SPEED, DRIFT_SPEED),
    scale: randomBetween(0.6, 1.1),
    opacity: randomBetween(0.10, 0.20),
    rotation: Math.random() * Math.PI * 2,
    rotationSpeed: randomBetween(-TUMBLE_SPEED, TUMBLE_SPEED),
    drawState: "idle",
    drawTimer: 0,
    lockX: 0,
    lockY: 0,
    lockRotation: 0,
  };
}

/* ═══════════════════════════════════════════
   Component
   ═══════════════════════════════════════════ */
export default function DriftingRuleBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const tilesRef = useRef<FloatingTile[]>([]);
  const mouseRef = useRef({ x: -9999, y: -9999 });
  const rafRef = useRef<number>(0);
  const lastTimeRef = useRef(0);
  const nextDrawRef = useRef(0);
  const isVisibleRef = useRef(true);
  const reducedMotionRef = useRef(false);

  const initTiles = useCallback((w: number, h: number) => {
    const isMobile = w < 640;
    const count = isMobile ? TILE_COUNT_MOBILE : TILE_COUNT_DESKTOP;
    tilesRef.current = Array.from({ length: count }, () => createTile(w, h));
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

      if (tilesRef.current.length === 0) {
        initTiles(rect.width, rect.height);
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

    // Schedule first stamp event
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

      const tiles = tilesRef.current;
      const mx = mouseRef.current.x;
      const my = mouseRef.current.y;
      const isReduced = reducedMotionRef.current;
      const isMobile = W < 640;

      // Check if it's time for a stamp event
      if (!isReduced && time > nextDrawRef.current) {
        const eligible = tiles.filter(t => t.drawState === "idle");
        if (eligible.length > 0) {
          const pick = eligible[Math.floor(Math.random() * eligible.length)];
          pick.drawState = "locking";
          pick.drawTimer = LOCKING_MS;
          // Decide where it locks (center-ish)
          pick.lockX = W / 2 + randomBetween(-100, 100);
          pick.lockY = H / 2 + randomBetween(-100, 100);
          // Snap rotation to a slight angle
          pick.lockRotation = randomBetween(-0.2, 0.2);
        }
        nextDrawRef.current = time + randomBetween(DRAW_INTERVAL_MIN, DRAW_INTERVAL_MAX);
      }

      for (let i = 0; i < tiles.length; i++) {
        const t = tiles[i];

        if (isReduced) {
          // Static faint rendering
          renderTile(ctx, t, t.x, t.y, t.rotation, t.opacity * 0.5, false);
          continue;
        }

        let renderX = t.x;
        let renderY = t.y;
        let renderRot = t.rotation;
        let renderOpacity = t.opacity;
        let isStamping = false;

        // State Machine
        if (t.drawState === "idle") {
          t.x += t.vx * dt;
          t.y += t.vy * dt;
          t.rotation += t.rotationSpeed * dt;

          // Wrap edges
          const pad = 100;
          if (t.x < -pad) t.x = W + pad;
          if (t.x > W + pad) t.x = -pad;
          if (t.y < -pad) t.y = H + pad;
          if (t.y > H + pad) t.y = -pad;

          // Cursor repulsion (desktop only)
          if (!isMobile && mx > -9999 && my > -9999) {
            const dx = t.x - mx;
            const dy = t.y - my;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < REPULSION_RADIUS) {
              const force = (1 - dist / REPULSION_RADIUS) * REPULSION_STRENGTH;
              t.x += (dx / dist) * force * dt;
              t.y += (dy / dist) * force * dt;
            }
          }
        } else {
          // Draw sequence
          t.drawTimer -= dt;
          if (t.drawState === "locking") {
            const progress = 1 - Math.max(0, t.drawTimer / LOCKING_MS);
            // Ease out cubic
            const ease = 1 - Math.pow(1 - progress, 3);
            renderX = t.x + (t.lockX - t.x) * ease;
            renderY = t.y + (t.lockY - t.y) * ease;
            
            // Shortest path rotation
            let dr = t.lockRotation - t.rotation;
            dr = Math.atan2(Math.sin(dr), Math.cos(dr));
            renderRot = t.rotation + dr * ease;
            
            if (t.drawTimer <= 0) {
              t.drawState = "stamping";
              t.drawTimer = STAMPING_MS;
              t.x = t.lockX;
              t.y = t.lockY;
              t.rotation = t.lockRotation;
            }
          } else if (t.drawState === "stamping") {
            isStamping = true;
            if (t.drawTimer <= 0) {
              t.drawState = "fading";
              t.drawTimer = FADING_MS;
            }
          } else if (t.drawState === "fading") {
            const progress = Math.max(0, t.drawTimer / FADING_MS);
            renderOpacity = t.opacity * progress;
            if (t.drawTimer <= 0) {
              // Respawn
              Object.assign(t, createTile(W, H));
            }
          }
        }

        renderTile(ctx, t, renderX, renderY, renderRot, renderOpacity, isStamping);
      }
    };

    rafRef.current = requestAnimationFrame(loop);

    const onMove = (e: MouseEvent | TouchEvent) => {
      const rect = canvas.getBoundingClientRect();
      let cx, cy;
      if (e.type === "mousemove") {
        cx = (e as MouseEvent).clientX;
        cy = (e as MouseEvent).clientY;
      } else {
        cx = (e as TouchEvent).touches[0].clientX;
        cy = (e as TouchEvent).touches[0].clientY;
      }
      mouseRef.current = { x: cx - rect.left, y: cy - rect.top };
    };

    const onLeave = () => { mouseRef.current = { x: -9999, y: -9999 }; };

    window.addEventListener("mousemove", onMove, { passive: true });
    window.addEventListener("touchstart", onMove, { passive: true });
    window.addEventListener("touchmove", onMove, { passive: true });
    window.addEventListener("touchend", onLeave);
    
    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener("resize", resize);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("touchstart", onMove);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onLeave);
      observer.disconnect();
    };
  }, [initTiles]);

  function renderTile(
    ctx: CanvasRenderingContext2D,
    t: FloatingTile,
    x: number,
    y: number,
    rot: number,
    opacity: number,
    isStamping: boolean
  ) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    ctx.scale(t.scale, t.scale);

    const hw = TILE_W / 2;
    const hh = TILE_H / 2;

    // Draw the rounded rect tile outline
    ctx.beginPath();
    ctx.roundRect(-hw, -hh, TILE_W, TILE_H, TILE_RADIUS);
    ctx.strokeStyle = `rgba(236, 232, 222, ${opacity})`; // --paper color faint
    ctx.lineWidth = 1;
    ctx.stroke();

    if (isStamping) {
      // Amber glow shadow
      ctx.shadowColor = AMBER;
      ctx.shadowBlur = 18;
      
      // Draw double underline stamp
      ctx.strokeStyle = AMBER;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-hw + 10, hh - 6);
      ctx.lineTo(hw - 10, hh - 6);
      ctx.stroke();

      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(-hw + 10, hh - 3);
      ctx.lineTo(hw - 10, hh - 3);
      ctx.stroke();

      // Clear shadow
      ctx.shadowBlur = 0;
    }

    ctx.restore();
  }

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none"
      style={{ zIndex: 0 }}
      aria-hidden
    />
  );
}
