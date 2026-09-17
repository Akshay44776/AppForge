"use client";

import { useEffect, useRef, useImperativeHandle, forwardRef } from "react";

/* ═══════════════════════════════════════════════════════════════════════════
   ConstellationBg — 2.5D Cinematic Plexus with Burst
   
   Background: Elegant, sparse depth-of-field bokeh network (like Image 5). 
   Nodes have Z-depth which affects their size, blur, and parallax speed.
   
   Click Burst (Image 2): Summons a bright glowing phone wireframe and 
   sweeping thick golden light arcs.
   ═══════════════════════════════════════════════════════════════════════════ */

export type ConstellationBgHandle = {
  triggerBurst: (clientX: number, clientY: number) => void;
};

/* ─── Types ────────────────────────────────────────────────────────────── */
type Node = {
  x: number;
  y: number;
  z: number; // 0 (front) to 1 (back)
  vx: number;
  vy: number;
  baseRadius: number;
  glow: number;
};

type LightArc = {
  ox: number; oy: number;
  cx: number; cy: number;
  ex: number; ey: number;
  progress: number;
  speed: number;
  intensity: number;
  width: number;
  decay: number;
};

type BurstFlash = {
  x: number; y: number;
  intensity: number;
  phoneAlpha: number;
};

/* ─── Color constants ──────────────────────────────────────────────────── */
const GOLD_R = 217, GOLD_G = 169, GOLD_B = 74;
const BRIGHT_R = 244, BRIGHT_G = 200, BRIGHT_B = 98;
const WHITE_GOLD_R = 255, WHITE_GOLD_G = 230, WHITE_GOLD_B = 160;

function rgba(r: number, g: number, b: number, a: number) {
  return `rgba(${r},${g},${b},${Math.max(0, Math.min(1, a)).toFixed(4)})`;
}

/* ─── Configuration ────────────────────────────────────────────────────── */
const DESKTOP_NODE_COUNT = 65;
const MOBILE_NODE_COUNT = 30;
const LINK_DISTANCE = 220;
const BASE_DRIFT_SPEED = 0.1;
const GLOW_DECAY = 0.985;
const PARALLAX_STRENGTH = 40;

/* Phone wireframe */
const PHONE_W = 86;
const PHONE_H = 160;
const PHONE_RADIUS = 14;
const PHONE_NOTCH_W = 32;
const PHONE_NOTCH_H = 6;

const ConstellationBg = forwardRef<ConstellationBgHandle>((_props, ref) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const rafRef = useRef<number>(0);
  const inViewRef = useRef(true);

  const nodesRef = useRef<Node[]>([]);
  const arcsRef = useRef<LightArc[]>([]);
  const flashRef = useRef<BurstFlash>({ x: 0, y: 0, intensity: 0, phoneAlpha: 0 });
  const pendingBurstRef = useRef<{ x: number; y: number } | null>(null);
  
  const sizeRef = useRef({ w: 0, h: 0 });
  const mouseRef = useRef({ x: 0, y: 0, tx: 0, ty: 0 }); // current & target mouse
  const dprRef = useRef(1);

  useImperativeHandle(ref, () => ({
    triggerBurst(clientX: number, clientY: number) {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      pendingBurstRef.current = {
        x: clientX - rect.left,
        y: clientY - rect.top,
      };
    },
  }));

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const isMobile = () => window.innerWidth < 768;

    /* ─── Build nodes ──────────────────────────────────────────────── */
    function buildNodes(w: number, h: number) {
      const count = isMobile() ? MOBILE_NODE_COUNT : DESKTOP_NODE_COUNT;
      const nodes: Node[] = [];
      for (let i = 0; i < count; i++) {
        const speed = BASE_DRIFT_SPEED * (0.3 + Math.random() * 0.7);
        const angle = Math.random() * Math.PI * 2;
        nodes.push({
          x: Math.random() * w,
          y: Math.random() * h,
          z: Math.random(), // 0 to 1
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          baseRadius: 1.5 + Math.random() * 2,
          glow: 0,
        });
      }
      nodesRef.current = nodes;
    }

    /* ─── Resize ───────────────────────────────────────────────────── */
    function resize() {
      const rect = container!.getBoundingClientRect();
      dprRef.current = Math.min(window.devicePixelRatio || 1, 2);
      const w = rect.width;
      const h = rect.height;
      canvas!.width = w * dprRef.current;
      canvas!.height = h * dprRef.current;
      canvas!.style.width = `${w}px`;
      canvas!.style.height = `${h}px`;
      ctx!.setTransform(dprRef.current, 0, 0, dprRef.current, 0, 0);
      sizeRef.current = { w, h };
      if (nodesRef.current.length === 0) buildNodes(w, h);
    }
    resize();
    window.addEventListener("resize", resize, { passive: true });

    /* ─── Mouse tracking ───────────────────────────────────────────── */
    function onMouseMove(e: MouseEvent) {
      const rect = canvas!.getBoundingClientRect();
      // Normalized -1 to 1
      mouseRef.current.tx = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouseRef.current.ty = ((e.clientY - rect.top) / rect.height) * 2 - 1;
    }
    window.addEventListener("mousemove", onMouseMove, { passive: true });

    const io = new IntersectionObserver(
      (entries) => { inViewRef.current = entries[0]?.isIntersecting ?? true; },
      { threshold: 0.03 }
    );
    io.observe(container);

    /* ─── Apply burst ──────────────────────────────────────────────── */
    function applyBurst() {
      const burst = pendingBurstRef.current;
      if (!burst) return;
      pendingBurstRef.current = null;

      const nodes = nodesRef.current;
      const burstR = 400;

      // Flare nearby nodes
      nodes.forEach((n) => {
        const dx = n.x - burst.x;
        const dy = n.y - burst.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < burstR) {
          const falloff = 1 - dist / burstR;
          n.glow = Math.max(n.glow, falloff * falloff);
        }
      });

      // Spawn arcs
      const arcCount = isMobile() ? 12 : 24;
      const newArcs: LightArc[] = [];
      for (let i = 0; i < arcCount; i++) {
        const angle = (i / arcCount) * Math.PI * 2 + (Math.random() - 0.5) * 0.5;
        const len = 150 + Math.random() * 350;
        const endX = burst.x + Math.cos(angle) * len;
        const endY = burst.y + Math.sin(angle) * len;

        const perpAngle = angle + (Math.random() > 0.5 ? 1 : -1) * (0.3 + Math.random() * 0.8);
        const perpDist = len * (0.2 + Math.random() * 0.4);
        const midX = (burst.x + endX) / 2 + Math.cos(perpAngle) * perpDist;
        const midY = (burst.y + endY) / 2 + Math.sin(perpAngle) * perpDist;

        newArcs.push({
          ox: burst.x, oy: burst.y,
          cx: midX, cy: midY,
          ex: endX, ey: endY,
          progress: 0,
          speed: 0.8 + Math.random() * 1.5,
          intensity: 0.7 + Math.random() * 0.3,
          width: 2 + Math.random() * 3,
          decay: 0.94 + Math.random() * 0.04,
        });
      }
      arcsRef.current.push(...newArcs);

      flashRef.current = { x: burst.x, y: burst.y, intensity: 1.0, phoneAlpha: 1.0 };
    }

    /* ─── Render Frame ─────────────────────────────────────────────── */
    function renderFrame() {
      const { w, h } = sizeRef.current;
      const nodes = nodesRef.current;
      const arcs = arcsRef.current;
      const flash = flashRef.current;
      const m = mouseRef.current;

      // Smooth mouse for parallax
      m.x += (m.tx - m.x) * 0.05;
      m.y += (m.ty - m.y) * 0.05;

      ctx!.clearRect(0, 0, w, h);

      // Pre-calculate parallax positions
      const renderNodes = nodes.map(n => {
        // Closer nodes (z -> 0) move more, distant nodes (z -> 1) move less
        const pFactor = (1 - n.z) * PARALLAX_STRENGTH;
        return {
          ...n,
          px: n.x + m.x * pFactor,
          py: n.y + m.y * pFactor,
        };
      });

      // 1. Draw connections
      const linkDistSq = LINK_DISTANCE * LINK_DISTANCE;
      for (let i = 0; i < renderNodes.length; i++) {
        const a = renderNodes[i];
        for (let j = i + 1; j < renderNodes.length; j++) {
          const b = renderNodes[j];
          const dx = a.px - b.px;
          const dy = a.py - b.py;
          const distSq = dx * dx + dy * dy;
          if (distSq > linkDistSq) continue;

          // Only connect if they are reasonably close in Z depth to avoid mess
          if (Math.abs(a.z - b.z) > 0.4) continue;

          const dist = Math.sqrt(distSq);
          const distFactor = 1 - dist / LINK_DISTANCE;
          const avgZ = (a.z + b.z) / 2;
          const avgGlow = (a.glow + b.glow) / 2;
          
          // Distant lines are fainter
          const zAlpha = 1 - (avgZ * 0.6);
          const baseAlpha = distFactor * 0.2 * zAlpha;
          const alpha = Math.min(1, baseAlpha + avgGlow * 0.8);
          if (alpha < 0.01) continue;

          const lw = (1 - avgZ) * 1.5 + avgGlow * 2.5 + 0.5;

          ctx!.beginPath();
          ctx!.moveTo(a.px, a.py);
          ctx!.lineTo(b.px, b.py);
          
          if (avgGlow > 0.1) {
            ctx!.strokeStyle = rgba(BRIGHT_R, BRIGHT_G, BRIGHT_B, alpha);
            ctx!.lineWidth = lw;
            ctx!.save();
            ctx!.shadowColor = rgba(GOLD_R, GOLD_G, GOLD_B, avgGlow * 0.5);
            ctx!.shadowBlur = 10 * avgGlow;
            ctx!.stroke();
            ctx!.restore();
          } else {
            // Richer amber for ambient lines
            ctx!.strokeStyle = rgba(230, 160, 60, alpha);
            ctx!.lineWidth = lw;
            ctx!.stroke();
          }
        }
      }

      // 2. Draw cinematic bokeh nodes
      for (const n of renderNodes) {
        // Distant nodes are larger but softer (bokeh effect)
        const bokehSize = n.baseRadius + (n.z * 6);
        const r = bokehSize + n.glow * 5;
        
        // Depth affects alpha (distant = dimmer)
        const zAlpha = 1 - (n.z * 0.5);
        const alpha = Math.min(1, (0.4 * zAlpha) + n.glow);

        if (n.z > 0.5 && n.glow < 0.1) {
          // Out of focus soft bokeh
          const grad = ctx!.createRadialGradient(n.px, n.py, 0, n.px, n.py, r * 1.5);
          grad.addColorStop(0, rgba(230, 160, 60, alpha * 0.5));
          grad.addColorStop(1, rgba(230, 160, 60, 0));
          ctx!.fillStyle = grad;
          ctx!.beginPath();
          ctx!.arc(n.px, n.py, r * 1.5, 0, Math.PI * 2);
          ctx!.fill();
        } else {
          // Sharp foreground node or glowing node
          ctx!.beginPath();
          ctx!.fillStyle = rgba(BRIGHT_R, BRIGHT_G, BRIGHT_B, alpha);
          ctx!.arc(n.px, n.py, r, 0, Math.PI * 2);
          ctx!.fill();
          
          if (n.glow > 0.1) {
            ctx!.beginPath();
            ctx!.fillStyle = rgba(WHITE_GOLD_R, WHITE_GOLD_G, WHITE_GOLD_B, n.glow * 0.8);
            ctx!.arc(n.px, n.py, r * 0.4, 0, Math.PI * 2);
            ctx!.fill();
          }
        }
      }

      // 3. Draw light arcs (thick, sweeping, glowing)
      for (const arc of arcs) {
        if (arc.intensity < 0.01) continue;
        const headT = Math.min(arc.progress, 1);
        const tailT = Math.max(0, arc.progress - 0.5);
        if (headT <= tailT) continue;

        ctx!.save();
        for (let pass = 0; pass < 2; pass++) {
          const isGlow = pass === 0;
          const alpha = isGlow ? arc.intensity * 0.15 : arc.intensity;
          const lineW = isGlow ? arc.width * 6 : arc.width;

          ctx!.strokeStyle = isGlow
            ? rgba(GOLD_R, GOLD_G, GOLD_B, alpha)
            : rgba(WHITE_GOLD_R, WHITE_GOLD_G, WHITE_GOLD_B, alpha);
          ctx!.lineWidth = lineW;
          ctx!.lineCap = "round";

          ctx!.beginPath();
          let started = false;
          for (let s = 0; s <= 20; s++) {
            const t = tailT + (headT - tailT) * (s / 20);
            const mt = 1 - t;
            const px = mt * mt * arc.ox + 2 * mt * t * arc.cx + t * t * arc.ex;
            const py = mt * mt * arc.oy + 2 * mt * t * arc.cy + t * t * arc.ey;
            if (!started) { ctx!.moveTo(px, py); started = true; }
            else { ctx!.lineTo(px, py); }
          }
          ctx!.stroke();
        }
        ctx!.restore();
      }

      // 4. Draw phone wireframe + flash bloom
      if (flash.phoneAlpha > 0.01) {
        const { x, y, phoneAlpha, intensity } = flash;
        
        // Bloom
        if (intensity > 0.01) {
          const r = 250;
          const grad = ctx!.createRadialGradient(x, y, 0, x, y, r);
          grad.addColorStop(0, rgba(WHITE_GOLD_R, WHITE_GOLD_G, WHITE_GOLD_B, intensity * 0.5));
          grad.addColorStop(0.2, rgba(BRIGHT_R, BRIGHT_G, BRIGHT_B, intensity * 0.2));
          grad.addColorStop(1, rgba(GOLD_R, GOLD_G, GOLD_B, 0));
          ctx!.fillStyle = grad;
          ctx!.beginPath();
          ctx!.arc(x, y, r, 0, Math.PI * 2);
          ctx!.fill();
        }

        // Phone Wireframe
        const px = x - PHONE_W / 2;
        const py = y - PHONE_H / 2 - 40; // shift up slightly above cursor
        const pr = PHONE_RADIUS;

        ctx!.save();
        ctx!.strokeStyle = rgba(BRIGHT_R, BRIGHT_G, BRIGHT_B, phoneAlpha);
        ctx!.lineWidth = 2.5;
        ctx!.shadowColor = rgba(GOLD_R, GOLD_G, GOLD_B, phoneAlpha * 0.8);
        ctx!.shadowBlur = 15;

        // Outer shell
        ctx!.beginPath();
        ctx!.moveTo(px + pr, py);
        ctx!.lineTo(px + PHONE_W - pr, py);
        ctx!.quadraticCurveTo(px + PHONE_W, py, px + PHONE_W, py + pr);
        ctx!.lineTo(px + PHONE_W, py + PHONE_H - pr);
        ctx!.quadraticCurveTo(px + PHONE_W, py + PHONE_H, px + PHONE_W - pr, py + PHONE_H);
        ctx!.lineTo(px + pr, py + PHONE_H);
        ctx!.quadraticCurveTo(px, py + PHONE_H, px, py + PHONE_H - pr);
        ctx!.lineTo(px, py + pr);
        ctx!.quadraticCurveTo(px, py, px + pr, py);
        ctx!.stroke();

        // Notch
        const nw = PHONE_NOTCH_W;
        ctx!.lineWidth = 1.5;
        ctx!.beginPath();
        ctx!.roundRect(x - nw / 2, py + 10, nw, PHONE_NOTCH_H, 3);
        ctx!.stroke();

        // Inner screen rim
        ctx!.strokeStyle = rgba(GOLD_R, GOLD_G, GOLD_B, phoneAlpha * 0.4);
        ctx!.lineWidth = 1;
        ctx!.shadowBlur = 0;
        ctx!.beginPath();
        ctx!.roundRect(px + 6, py + 22, PHONE_W - 12, PHONE_H - 34, pr - 4);
        ctx!.stroke();

        ctx!.restore();
      }
    }

    /* ─── Animation Loop ───────────────────────────────────────────── */
    function step() {
      if (!inViewRef.current) {
        rafRef.current = requestAnimationFrame(step);
        return;
      }
      const { w, h } = sizeRef.current;
      const nodes = nodesRef.current;
      const arcs = arcsRef.current;
      const flash = flashRef.current;

      // Drift nodes
      for (const n of nodes) {
        n.x += n.vx;
        n.y += n.vy;
        if (n.x < -100 || n.x > w + 100) n.vx *= -1;
        if (n.y < -100 || n.y > h + 100) n.vy *= -1;
        n.glow *= GLOW_DECAY;
        if (n.glow < 0.001) n.glow = 0;
      }

      // Advance arcs
      for (let i = arcs.length - 1; i >= 0; i--) {
        const arc = arcs[i];
        arc.progress += arc.speed * 0.016;
        arc.intensity *= arc.decay;
        if (arc.intensity < 0.005 || arc.progress > 2) {
          arcs.splice(i, 1);
        }
      }

      // Decay flash
      flash.intensity *= 0.96;
      flash.phoneAlpha *= 0.985;

      applyBurst();
      renderFrame();
      rafRef.current = requestAnimationFrame(step);
    }

    rafRef.current = requestAnimationFrame(step);

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener("resize", resize);
      window.removeEventListener("mousemove", onMouseMove);
      io.disconnect();
    };
  }, []);

  return (
    <div
      ref={containerRef}
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 0,
        pointerEvents: "none",
        overflow: "hidden",
      }}
      aria-hidden="true"
    >
      <canvas ref={canvasRef} style={{ width: "100%", height: "100%" }} />
    </div>
  );
});

ConstellationBg.displayName = "ConstellationBg";
export default ConstellationBg;
