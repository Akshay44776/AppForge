"use client";

import { useCallback, useEffect, useRef } from "react";

/* ═══════════════════════════════════════════════════════════════════════════
   SimulationBackground — Animated particle constellation canvas
   Variants: "twist" | "judging" | "prizes"
   ═══════════════════════════════════════════════════════════════════════════ */

type Variant = "twist" | "judging" | "prizes";

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  isGold: boolean;
  // For judging hex-grid bias
  anchorX?: number;
  anchorY?: number;
}

interface PulseEdge {
  fromIdx: number;
  toIdx: number;
  progress: number; // 0→1
  speed: number;
}

const GOLD = { r: 217, g: 169, b: 74 };      // #d9a94a
const WHITE = { r: 236, g: 232, b: 222 };     // #ece8de

function isMobileDevice() {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(hover: none)").matches || window.innerWidth < 768;
}

function createParticles(
  count: number,
  w: number,
  h: number,
  variant: Variant
): Particle[] {
  const particles: Particle[] = [];
  for (let i = 0; i < count; i++) {
    const isGold = Math.random() < 0.65;
    const baseSpeed = 0.15 + Math.random() * 0.25;

    let vx = (Math.random() - 0.5) * baseSpeed * 2;
    let vy = (Math.random() - 0.5) * baseSpeed * 2;

    // Prizes variant: bias ~40% of particles to drift upward
    if (variant === "prizes" && Math.random() < 0.4) {
      vy = -(0.1 + Math.random() * 0.3);
      vx *= 0.5;
    }

    const x = Math.random() * w;
    const y = Math.random() * h;

    const p: Particle = {
      x,
      y,
      vx,
      vy,
      radius: 1 + Math.random() * 1.5,
      isGold,
    };

    // Judging variant: give particles a soft hex-grid anchor
    if (variant === "judging") {
      const cellW = 80;
      const cellH = 70;
      const col = Math.round(x / cellW);
      const row = Math.round(y / cellH);
      const offset = row % 2 === 0 ? 0 : cellW / 2;
      p.anchorX = col * cellW + offset;
      p.anchorY = row * cellH;
    }

    particles.push(p);
  }
  return particles;
}

export default function SimulationBackground({ variant }: { variant: Variant }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const rafRef = useRef(0);
  const mouseRef = useRef({ x: -9999, y: -9999 });
  const visibleRef = useRef(false);
  const reducedRef = useRef(false);
  const mobileRef = useRef(false);
  const pulsesRef = useRef<PulseEdge[]>([]);
  const pulseTimerRef = useRef(0);
  const initializedRef = useRef(false);

  /* ─── Proximity radius for connecting lines ─── */
  const CONNECTION_DIST = 120;
  const MOUSE_RADIUS = 100;
  const REPEL_FORCE = 0.8;

  /* ─── Init & resize ─── */
  const initCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.parentElement?.getBoundingClientRect();
    if (!rect) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = rect.width;
    const h = rect.height;

    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;

    const mobile = isMobileDevice();
    mobileRef.current = mobile;
    const count = mobile ? 40 : 80;

    particlesRef.current = createParticles(count, w, h, variant);
    initializedRef.current = true;
  }, [variant]);

  /* ─── Draw loop ─── */
  const draw = useCallback(() => {
    if (!visibleRef.current || reducedRef.current) return;

    const canvas = canvasRef.current;
    if (!canvas) {
      rafRef.current = requestAnimationFrame(draw);
      return;
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = canvas.width / dpr;
    const h = canvas.height / dpr;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    const particles = particlesRef.current;
    const mouse = mouseRef.current;
    const isMobile = mobileRef.current;

    /* ── Update positions ── */
    for (const p of particles) {
      // Judging: soft pull toward hex anchor
      if (variant === "judging" && p.anchorX !== undefined && p.anchorY !== undefined) {
        const pullStrength = 0.002;
        p.vx += (p.anchorX - p.x) * pullStrength;
        p.vy += (p.anchorY - p.y) * pullStrength;
        // Dampen so they don't oscillate too fast
        p.vx *= 0.995;
        p.vy *= 0.995;
      }

      // Mouse repulsion (desktop only)
      if (!isMobile) {
        const dx = p.x - mouse.x;
        const dy = p.y - mouse.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < MOUSE_RADIUS && dist > 0) {
          const force = (1 - dist / MOUSE_RADIUS) * REPEL_FORCE;
          p.vx += (dx / dist) * force;
          p.vy += (dy / dist) * force;
        }
      }

      // Apply velocity & clamp speed
      p.x += p.vx;
      p.y += p.vy;

      const maxSpeed = 0.6;
      const speed = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
      if (speed > maxSpeed) {
        p.vx = (p.vx / speed) * maxSpeed;
        p.vy = (p.vy / speed) * maxSpeed;
      }

      // Friction (gentle ease-back for repel)
      p.vx *= 0.998;
      p.vy *= 0.998;

      // Wrap edges
      if (p.x < -10) p.x = w + 10;
      if (p.x > w + 10) p.x = -10;
      if (p.y < -10) p.y = h + 10;
      if (p.y > h + 10) p.y = -10;
    }

    /* ── Draw connecting lines ── */
    for (let i = 0; i < particles.length; i++) {
      for (let j = i + 1; j < particles.length; j++) {
        const a = particles[i];
        const b = particles[j];
        const dx = a.x - b.x;
        const dy = a.y - b.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < CONNECTION_DIST) {
          const alpha = (1 - dist / CONNECTION_DIST) * 0.12;
          const c = a.isGold && b.isGold ? GOLD : WHITE;
          ctx.strokeStyle = `rgba(${c.r},${c.g},${c.b},${alpha})`;
          ctx.lineWidth = 0.5;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
        }
      }
    }

    /* ── Twist variant: pulse sparks along edges ── */
    if (variant === "twist") {
      pulseTimerRef.current++;
      // Spawn a new pulse every ~180 frames (~3 seconds at 60fps)
      if (pulseTimerRef.current > 150 + Math.random() * 60) {
        pulseTimerRef.current = 0;
        // Find a valid edge
        for (let attempt = 0; attempt < 20; attempt++) {
          const fi = Math.floor(Math.random() * particles.length);
          const ti = Math.floor(Math.random() * particles.length);
          if (fi === ti) continue;
          const a = particles[fi];
          const b = particles[ti];
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          if (Math.sqrt(dx * dx + dy * dy) < CONNECTION_DIST) {
            pulsesRef.current.push({ fromIdx: fi, toIdx: ti, progress: 0, speed: 0.015 + Math.random() * 0.01 });
            break;
          }
        }
      }

      // Draw active pulses
      const activePulses: PulseEdge[] = [];
      for (const pulse of pulsesRef.current) {
        pulse.progress += pulse.speed;
        if (pulse.progress > 1) continue; // remove finished
        activePulses.push(pulse);

        const a = particles[pulse.fromIdx];
        const b = particles[pulse.toIdx];
        if (!a || !b) continue;

        const px = a.x + (b.x - a.x) * pulse.progress;
        const py = a.y + (b.y - a.y) * pulse.progress;

        // Bright gold dot traveling along the edge
        const gradient = ctx.createRadialGradient(px, py, 0, px, py, 8);
        gradient.addColorStop(0, `rgba(${GOLD.r},${GOLD.g},${GOLD.b},0.7)`);
        gradient.addColorStop(0.5, `rgba(${GOLD.r},${GOLD.g},${GOLD.b},0.2)`);
        gradient.addColorStop(1, `rgba(${GOLD.r},${GOLD.g},${GOLD.b},0)`);
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(px, py, 8, 0, Math.PI * 2);
        ctx.fill();

        // Brighter line segment near the pulse
        ctx.strokeStyle = `rgba(${GOLD.r},${GOLD.g},${GOLD.b},0.35)`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }
      pulsesRef.current = activePulses;
    }

    /* ── Draw particles ── */
    for (const p of particles) {
      const c = p.isGold ? GOLD : WHITE;
      const alpha = p.isGold ? 0.18 : 0.1;
      ctx.fillStyle = `rgba(${c.r},${c.g},${c.b},${alpha})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.fill();
    }

    /* ── Radial vignette overlay ── */
    const vignetteGrad = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.25, w / 2, h / 2, Math.max(w, h) * 0.7);
    vignetteGrad.addColorStop(0, "rgba(7,9,13,0)");
    vignetteGrad.addColorStop(1, "rgba(7,9,13,0.6)");
    ctx.fillStyle = vignetteGrad;
    ctx.fillRect(0, 0, w, h);

    rafRef.current = requestAnimationFrame(draw);
  }, [variant, CONNECTION_DIST, MOUSE_RADIUS, REPEL_FORCE]);

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

    const particles = particlesRef.current;

    // Draw connections
    for (let i = 0; i < particles.length; i++) {
      for (let j = i + 1; j < particles.length; j++) {
        const a = particles[i];
        const b = particles[j];
        const dx = a.x - b.x;
        const dy = a.y - b.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < CONNECTION_DIST) {
          const alpha = (1 - dist / CONNECTION_DIST) * 0.08;
          const c = a.isGold && b.isGold ? GOLD : WHITE;
          ctx.strokeStyle = `rgba(${c.r},${c.g},${c.b},${alpha})`;
          ctx.lineWidth = 0.5;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
        }
      }
    }

    // Draw particles
    for (const p of particles) {
      const c = p.isGold ? GOLD : WHITE;
      const alpha = p.isGold ? 0.12 : 0.06;
      ctx.fillStyle = `rgba(${c.r},${c.g},${c.b},${alpha})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.fill();
    }

    // Vignette
    const vignetteGrad = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.25, w / 2, h / 2, Math.max(w, h) * 0.7);
    vignetteGrad.addColorStop(0, "rgba(7,9,13,0)");
    vignetteGrad.addColorStop(1, "rgba(7,9,13,0.6)");
    ctx.fillStyle = vignetteGrad;
    ctx.fillRect(0, 0, w, h);
  }, [CONNECTION_DIST]);

  /* ─── Setup effect ─── */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Reduced motion check
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    reducedRef.current = mq.matches;
    const onMotionChange = (e: MediaQueryListEvent) => {
      reducedRef.current = e.matches;
      if (e.matches) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = 0;
        drawStaticFrame();
      } else if (visibleRef.current) {
        rafRef.current = requestAnimationFrame(draw);
      }
    };
    mq.addEventListener("change", onMotionChange);

    // Init
    initCanvas();

    // Mouse tracking (desktop only)
    const handleMouseMove = (e: MouseEvent) => {
      if (mobileRef.current) return;
      const rect = canvas.getBoundingClientRect();
      mouseRef.current = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      };
    };
    const handleMouseLeave = () => {
      mouseRef.current = { x: -9999, y: -9999 };
    };
    const parent = canvas.parentElement;
    parent?.addEventListener("mousemove", handleMouseMove);
    parent?.addEventListener("mouseleave", handleMouseLeave);

    // Intersection observer for visibility
    const io = new IntersectionObserver(
      ([entry]) => {
        visibleRef.current = entry.isIntersecting;
        if (entry.isIntersecting) {
          if (reducedRef.current) {
            drawStaticFrame();
          } else if (rafRef.current === 0) {
            rafRef.current = requestAnimationFrame(draw);
          }
        } else {
          cancelAnimationFrame(rafRef.current);
          rafRef.current = 0;
        }
      },
      { threshold: 0.05 }
    );
    io.observe(canvas);

    // Resize handler
    const handleResize = () => {
      initCanvas();
      if (reducedRef.current) {
        drawStaticFrame();
      }
    };
    window.addEventListener("resize", handleResize);

    return () => {
      mq.removeEventListener("change", onMotionChange);
      parent?.removeEventListener("mousemove", handleMouseMove);
      parent?.removeEventListener("mouseleave", handleMouseLeave);
      cancelAnimationFrame(rafRef.current);
      rafRef.current = 0;
      io.disconnect();
      window.removeEventListener("resize", handleResize);
    };
  }, [initCanvas, draw, drawStaticFrame]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none"
      style={{ zIndex: 0 }}
      aria-hidden="true"
    />
  );
}
