"use client";

import { useEffect, useRef, useImperativeHandle, forwardRef } from "react";

/* ═══════════════════════════════════════════════════════════════════════════
   ConstellationBg — 2.5D Cinematic Plexus with Card-Click Burst

   TWO CANVAS LAYERS
     1. Ambient layer (z-0, behind the cards)
        Dense depth-of-field amber plexus. Nodes carry a Z depth that drives
        their size, softness and parallax speed. A faint warm haze sits along
        the top band of the section.

     2. FX layer (z-25, ABOVE the cards, additive blending)
        Fired by triggerBurst(). Thick golden light ribbons sweep out from an
        anchor point just above the clicked card while a large phone wireframe
        traces itself in, holds, then fades. Because it composites in "lighter"
        mode the light reads over the card surfaces exactly like the reference.

   Both layers are pointer-events:none, so nothing about the section's
   interaction model changes.
   ═══════════════════════════════════════════════════════════════════════════ */

export type ConstellationBgHandle = {
  /**
   * @param clientX  anchor X (card centre)
   * @param clientY  anchor Y (a little above the card's top edge)
   * @param cardW    clicked card width  — scales the phone wireframe
   * @param cardH    clicked card height — positions the phone wireframe
   */
  triggerBurst: (
    clientX: number,
    clientY: number,
    cardW?: number,
    cardH?: number
  ) => void;
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
  tail: number;
};

type BurstFlash = {
  active: boolean;
  x: number; y: number;       // burst origin (the bright node)
  cx: number; cy: number;     // phone centre
  w: number; h: number;       // phone size
  tilt: number;
  age: number;                // seconds since fired
  intensity: number;          // bloom
};

/* ─── Color constants ──────────────────────────────────────────────────── */
const GOLD_R = 217, GOLD_G = 169, GOLD_B = 74;
const BRIGHT_R = 244, BRIGHT_G = 200, BRIGHT_B = 98;
const WHITE_GOLD_R = 255, WHITE_GOLD_G = 230, WHITE_GOLD_B = 160;

function rgba(r: number, g: number, b: number, a: number) {
  return `rgba(${r},${g},${b},${Math.max(0, Math.min(1, a)).toFixed(4)})`;
}

/* ─── Ambient configuration ────────────────────────────────────────────── */
const DESKTOP_NODE_COUNT = 92;
const MOBILE_NODE_COUNT = 34;
const LINK_DISTANCE = 240;
const BASE_DRIFT_SPEED = 0.1;
const GLOW_DECAY = 0.985;
const PARALLAX_STRENGTH = 40;

/* ─── Burst timing (seconds) ───────────────────────────────────────────── */
const TRACE_DUR = 0.60;  // phone draws itself in
const HOLD_UNTIL = 1.90; // fully lit
const FADE_DUR = 1.30;   // then dissolves
const BURST_LIFE = HOLD_UNTIL + FADE_DUR;

const ConstellationBg = forwardRef<ConstellationBgHandle>((_props, ref) => {
  const bgCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const fxCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const rafRef = useRef<number>(0);
  const inViewRef = useRef(true);

  const nodesRef = useRef<Node[]>([]);
  const arcsRef = useRef<LightArc[]>([]);
  const flashRef = useRef<BurstFlash>({
    active: false, x: 0, y: 0, cx: 0, cy: 0,
    w: 0, h: 0, tilt: 0, age: 0, intensity: 0,
  });
  const pendingBurstRef = useRef<
    { x: number; y: number; cardW: number; cardH: number } | null
  >(null);
  const fxDirtyRef = useRef(false);

  const sizeRef = useRef({ w: 0, h: 0 });
  const mouseRef = useRef({ x: 0, y: 0, tx: 0, ty: 0 });
  const dprRef = useRef(1);

  useImperativeHandle(ref, () => ({
    triggerBurst(clientX: number, clientY: number, cardW = 320, cardH = 420) {
      const canvas = bgCanvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      pendingBurstRef.current = {
        x: clientX - rect.left,
        y: clientY - rect.top,
        cardW,
        cardH,
      };
    },
  }));

  useEffect(() => {
    const bgCanvas = bgCanvasRef.current;
    const fxCanvas = fxCanvasRef.current;
    const container = containerRef.current;
    if (!bgCanvas || !fxCanvas || !container) return;
    const ctx = bgCanvas.getContext("2d");
    const fx = fxCanvas.getContext("2d");
    if (!ctx || !fx) return;

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
          z: Math.random(),
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
      for (const c of [bgCanvas!, fxCanvas!]) {
        c.width = w * dprRef.current;
        c.height = h * dprRef.current;
        c.style.width = `${w}px`;
        c.style.height = `${h}px`;
      }
      ctx!.setTransform(dprRef.current, 0, 0, dprRef.current, 0, 0);
      fx!.setTransform(dprRef.current, 0, 0, dprRef.current, 0, 0);
      sizeRef.current = { w, h };
      if (nodesRef.current.length === 0) buildNodes(w, h);
    }
    resize();
    window.addEventListener("resize", resize, { passive: true });

    /* ─── Mouse tracking (parallax) ────────────────────────────────── */
    function onMouseMove(e: MouseEvent) {
      const rect = bgCanvas!.getBoundingClientRect();
      mouseRef.current.tx = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouseRef.current.ty = ((e.clientY - rect.top) / rect.height) * 2 - 1;
    }
    window.addEventListener("mousemove", onMouseMove, { passive: true });

    const io = new IntersectionObserver(
      (entries) => { inViewRef.current = entries[0]?.isIntersecting ?? true; },
      { threshold: 0.03 }
    );
    io.observe(container);

    /* ─── Fire a burst ─────────────────────────────────────────────── */
    function applyBurst() {
      const burst = pendingBurstRef.current;
      if (!burst) return;
      pendingBurstRef.current = null;

      const { w } = sizeRef.current;
      const nodes = nodesRef.current;
      const burstR = 480;

      /* Flare surrounding ambient nodes */
      nodes.forEach((n) => {
        const dx = n.x - burst.x;
        const dy = n.y - burst.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < burstR) {
          const falloff = 1 - dist / burstR;
          n.glow = Math.max(n.glow, falloff * falloff);
        }
      });

      /* Long sweeping light ribbons */
      arcsRef.current.length = 0;
      const arcCount = isMobile() ? 14 : 26;
      const reach = Math.max(380, w * 0.52);
      const newArcs: LightArc[] = [];
      for (let i = 0; i < arcCount; i++) {
        const angle =
          (i / arcCount) * Math.PI * 2 + (Math.random() - 0.5) * 0.35;
        const len = reach * (0.45 + Math.random() * 0.85);

        /* Squash vertically so the ribbons fan out sideways like the reference */
        const endX = burst.x + Math.cos(angle) * len;
        const endY = burst.y + Math.sin(angle) * len * 0.66;

        const perpAngle =
          angle + (Math.random() > 0.5 ? 1 : -1) * (0.35 + Math.random() * 0.75);
        const perpDist = len * (0.16 + Math.random() * 0.34);
        const midX = (burst.x + endX) / 2 + Math.cos(perpAngle) * perpDist;
        const midY = (burst.y + endY) / 2 + Math.sin(perpAngle) * perpDist * 0.7;

        newArcs.push({
          ox: endX, oy: endY,
          cx: midX, cy: midY,
          ex: burst.x, ey: burst.y,
          progress: 0,
          speed: 0.55 + Math.random() * 0.75,
          intensity: 0.65 + Math.random() * 0.25,
          width: 1.9 + Math.random() * 2.7,
          decay: 0.975 + Math.random() * 0.015,
          tail: 0.55 + Math.random() * 0.35,
        });
      }
      arcsRef.current.push(...newArcs);

      /* Large phone wireframe, centred on the grid, rising out from behind it */
      const phoneW = Math.min(250, Math.max(160, burst.cardW * 0.66));
      const phoneH = phoneW * 1.9;
      const phoneBottom = burst.y + burst.cardH * 0.42;

      flashRef.current = {
        active: true,
        x: burst.x,
        y: burst.y,
        cx: burst.x,
        cy: phoneBottom - phoneH / 2,
        w: phoneW,
        h: phoneH,
        tilt: -0.085,
        age: 0,
        intensity: 1,
      };
    }

    /* ─── Rounded-rect path helper (traceable) ─────────────────────── */
    function roundedRectPath(
      c: CanvasRenderingContext2D,
      x: number, y: number, w: number, h: number, r: number
    ) {
      c.beginPath();
      c.moveTo(x + r, y);
      c.lineTo(x + w - r, y);
      c.quadraticCurveTo(x + w, y, x + w, y + r);
      c.lineTo(x + w, y + h - r);
      c.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
      c.lineTo(x + r, y + h);
      c.quadraticCurveTo(x, y + h, x, y + h - r);
      c.lineTo(x, y + r);
      c.quadraticCurveTo(x, y, x + r, y);
    }

    /* ─── Ambient layer ────────────────────────────────────────────── */
    function renderAmbient() {
      const { w, h } = sizeRef.current;
      const nodes = nodesRef.current;
      const m = mouseRef.current;

      m.x += (m.tx - m.x) * 0.05;
      m.y += (m.ty - m.y) * 0.05;

      ctx!.clearRect(0, 0, w, h);

      /* Warm haze across the upper band */
      const haze = ctx!.createLinearGradient(0, 0, 0, h * 0.55);
      haze.addColorStop(0, rgba(168, 108, 34, 0.14));
      haze.addColorStop(0.45, rgba(150, 96, 30, 0.05));
      haze.addColorStop(1, rgba(150, 96, 30, 0));
      ctx!.fillStyle = haze;
      ctx!.fillRect(0, 0, w, h * 0.55);

      const renderNodes = nodes.map((n) => {
        const pFactor = (1 - n.z) * PARALLAX_STRENGTH;
        return { ...n, px: n.x + m.x * pFactor, py: n.y + m.y * pFactor };
      });

      /* 1. Connections */
      const linkDistSq = LINK_DISTANCE * LINK_DISTANCE;
      for (let i = 0; i < renderNodes.length; i++) {
        const a = renderNodes[i];
        for (let j = i + 1; j < renderNodes.length; j++) {
          const b = renderNodes[j];
          const dx = a.px - b.px;
          const dy = a.py - b.py;
          const distSq = dx * dx + dy * dy;
          if (distSq > linkDistSq) continue;
          if (Math.abs(a.z - b.z) > 0.4) continue;

          const dist = Math.sqrt(distSq);
          const distFactor = 1 - dist / LINK_DISTANCE;
          const avgZ = (a.z + b.z) / 2;
          const avgGlow = (a.glow + b.glow) / 2;

          const zAlpha = 1 - avgZ * 0.55;
          const baseAlpha = distFactor * 0.3 * zAlpha;
          const alpha = Math.min(1, baseAlpha + avgGlow * 0.8);
          if (alpha < 0.01) continue;

          const lw = (1 - avgZ) * 1.6 + avgGlow * 2.5 + 0.5;

          ctx!.beginPath();
          ctx!.moveTo(a.px, a.py);
          ctx!.lineTo(b.px, b.py);

          if (avgGlow > 0.1) {
            // Fake glow
            ctx!.strokeStyle = rgba(GOLD_R, GOLD_G, GOLD_B, avgGlow * 0.3 * alpha);
            ctx!.lineWidth = lw * 4;
            ctx!.stroke();
            
            // Core
            ctx!.strokeStyle = rgba(BRIGHT_R, BRIGHT_G, BRIGHT_B, alpha);
            ctx!.lineWidth = lw;
            ctx!.stroke();
          } else {
            ctx!.strokeStyle = rgba(232, 164, 62, alpha);
            ctx!.lineWidth = lw;
            ctx!.stroke();
          }
        }
      }

      /* 2. Bokeh nodes */
      for (const n of renderNodes) {
        const bokehSize = n.baseRadius + n.z * 6;
        const r = bokehSize + n.glow * 5;
        const zAlpha = 1 - n.z * 0.5;
        const alpha = Math.min(1, 0.5 * zAlpha + n.glow);

        if (n.z > 0.5 && n.glow < 0.1) {
          const grad = ctx!.createRadialGradient(n.px, n.py, 0, n.px, n.py, r * 1.6);
          grad.addColorStop(0, rgba(232, 164, 62, alpha * 0.55));
          grad.addColorStop(1, rgba(232, 164, 62, 0));
          ctx!.fillStyle = grad;
          ctx!.beginPath();
          ctx!.arc(n.px, n.py, r * 1.6, 0, Math.PI * 2);
          ctx!.fill();
        } else {
          // Halo only on the nearest / flaring nodes — keeps the frame cheap
          if (n.z < 0.3 || n.glow > 0.05) {
            const halo = ctx!.createRadialGradient(n.px, n.py, 0, n.px, n.py, r * 4);
            halo.addColorStop(0, rgba(GOLD_R, GOLD_G, GOLD_B, alpha * 0.22));
            halo.addColorStop(1, rgba(GOLD_R, GOLD_G, GOLD_B, 0));
            ctx!.fillStyle = halo;
            ctx!.beginPath();
            ctx!.arc(n.px, n.py, r * 4, 0, Math.PI * 2);
            ctx!.fill();
          }

          ctx!.beginPath();
          ctx!.fillStyle = rgba(BRIGHT_R, BRIGHT_G, BRIGHT_B, alpha);
          ctx!.arc(n.px, n.py, r, 0, Math.PI * 2);
          ctx!.fill();

          if (n.glow > 0.1) {
            ctx!.beginPath();
            ctx!.fillStyle = rgba(WHITE_GOLD_R, WHITE_GOLD_G, WHITE_GOLD_B, n.glow * 0.85);
            ctx!.arc(n.px, n.py, r * 0.45, 0, Math.PI * 2);
            ctx!.fill();
          }
        }
      }
    }

    /* ─── FX layer (over the cards) ────────────────────────────────── */
    function renderFx() {
      const { w, h } = sizeRef.current;
      const arcs = arcsRef.current;
      const flash = flashRef.current;

      fx!.clearRect(0, 0, w, h);
      if (!flash.active && arcs.length === 0) {
        fxDirtyRef.current = false;
        return;
      }
      fxDirtyRef.current = true;

      /* Global life envelope: 1 while holding, then ease out */
      const life =
        flash.age <= HOLD_UNTIL
          ? 1
          : Math.max(0, 1 - (flash.age - HOLD_UNTIL) / FADE_DUR);
      const ease = life * life;

      fx!.save();
      fx!.globalCompositeOperation = "lighter";

      /* 1. Central bloom */
      if (flash.active && flash.intensity > 0.01) {
        const r = 220;
        const grad = fx!.createRadialGradient(flash.x, flash.y, 0, flash.x, flash.y, r);
        grad.addColorStop(0, rgba(WHITE_GOLD_R, WHITE_GOLD_G, WHITE_GOLD_B, flash.intensity * 0.32));
        grad.addColorStop(0.18, rgba(BRIGHT_R, BRIGHT_G, BRIGHT_B, flash.intensity * 0.14));
        grad.addColorStop(1, rgba(GOLD_R, GOLD_G, GOLD_B, 0));
        fx!.fillStyle = grad;
        fx!.beginPath();
        fx!.arc(flash.x, flash.y, r, 0, Math.PI * 2);
        fx!.fill();

        /* Lock symbol in the center */
        fx!.save();
        fx!.translate(flash.x, flash.y);
        const lockScale = 2.5 + (1 - ease) * 0.5; // slight scale up as it fades
        fx!.scale(lockScale, lockScale);
        fx!.translate(-12, -12);
        
        fx!.lineCap = "round";
        fx!.lineJoin = "round";
        const lockPath = new Path2D("M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z");
        
        // Fake glow
        fx!.strokeStyle = rgba(GOLD_R, GOLD_G, GOLD_B, ease * 0.4);
        fx!.lineWidth = 4;
        fx!.stroke(lockPath);
        
        // Core
        fx!.strokeStyle = rgba(WHITE_GOLD_R, WHITE_GOLD_G, WHITE_GOLD_B, ease);
        fx!.lineWidth = 1.5;
        fx!.stroke(lockPath);
        
        fx!.restore();
      }

      /* 2. Sweeping light ribbons */
      for (const arc of arcs) {
        const amp = arc.intensity * ease;
        if (amp < 0.01) continue;
        const headT = Math.min(arc.progress, 1);
        const tailT = Math.max(0, arc.progress - arc.tail);
        if (headT <= tailT) continue;

        for (let pass = 0; pass < 2; pass++) {
          const isGlow = pass === 0;
          const alpha = isGlow ? amp * 0.13 : amp * 0.9;
          const lineW = isGlow ? arc.width * 6 : arc.width;

          fx!.strokeStyle = isGlow
            ? rgba(GOLD_R, GOLD_G, GOLD_B, alpha)
            : rgba(WHITE_GOLD_R, WHITE_GOLD_G, WHITE_GOLD_B, alpha);
          fx!.lineWidth = lineW;
          fx!.lineCap = "round";
          fx!.lineJoin = "round";

          fx!.beginPath();
          for (let s = 0; s <= 24; s++) {
            const t = tailT + (headT - tailT) * (s / 24);
            const mt = 1 - t;
            const px = mt * mt * arc.ox + 2 * mt * t * arc.cx + t * t * arc.ex;
            const py = mt * mt * arc.oy + 2 * mt * t * arc.cy + t * t * arc.ey;
            if (s === 0) fx!.moveTo(px, py);
            else fx!.lineTo(px, py);
          }
          fx!.stroke();
        }
      }

      /* 3. Phone wireframe — traces itself in, then holds and fades */
      if (flash.active) {
        const trace = Math.min(1, flash.age / TRACE_DUR);
        const teased = 1 - Math.pow(1 - trace, 3); // easeOutCubic
        const pw = flash.w;
        const ph = flash.h;
        const pr = pw * 0.17;
        const px = -pw / 2;
        const py = -ph / 2;

        const perim = 2 * (pw + ph) - 8 * pr + 2 * Math.PI * pr;

        fx!.save();
        fx!.translate(flash.cx, flash.cy);
        fx!.rotate(flash.tilt);

        /* Outer shell — two passes: soft bloom + bright core */
        for (let pass = 0; pass < 2; pass++) {
          const isGlow = pass === 0;
          fx!.setLineDash([perim * teased, perim]);
          fx!.lineDashOffset = 0;
          fx!.lineCap = "round";
          fx!.strokeStyle = isGlow
            ? rgba(GOLD_R, GOLD_G, GOLD_B, ease * 0.28)
            : rgba(WHITE_GOLD_R, WHITE_GOLD_G, WHITE_GOLD_B, ease * 0.95);
          fx!.lineWidth = isGlow ? 13 : 2.8;
          roundedRectPath(fx!, px, py, pw, ph, pr);
          fx!.stroke();
        }
        fx!.setLineDash([]);

        /* Interior details fade in once the shell is mostly drawn */
        const detail = Math.max(0, (teased - 0.55) / 0.45) * ease;
        if (detail > 0.01) {
          /* Speaker bar */
          const sw = pw * 0.3;
          fx!.strokeStyle = rgba(WHITE_GOLD_R, WHITE_GOLD_G, WHITE_GOLD_B, detail * 0.9);
          fx!.lineWidth = 2;
          fx!.beginPath();
          fx!.roundRect(-sw / 2, py + ph * 0.045, sw, Math.max(3, ph * 0.012), 3);
          fx!.stroke();

          /* Inner screen rim */
          fx!.strokeStyle = rgba(GOLD_R, GOLD_G, GOLD_B, detail * 0.42);
          fx!.lineWidth = 1.2;
          fx!.beginPath();
          fx!.roundRect(
            px + pw * 0.07, py + ph * 0.075,
            pw * 0.86, ph * 0.86,
            pr * 0.72
          );
          fx!.stroke();

          /* Home indicator */
          fx!.strokeStyle = rgba(WHITE_GOLD_R, WHITE_GOLD_G, WHITE_GOLD_B, detail * 0.6);
          fx!.lineWidth = 2.4;
          fx!.lineCap = "round";
          fx!.beginPath();
          fx!.moveTo(-pw * 0.16, py + ph * 0.955);
          fx!.lineTo(pw * 0.16, py + ph * 0.955);
          fx!.stroke();
        }

        fx!.restore();
      }

      fx!.restore();
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

      /* Drift ambient nodes */
      for (const n of nodes) {
        n.x += n.vx;
        n.y += n.vy;
        if (n.x < -100 || n.x > w + 100) n.vx *= -1;
        if (n.y < -100 || n.y > h + 100) n.vy *= -1;
        n.glow *= GLOW_DECAY;
        if (n.glow < 0.001) n.glow = 0;
      }

      /* Advance ribbons */
      for (let i = arcs.length - 1; i >= 0; i--) {
        const arc = arcs[i];
        arc.progress += arc.speed * 0.016;
        arc.intensity *= arc.decay;
        if (arc.intensity < 0.004 || arc.progress > 1 + arc.tail + 0.2) {
          arcs.splice(i, 1);
        }
      }

      /* Advance burst */
      if (flash.active) {
        flash.age += 0.016;
        flash.intensity *= 0.955;
        if (flash.age > BURST_LIFE) {
          flash.active = false;
          arcs.length = 0;
        }
      }

      applyBurst();
      renderAmbient();
      if (flash.active || arcs.length > 0 || fxDirtyRef.current) renderFx();

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
    <>
      {/* Ambient plexus — sits behind the section content */}
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
        <canvas
          ref={bgCanvasRef}
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
        />
      </div>

      {/* Burst FX — sibling layer above the card grid, additively blended, so
          the light sweeps across the translucent cards as in the reference */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          zIndex: 25,
          pointerEvents: "none",
          overflow: "hidden",
        }}
        aria-hidden="true"
      >
        <canvas
          ref={fxCanvasRef}
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
        />
      </div>
    </>
  );
});

ConstellationBg.displayName = "ConstellationBg";
export default ConstellationBg;
