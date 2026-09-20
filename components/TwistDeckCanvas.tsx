"use client";

import {
  useEffect,
  useRef,
  useImperativeHandle,
  forwardRef,
  useCallback,
} from "react";

/* ═══════════════════════════════════════════════════════════════════════════
   TwistDeckCanvas — Full 2D Cinematic Background for the Twist Deck Section

   State machine: ENTRANCE → IDLE → REVEALING → SETTLED → RESETTING
   
   12-beat choreography on click:
     0.0s  Ignite pad + ribbons
     0.5s  Shockwave + callout
     1.0s  Shockwave max
     1.5s  Deck lifts + tilts + halo ribbons
     2.0s  Deck edge-on + flip-pop sparks
     2.5s  Deck turning + radial explosion
     3.0s  Face-on + border ignite + scan comet
     3.5s  Light thread to rail
     4.0s  Node flare
     4.5s  Hold
     5.0s  Flip to back (edge-on)
     5.5s  Back face shown → SETTLED
   ═══════════════════════════════════════════════════════════════════════════ */

export type TwistDeckCanvasHandle = {
  triggerReveal: () => void;
  getState: () => SceneState;
};

export type SceneState = "ENTRANCE" | "IDLE" | "REVEALING" | "SETTLED" | "RESETTING";

/* ─── Color constants ──────────────────────────────────────────────────── */
const GOLD_R = 217, GOLD_G = 169, GOLD_B = 74;
const BRIGHT_R = 244, BRIGHT_G = 200, BRIGHT_B = 98;
const WHITE_GOLD_R = 255, WHITE_GOLD_G = 230, WHITE_GOLD_B = 160;
const DIM_R = 58, DIM_G = 50, DIM_B = 38;

function rgba(r: number, g: number, b: number, a: number) {
  return `rgba(${r},${g},${b},${Math.max(0, Math.min(1, a)).toFixed(4)})`;
}

/* ─── Easing functions ─────────────────────────────────────────────────── */
function easeOutExpo(t: number) { return t === 1 ? 1 : 1 - Math.pow(2, -10 * t); }
function easeInOutPower3(t: number) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
function easeOutPower2(t: number) { return 1 - (1 - t) * (1 - t); }
function easeOutPower3(t: number) { return 1 - Math.pow(1 - t, 3); }
function easeInOutSine(t: number) { return -(Math.cos(Math.PI * t) - 1) / 2; }
function easeOutSine(t: number) { return Math.sin((t * Math.PI) / 2); }

/* ─── Types ────────────────────────────────────────────────────────────── */
interface Star {
  x: number; y: number;
  size: number;
  alpha: number;
  vx: number; vy: number;
}

interface OrbitRing {
  rx: number; ry: number; // radii as fraction of canvas width
  tilt: number; // degrees
  phase: number; // current rotation angle
  speed: number; // degrees per second
  alpha: number;
}

interface DustBead {
  ringIdx: number;
  angle: number;
  speed: number; // degrees per second
  size: number;
  alpha: number;
  zOffset: number; // slight depth variation
}

interface LightRibbon {
  ringIdx: number;
  headAngle: number;
  arcLength: number; // degrees
  speed: number;
  alpha: number;
  life: number; // 0→1, fades as approaches 1
  maxLife: number;
}

interface Spark {
  x: number; y: number;
  vx: number; vy: number;
  life: number;
  maxLife: number;
  size: number;
  alpha: number;
}

interface Shockwave {
  cx: number; cy: number;
  radius: number;
  maxRadius: number;
  alpha: number;
  life: number;
}

interface LightThread {
  startX: number; startY: number;
  endX: number; endY: number;
  controlX: number; controlY: number;
  progress: number; // 0→1
  alpha: number;
  particles: Array<{ t: number; alpha: number; size: number }>;
}

/* ─── Configuration ────────────────────────────────────────────────────── */
const STAR_COUNT = 150;
const RING_COUNT = 6;
const DUST_COUNT = 200;
const ENTRANCE_DUR = 3.0;
const REVEAL_DUR = 5.5;
const RESET_DUR = 1.4;

const CARD_ASPECT = 3 / 4; // width / height
const CARD_HEIGHT_FRAC = 0.22; // fraction of canvas height

/* ═══════════════════════════════════════════════════════════════════════════ */

interface TwistDeckCanvasProps {
  text?: string;
  onReset?: () => void;
}

const TwistDeckCanvas = forwardRef<TwistDeckCanvasHandle, TwistDeckCanvasProps>((props, ref) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const rafRef = useRef<number>(0);
  const stateRef = useRef<SceneState>("ENTRANCE");
  const entranceTimeRef = useRef(0);
  const revealTimeRef = useRef(0);
  const resetTimeRef = useRef(0);
  const entranceDoneRef = useRef(false);
  const inViewRef = useRef(true);
  const sizeRef = useRef({ w: 0, h: 0 });
  const dprRef = useRef(1);
  const mouseRef = useRef({ x: 0, y: 0, tx: 0, ty: 0 });
  const lastTimeRef = useRef(0);
  const vignetteCacheRef = useRef<{ w: number; h: number; cx: number; cy: number; grad: CanvasGradient | null }>({ w: 0, h: 0, cx: 0, cy: 0, grad: null });

  // Scene data
  const starsRef = useRef<Star[]>([]);
  const ringsRef = useRef<OrbitRing[]>([]);
  const dustRef = useRef<DustBead[]>([]);
  const ribbonsRef = useRef<LightRibbon[]>([]);
  const sparksRef = useRef<Spark[]>([]);
  const shockwavesRef = useRef<Shockwave[]>([]);
  const threadRef = useRef<LightThread | null>(null);

  // Animation state
  const ringScaleRef = useRef(1.0);
  const deckYawRef = useRef(0); // degrees
  const deckLiftRef = useRef(0); // 0→1
  const deckTiltRef = useRef(0); // 0→1
  const borderGlowRef = useRef(0);
  const bloomIntensityRef = useRef(0);
  const nodeFlareRef = useRef(0);
  const calloutAlphaRef = useRef(0);
  const scanCometRef = useRef({ active: false, progress: 0 });
  const showFrontRef = useRef(false);
  const lockAlphaRef = useRef(0);

  // Rail node positions and DOM measurements
  const railNodesRef = useRef<Array<{ x: number; y: number; label: string }>>([]);
  const cardPosRef = useRef({ x: 0, y: 0, w: 0, h: 0 });
  const nodePosRef = useRef({ x: 0, y: 0 });
  const timelineBottomRef = useRef(0);

  const pendingRevealRef = useRef(false);

  useImperativeHandle(ref, () => ({
    triggerReveal() {
      const state = stateRef.current;
      if (state === "REVEALING" || state === "RESETTING") return;
      if (state === "SETTLED") {
        // Reset first, then reveal
        stateRef.current = "RESETTING";
        resetTimeRef.current = 0;
        pendingRevealRef.current = true;
        return;
      }
      // If IDLE or ENTRANCE, we can start revealing immediately
      startReveal();
    },
    getState() {
      return stateRef.current;
    },
  }));

  const startReveal = useCallback(() => {
    stateRef.current = "REVEALING";
    revealTimeRef.current = 0;
    ringScaleRef.current = 1.0;
    deckYawRef.current = 0;
    deckLiftRef.current = 0;
    deckTiltRef.current = 0;
    borderGlowRef.current = 0;
    bloomIntensityRef.current = 0;
    nodeFlareRef.current = 0;
    calloutAlphaRef.current = 0;
    scanCometRef.current = { active: false, progress: 0 };
    showFrontRef.current = false;
    lockAlphaRef.current = 0;
    sparksRef.current = [];
    shockwavesRef.current = [];
    threadRef.current = null;
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const isMobile = () => window.innerWidth < 768;

    /* ─── Build stars ──────────────────────────────────────────────── */
    function buildStars(w: number, h: number) {
      const stars: Star[] = [];
      for (let i = 0; i < STAR_COUNT; i++) {
        stars.push({
          x: Math.random() * w,
          y: Math.random() * h,
          size: 0.5 + Math.random() * 1.5,
          alpha: 0.15 + Math.random() * 0.4,
          vx: (Math.random() - 0.5) * 0.03,
          vy: (Math.random() - 0.5) * 0.03,
        });
      }
      starsRef.current = stars;
    }

    /* ─── Build orbit rings ────────────────────────────────────────── */
    function buildRings() {
      const rings: OrbitRing[] = [];
      for (let i = 0; i < RING_COUNT; i++) {
        const baseR = 0.20 + i * 0.05;
        rings.push({
          rx: baseR + Math.random() * 0.02,
          ry: (baseR + Math.random() * 0.02) * 0.22, // flattened elliptical orbit so it stays cleanly below the timeline
          tilt: (Math.random() - 0.5) * 12, // ±6 degrees
          phase: Math.random() * 360,
          speed: (8 + Math.random() * 6) * (i % 2 === 0 ? -1 : 1),
          alpha: 0.22 + Math.random() * 0.28,
        });
      }
      ringsRef.current = rings;
    }

    /* ─── Build dust beads ─────────────────────────────────────────── */
    function buildDust() {
      const count = isMobile() ? Math.floor(DUST_COUNT * 0.5) : DUST_COUNT;
      const dust: DustBead[] = [];
      for (let i = 0; i < count; i++) {
        dust.push({
          ringIdx: Math.floor(Math.random() * RING_COUNT),
          angle: Math.random() * 360,
          speed: (15 + Math.random() * 20) * (Math.random() > 0.5 ? -1 : 1),
          size: 1.5 + Math.random() * 3.5,
          alpha: 0.3 + Math.random() * 0.5,
          zOffset: (Math.random() - 0.5) * 0.03,
        });
      }
      dustRef.current = dust;
    }

    /* ─── Build entrance ribbons ───────────────────────────────────── */
    function buildEntranceRibbons() {
      const ribbons: LightRibbon[] = [];
      for (let i = 0; i < 4; i++) {
        ribbons.push({
          ringIdx: Math.floor(Math.random() * RING_COUNT),
          headAngle: Math.random() * 360,
          arcLength: 40 + Math.random() * 80,
          speed: 80 + Math.random() * 60,
          alpha: 0.6 + Math.random() * 0.3,
          life: 0,
          maxLife: 1.5 + Math.random() * 0.5,
        });
      }
      ribbonsRef.current = ribbons;
    }

    /* ─── Measure DOM elements ─────────────────────────────────────── */
    function updateLayout() {
      if (!container) return;
      const contRect = container.getBoundingClientRect();
      const w = contRect.width;
      const h = contRect.height;
      if (w === 0 || h === 0) return;

      const cardAnchor = document.getElementById("twist-card-anchor");
      if (cardAnchor) {
        const r = cardAnchor.getBoundingClientRect();
        cardPosRef.current = {
          x: r.left + r.width / 2 - contRect.left,
          y: r.top + r.height / 2 - contRect.top,
          w: r.width,
          h: r.height,
        };
      } else {
        cardPosRef.current = {
          x: w / 2,
          y: h * 0.67,
          w: Math.min(208, w * 0.22),
          h: Math.min(288, h * 0.36),
        };
      }

      const hr3Node = document.getElementById("twist-node-hr3");
      if (hr3Node) {
        const r = hr3Node.getBoundingClientRect();
        nodePosRef.current = {
          x: r.left + r.width / 2 - contRect.left,
          y: r.top + r.height / 2 - contRect.top,
        };
      } else {
        nodePosRef.current = {
          x: w / 2,
          y: h * 0.42,
        };
      }

      const timelineEl = document.getElementById("twist-timeline-desktop");
      if (timelineEl) {
        const r = timelineEl.getBoundingClientRect();
        timelineBottomRef.current = r.bottom - contRect.top;
      } else {
        timelineBottomRef.current = h * 0.45;
      }
    }

    /* ─── Resize ───────────────────────────────────────────────────── */
    function resize() {
      const rect = container!.getBoundingClientRect();
      dprRef.current = Math.min(window.devicePixelRatio || 1, 1.75);
      const w = rect.width;
      const h = rect.height;
      canvas!.width = w * dprRef.current;
      canvas!.height = h * dprRef.current;
      canvas!.style.width = `${w}px`;
      canvas!.style.height = `${h}px`;
      ctx!.setTransform(dprRef.current, 0, 0, dprRef.current, 0, 0);
      sizeRef.current = { w, h };
      updateLayout();
    }

    /* ─── Init ─────────────────────────────────────────────────────── */
    resize();
    updateLayout();
    const { w, h } = sizeRef.current;
    buildStars(w, h);
    buildRings();
    buildDust();
    buildEntranceRibbons();

    window.addEventListener("resize", resize, { passive: true });

    function onMouseMove(e: MouseEvent) {
      const rect = canvas!.getBoundingClientRect();
      mouseRef.current.tx = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouseRef.current.ty = ((e.clientY - rect.top) / rect.height) * 2 - 1;
    }
    window.addEventListener("mousemove", onMouseMove, { passive: true });

    const io = new IntersectionObserver(
      (entries) => {
        inViewRef.current = entries[0]?.isIntersecting ?? true;
        if (inViewRef.current) updateLayout();
      },
      { threshold: 0.05 }
    );
    io.observe(container);

    /* ─── Helper: get ring point ───────────────────────────────────── */
    function ringPoint(ring: OrbitRing, angleDeg: number, cx: number, cy: number, scale: number) {
      const a = (angleDeg + ring.phase) * Math.PI / 180;
      const tiltRad = ring.tilt * Math.PI / 180;
      const rx = ring.rx * sizeRef.current.w * scale;
      const ry = ring.ry * sizeRef.current.h * 0.85 * scale;
      const x0 = Math.cos(a) * rx;
      const y0 = Math.sin(a) * ry;
      // Apply tilt rotation around X axis (foreshortening)
      const x = x0;
      const y = y0 * Math.cos(tiltRad);
      return { x: cx + x, y: cy + y };
    }

    /* ─── Spawn shockwave ──────────────────────────────────────────── */
    function spawnShockwave(cx: number, cy: number) {
      const maxR = Math.min(sizeRef.current.w, sizeRef.current.h) * 0.45;
      shockwavesRef.current.push({
        cx, cy, radius: 10, maxRadius: maxR, alpha: 0.8, life: 0,
      });
      shockwavesRef.current.push({
        cx, cy, radius: 5, maxRadius: maxR * 0.7, alpha: 0.5, life: 0,
      });
    }

    /* ─── Spawn sparks ─────────────────────────────────────────────── */
    function spawnFanSparks(cx: number, cy: number, count: number) {
      for (let i = 0; i < count; i++) {
        const angle = (Math.random() > 0.5 ? 0 : Math.PI) + (Math.random() - 0.5) * 0.8;
        const speed = 150 + Math.random() * 300;
        sparksRef.current.push({
          x: cx, y: cy,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed * 0.3,
          life: 0, maxLife: 0.4 + Math.random() * 0.3,
          size: 1 + Math.random() * 2,
          alpha: 0.7 + Math.random() * 0.3,
        });
      }
    }

    function spawnRadialSparks(cx: number, cy: number, count: number) {
      for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 80 + Math.random() * 250;
        sparksRef.current.push({
          x: cx, y: cy,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed + (Math.random() - 0.3) * 40,
          life: 0, maxLife: 0.6 + Math.random() * 0.8,
          size: 1 + Math.random() * 2.5,
          alpha: 0.6 + Math.random() * 0.4,
        });
      }
    }

    function spawnNodeSparks(cx: number, cy: number, count: number) {
      for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 40 + Math.random() * 100;
        sparksRef.current.push({
          x: cx, y: cy,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          life: 0, maxLife: 0.4 + Math.random() * 0.5,
          size: 1 + Math.random() * 1.5,
          alpha: 0.7 + Math.random() * 0.3,
        });
      }
    }

    /* ─── Spawn light thread ───────────────────────────────────────── */
    function spawnLightThread(sx: number, sy: number, ex: number, ey: number) {
      const midX = (sx + ex) / 2 + (Math.random() - 0.5) * 60;
      const midY = Math.min(sy, ey) - 40 - Math.random() * 30;
      const particles: LightThread["particles"] = [];
      for (let i = 0; i < 40; i++) {
        particles.push({ t: Math.random(), alpha: 0.3 + Math.random() * 0.7, size: 1 + Math.random() * 2 });
      }
      threadRef.current = {
        startX: sx, startY: sy, endX: ex, endY: ey,
        controlX: midX, controlY: midY,
        progress: 0, alpha: 1, particles,
      };
    }

    /* ─── Spawn reveal ribbons ─────────────────────────────────────── */
    function spawnRevealRibbons(count: number) {
      for (let i = 0; i < count; i++) {
        ribbonsRef.current.push({
          ringIdx: Math.floor(Math.random() * RING_COUNT),
          headAngle: Math.random() * 360,
          arcLength: 50 + Math.random() * 70,
          speed: 100 + Math.random() * 80,
          alpha: 0.7 + Math.random() * 0.3,
          life: 0,
          maxLife: 0.8 + Math.random() * 0.5,
        });
      }
    }

    /* ═════════════════════════════════════════════════════════════════
       RENDER FRAME
       ═════════════════════════════════════════════════════════════════ */
    function render(dt: number) {
      const { w, h } = sizeRef.current;
      if (cardPosRef.current.w === 0) {
        updateLayout();
      }
      const cardPos = cardPosRef.current;
      const cx = cardPos.w > 0 ? cardPos.x : w / 2;
      const timelineBottom = timelineBottomRef.current || (h * 0.45);
      // Simulation effect center: explicitly moved downwards so the orbit rings stay below the timeline
      const orbitCY = cardPos.h > 0
        ? Math.max(cardPos.y + 25, timelineBottom + 115)
        : Math.max(h * 0.68, timelineBottom + 115);

      const state = stateRef.current;
      const rings = ringsRef.current;
      const dust = dustRef.current;
      const scale = ringScaleRef.current;

      // Smooth mouse
      const m = mouseRef.current;
      m.x += (m.tx - m.x) * 0.04;
      m.y += (m.ty - m.y) * 0.04;

      ctx!.clearRect(0, 0, w, h);

      // ── Vignette background ──
      if (vignetteCacheRef.current.w !== w || vignetteCacheRef.current.h !== h || vignetteCacheRef.current.cx !== cx || vignetteCacheRef.current.cy !== orbitCY) {
        const vignette = ctx!.createRadialGradient(cx, orbitCY, 0, cx, orbitCY, Math.max(w, h) * 0.7);
        vignette.addColorStop(0, "rgba(7,9,13,0)");
        vignette.addColorStop(1, "rgba(3,2,5,0.6)");
        vignetteCacheRef.current = { w, h, cx, cy: orbitCY, grad: vignette };
      }
      ctx!.fillStyle = vignetteCacheRef.current.grad!;
      ctx!.fillRect(0, 0, w, h);

      // ── Stars ──
      const stars = starsRef.current;
      for (const s of stars) {
        s.x += s.vx;
        s.y += s.vy;
        if (s.x < 0) s.x = w;
        if (s.x > w) s.x = 0;
        if (s.y < 0) s.y = h;
        if (s.y > h) s.y = 0;

        ctx!.fillStyle = rgba(WHITE_GOLD_R, WHITE_GOLD_G, WHITE_GOLD_B, s.alpha * 0.5);
        ctx!.fillRect(s.x - s.size, s.y - s.size, s.size * 2, s.size * 2);
      }

      // ── Entrance fade multiplier ──
      let entranceFade = 1;
      if (state === "ENTRANCE") {
        entranceFade = Math.min(1, entranceTimeRef.current / 1.2);
      }

      // ── Orbit rings ──
      for (const ring of rings) {
        ring.phase += ring.speed * dt;
        const points: Array<{ x: number; y: number }> = [];
        for (let a = 0; a <= 360; a += 6) {
          points.push(ringPoint(ring, a, cx, orbitCY, scale));
        }

        ctx!.beginPath();
        for (let i = 0; i < points.length; i++) {
          if (i === 0) ctx!.moveTo(points[i].x, points[i].y);
          else ctx!.lineTo(points[i].x, points[i].y);
        }
        ctx!.closePath();
        ctx!.strokeStyle = rgba(GOLD_R, GOLD_G, GOLD_B, ring.alpha * entranceFade * 0.7);
        ctx!.lineWidth = 1;
        ctx!.stroke();
      }

      // ── Dust beads (simplified — no per-bead gradient for performance) ──
      for (const bead of dust) {
        bead.angle += bead.speed * dt;
        const ring = rings[bead.ringIdx];
        if (!ring) continue;
        const p = ringPoint(ring, bead.angle, cx, orbitCY, scale);
        const fadeAlpha = bead.alpha * entranceFade;

        // Simple filled rect instead of arc for performance
        ctx!.fillStyle = rgba(GOLD_R, GOLD_G, GOLD_B, fadeAlpha * 0.8);
        ctx!.fillRect(p.x - bead.size, p.y - bead.size, bead.size * 2, bead.size * 2);

        // Tiny specular highlight
        if (bead.size > 2) {
          ctx!.fillStyle = rgba(BRIGHT_R, BRIGHT_G, BRIGHT_B, fadeAlpha * 0.5);
          ctx!.fillRect(p.x - bead.size * 0.2, p.y - bead.size * 0.3, bead.size * 0.7, bead.size * 0.7);
        }
      }

      // ── Light ribbons ──
      const ribbons = ribbonsRef.current;
      for (let i = ribbons.length - 1; i >= 0; i--) {
        const r = ribbons[i];
        r.life += dt;
        r.headAngle += r.speed * dt;
        const lifeT = r.life / r.maxLife;
        if (lifeT >= 1) { ribbons.splice(i, 1); continue; }

        const ring = rings[r.ringIdx];
        if (!ring) continue;
        const fadeOut = lifeT > 0.6 ? 1 - (lifeT - 0.6) / 0.4 : 1;
        const fadeIn = Math.min(1, lifeT / 0.15);
        const alpha = r.alpha * fadeIn * fadeOut * entranceFade;

        ctx!.beginPath();
        const segments = 30;
        for (let s = 0; s <= segments; s++) {
          const angleDeg = r.headAngle - (s / segments) * r.arcLength;
          const p = ringPoint(ring, angleDeg, cx, orbitCY, scale);
          const segAlpha = 1 - s / segments; // head bright, tail fades
          if (s === 0) {
            ctx!.moveTo(p.x, p.y);
          } else {
            ctx!.lineTo(p.x, p.y);
          }
        }
        ctx!.lineCap = "round";
        // Fake glow via thicker stroke
        ctx!.strokeStyle = rgba(GOLD_R, GOLD_G, GOLD_B, alpha * 0.35);
        ctx!.lineWidth = 9;
        ctx!.stroke();
        // Core
        ctx!.strokeStyle = rgba(WHITE_GOLD_R, WHITE_GOLD_G, WHITE_GOLD_B, alpha);
        ctx!.lineWidth = 2.5;
        ctx!.stroke();
      }

      // ── Shockwaves ──
      const shockwaves = shockwavesRef.current;
      for (let i = shockwaves.length - 1; i >= 0; i--) {
        const sw = shockwaves[i];
        sw.life += dt * 0.8;
        sw.radius += (sw.maxRadius - sw.radius) * dt * 2;
        sw.alpha *= 0.97;
        if (sw.alpha < 0.01) { shockwaves.splice(i, 1); continue; }

        // Ring
        ctx!.beginPath();
        ctx!.ellipse(sw.cx, sw.cy, sw.radius, sw.radius * 0.30, 0, 0, Math.PI * 2);
        ctx!.strokeStyle = rgba(WHITE_GOLD_R, WHITE_GOLD_G, WHITE_GOLD_B, sw.alpha);
        ctx!.lineWidth = 2;
        ctx!.stroke();
        
        // Simulated glow without shadowBlur
        if (sw.alpha > 0.05) {
          ctx!.strokeStyle = rgba(GOLD_R, GOLD_G, GOLD_B, sw.alpha * 0.3);
          ctx!.lineWidth = 8;
          ctx!.stroke();
        }

        // Inner glow disc
        const discGrad = ctx!.createRadialGradient(sw.cx, sw.cy, 0, sw.cx, sw.cy, sw.radius);
        discGrad.addColorStop(0, rgba(GOLD_R, GOLD_G, GOLD_B, sw.alpha * 0.08));
        discGrad.addColorStop(1, rgba(GOLD_R, GOLD_G, GOLD_B, 0));
        ctx!.fillStyle = discGrad;
        ctx!.beginPath();
        ctx!.arc(sw.cx, sw.cy, sw.radius, 0, Math.PI * 2);
        ctx!.fill();
      }

      // ── Sparks ──
      const sparks = sparksRef.current;
      for (let i = sparks.length - 1; i >= 0; i--) {
        const sp = sparks[i];
        sp.life += dt;
        const t = sp.life / sp.maxLife;
        if (t >= 1) { sparks.splice(i, 1); continue; }

        sp.x += sp.vx * dt;
        sp.y += sp.vy * dt;
        sp.vy += 30 * dt; // gravity
        const alpha = sp.alpha * (1 - t);

        // Head dot (fillRect for performance)
        ctx!.fillStyle = rgba(BRIGHT_R, BRIGHT_G, BRIGHT_B, alpha);
        ctx!.fillRect(sp.x - sp.size * 0.8, sp.y - sp.size * 0.8, sp.size * 1.6, sp.size * 1.6);
      }

      // ── Deck card ──
      const cardW = cardPos.w > 0 ? cardPos.w : (h * CARD_HEIGHT_FRAC * CARD_ASPECT);
      const cardH = cardPos.h > 0 ? cardPos.h : (h * CARD_HEIGHT_FRAC);
      const deckCX = cardPos.w > 0 ? cardPos.x : cx;
      const deckCY = cardPos.h > 0 ? cardPos.y : (h * 0.67);
      const lift = deckLiftRef.current;
      const yaw = deckYawRef.current;
      const tiltAmount = deckTiltRef.current;

      // Calculate card position with very subtle lift so card stays centered with flanking cards
      const cardCenterY = deckCY - lift * Math.min(18, h * 0.025);

      // Yaw: simulate perspective by scaling width
      const yawRad = yaw * Math.PI / 180;
      const perspW = cardW * Math.abs(Math.cos(yawRad));
      const isEdgeOn = perspW < cardW * 0.15;
      const isFrontFacing = (Math.cos(yawRad) > 0 && !showFrontRef.current) || (Math.cos(yawRad) < 0 && showFrontRef.current);

      // Tilt rotation effect
      const tiltSkew = tiltAmount * 0.15;

      // Border glow
      const borderAlpha = borderGlowRef.current;

      // Draw deck
      if (state === "REVEALING" || state === "SETTLED" || state === "RESETTING") {
        const drawW = Math.max(4, perspW);
        const drawH = cardH;
        const x = deckCX - drawW / 2;
        const y = cardCenterY - drawH / 2;

        ctx!.save();
        ctx!.translate(deckCX, cardCenterY);
        ctx!.transform(1, tiltSkew, 0, 1, 0, 0);
        ctx!.translate(-deckCX, -cardCenterY);

        // Card shadow (faked with semi-transparent rounded rects for performance)
        ctx!.fillStyle = rgba(0, 0, 0, 0.15);
        ctx!.beginPath();
        ctx!.roundRect(x - 8, y + 5, drawW + 16, drawH + 16, 16);
        ctx!.fill();
        ctx!.beginPath();
        ctx!.roundRect(x - 4, y + 8, drawW + 8, drawH + 10, 12);
        ctx!.fill();

        ctx!.fillStyle = "rgba(11,11,11,0.9)";
        ctx!.beginPath();
        ctx!.roundRect(x, y, drawW, drawH, 8);
        ctx!.fill();

        if (isEdgeOn) {
          // Edge-on: thin slab
          ctx!.fillStyle = rgba(107, 80, 48, 0.9);
          ctx!.fillRect(deckCX - 2, y, 4, drawH);
          ctx!.strokeStyle = rgba(GOLD_R, GOLD_G, GOLD_B, 0.6);
          ctx!.lineWidth = 1;
          ctx!.strokeRect(deckCX - 2, y, 4, drawH);
        } else if (isFrontFacing) {
          // Back face: dark with gold pattern
          ctx!.fillStyle = "rgba(16,20,27,0.95)";
          ctx!.beginPath();
          ctx!.roundRect(x, y, drawW, drawH, 8);
          ctx!.fill();

          // Gold border
          ctx!.strokeStyle = rgba(GOLD_R, GOLD_G, GOLD_B, 0.5 + borderAlpha * 0.5);
          ctx!.lineWidth = 2;
          ctx!.beginPath();
          ctx!.roundRect(x + 3, y + 3, drawW - 6, drawH - 6, 6);
          ctx!.stroke();

          // Inner border
          ctx!.strokeStyle = rgba(GOLD_R, GOLD_G, GOLD_B, 0.25);
          ctx!.lineWidth = 1;
          ctx!.beginPath();
          ctx!.roundRect(x + 8, y + 8, drawW - 16, drawH - 16, 4);
          ctx!.stroke();

          // Spirograph/rosette pattern on back (deterministic — no flickering)
          const rosetteCX = deckCX;
          const rosetteCY = cardCenterY;
          const roseR = Math.min(drawW, drawH) * 0.25;
          ctx!.strokeStyle = rgba(GOLD_R, GOLD_G, GOLD_B, 0.18);
          ctx!.lineWidth = 0.7;
          const pts = 24;
          ctx!.beginPath();
          for (let i = 0; i < pts; i++) {
            for (let j = i + 3; j < pts; j += 2) {
              const a1 = (i / pts) * Math.PI * 2;
              const a2 = (j / pts) * Math.PI * 2;
              ctx!.moveTo(rosetteCX + Math.cos(a1) * roseR, rosetteCY + Math.sin(a1) * roseR);
              ctx!.lineTo(rosetteCX + Math.cos(a2) * roseR, rosetteCY + Math.sin(a2) * roseR);
            }
          }
          ctx!.stroke();

          // Faceted polygon web
          ctx!.strokeStyle = rgba(GOLD_R, GOLD_G, GOLD_B, 0.12);
          for (let i = 0; i < 6; i++) {
            const a = (i / 6) * Math.PI * 2;
            ctx!.beginPath();
            ctx!.moveTo(rosetteCX, rosetteCY);
            ctx!.lineTo(rosetteCX + Math.cos(a) * roseR * 1.8, rosetteCY + Math.sin(a) * roseR * 1.8);
            ctx!.stroke();
          }
        } else {
          // Front face: GOLDEN card with twist text
          const grad = ctx!.createLinearGradient(x, y, x, y + drawH);
          grad.addColorStop(0, rgba(BRIGHT_R, BRIGHT_G, BRIGHT_B, 1));
          grad.addColorStop(1, rgba(GOLD_R, GOLD_G, GOLD_B, 1));
          ctx!.fillStyle = grad;
          ctx!.beginPath();
          ctx!.roundRect(x, y, drawW, drawH, 8);
          ctx!.fill();

          // Border glow (simulated, no shadowBlur)
          ctx!.strokeStyle = rgba(255, 255, 255, 0.4 + borderAlpha * 0.6);
          ctx!.lineWidth = 2.5;
          ctx!.beginPath();
          ctx!.roundRect(x + 2, y + 2, drawW - 4, drawH - 4, 7);
          ctx!.stroke();
          
          if (borderAlpha > 0.05) {
            ctx!.strokeStyle = rgba(WHITE_GOLD_R, WHITE_GOLD_G, WHITE_GOLD_B, borderAlpha * 0.2);
            ctx!.lineWidth = 6;
            ctx!.beginPath();
            ctx!.roundRect(x + 2, y + 2, drawW - 4, drawH - 4, 7);
            ctx!.stroke();
            ctx!.lineWidth = 12;
            ctx!.beginPath();
            ctx!.roundRect(x + 2, y + 2, drawW - 4, drawH - 4, 7);
            ctx!.stroke();
          }

          // Inner border
          ctx!.strokeStyle = rgba(0, 0, 0, 0.15);
          ctx!.lineWidth = 1;
          ctx!.beginPath();
          ctx!.roundRect(x + 8, y + 8, drawW - 16, drawH - 16, 4);
          ctx!.stroke();

          // Text
          if (drawW > 30) {
            const fontSize = Math.max(12, drawW * 0.08);
            ctx!.font = `600 ${fontSize}px sans-serif`;
            ctx!.fillStyle = "rgba(11, 11, 11, 0.95)"; // Dark text on gold card
            ctx!.textAlign = "center";
            ctx!.textBaseline = "middle";
            // Helper function to split text into lines manually or split by length
            const textToDraw = props.text || "Example twist:\nyour app must now\nwork fully offline.";
            const rawLines = textToDraw.split("—"); // The twist texts have a long dash or we can just split manually
            // Actually, best to split into 3 lines max
            const words = textToDraw.split(" ");
            const lines: string[] = [];
            let currentLine = "";
            for (const word of words) {
              if (currentLine.length + word.length > 20) {
                lines.push(currentLine);
                currentLine = word + " ";
              } else {
                currentLine += word + " ";
              }
            }
            if (currentLine) lines.push(currentLine.trim());

            const lineH = fontSize * 1.4;
            const startY = cardCenterY - (lines.length - 1) * lineH / 2;
            for (let l = 0; l < lines.length; l++) {
              ctx!.fillText(lines[l], deckCX, startY + l * lineH);
            }
          }
        }

        // Border glow effect
        if (borderAlpha > 0.01) {
          ctx!.save();
          ctx!.globalCompositeOperation = "lighter";
          const glowGrad = ctx!.createRadialGradient(deckCX, cardCenterY, 0, deckCX, cardCenterY, Math.max(drawW, drawH) * 0.8);
          glowGrad.addColorStop(0, rgba(GOLD_R, GOLD_G, GOLD_B, borderAlpha * 0.1));
          glowGrad.addColorStop(1, rgba(GOLD_R, GOLD_G, GOLD_B, 0));
          ctx!.fillStyle = glowGrad;
          ctx!.beginPath();
          ctx!.arc(deckCX, cardCenterY, Math.max(drawW, drawH) * 0.8, 0, Math.PI * 2);
          ctx!.fill();
          ctx!.restore();
        }

        ctx!.restore();
      } else {
        // IDLE / ENTRANCE: the DOM card handles display.
        // Canvas only draws the card during REVEALING and SETTLED states.
      }

      // ── Lock symbol (during reveal) ──
      if (lockAlphaRef.current > 0.01) {
        const la = lockAlphaRef.current;
        ctx!.save();
        ctx!.translate(deckCX, deckCY - cardH * 0.05);
        const lockS = 2;
        ctx!.scale(lockS, lockS);
        ctx!.translate(-12, -14);
        ctx!.lineCap = "round";
        ctx!.lineJoin = "round";
        const lockPath = new Path2D("M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z");
        
        // Fake glow
        ctx!.strokeStyle = rgba(GOLD_R, GOLD_G, GOLD_B, la * 0.4);
        ctx!.lineWidth = 4.5;
        ctx!.stroke(lockPath);
        
        // Core
        ctx!.strokeStyle = rgba(WHITE_GOLD_R, WHITE_GOLD_G, WHITE_GOLD_B, la);
        ctx!.lineWidth = 1.5;
        ctx!.stroke(lockPath);
        ctx!.restore();
      }

      // ── Ignite pad ──
      if (bloomIntensityRef.current > 0.01) {
        const bi = bloomIntensityRef.current;
        ctx!.save();
        ctx!.globalCompositeOperation = "lighter";
        const padW = cardW * 1.3;
        const padH = padW * 0.3;
        const padGrad = ctx!.createRadialGradient(deckCX, deckCY, 0, deckCX, deckCY, padW);
        padGrad.addColorStop(0, rgba(255, 184, 77, bi * 0.3));
        padGrad.addColorStop(0.4, rgba(GOLD_R, GOLD_G, GOLD_B, bi * 0.15));
        padGrad.addColorStop(1, rgba(GOLD_R, GOLD_G, GOLD_B, 0));
        ctx!.fillStyle = padGrad;
        ctx!.beginPath();
        ctx!.ellipse(deckCX, deckCY + cardH * 0.3, padW, padH, 0, 0, Math.PI * 2);
        ctx!.fill();
        ctx!.restore();
      }

      // ── Scan comet ──
      if (scanCometRef.current.active) {
        const sc = scanCometRef.current;
        const scx = deckCX - cardW * 0.3 + sc.progress * cardW * 0.8;
        const scy = cardCenterY - cardH * 0.3 + sc.progress * cardH * 0.6;
        const tailLen = 40;

        ctx!.save();
        ctx!.globalCompositeOperation = "lighter";
        const scGrad = ctx!.createRadialGradient(scx, scy, 0, scx, scy, 8);
        scGrad.addColorStop(0, rgba(255, 255, 255, 0.9));
        scGrad.addColorStop(1, rgba(BRIGHT_R, BRIGHT_G, BRIGHT_B, 0));
        ctx!.fillStyle = scGrad;
        ctx!.beginPath();
        ctx!.arc(scx, scy, 8, 0, Math.PI * 2);
        ctx!.fill();

        ctx!.beginPath();
        ctx!.moveTo(scx, scy);
        ctx!.lineTo(scx - tailLen * 0.7, scy - tailLen * 0.5);
        ctx!.strokeStyle = rgba(WHITE_GOLD_R, WHITE_GOLD_G, WHITE_GOLD_B, 0.5);
        ctx!.lineWidth = 2;
        ctx!.stroke();
        ctx!.restore();
      }

      // ── Light thread ──
      if (threadRef.current) {
        const thr = threadRef.current;
        if (thr.alpha > 0.01) {
          ctx!.save();
          ctx!.globalCompositeOperation = "lighter";

          // Draw the Bézier path up to progress
          const headT = Math.min(thr.progress, 1);
          ctx!.beginPath();
          for (let s = 0; s <= 30; s++) {
            const t = headT * (s / 30);
            const mt = 1 - t;
            const px = mt * mt * thr.startX + 2 * mt * t * thr.controlX + t * t * thr.endX;
            const py = mt * mt * thr.startY + 2 * mt * t * thr.controlY + t * t * thr.endY;
            if (s === 0) ctx!.moveTo(px, py);
            else ctx!.lineTo(px, py);
          }
          // Fake glow
          ctx!.strokeStyle = rgba(GOLD_R, GOLD_G, GOLD_B, thr.alpha * 0.35);
          ctx!.lineWidth = 7;
          ctx!.stroke();
          
          // Core
          ctx!.strokeStyle = rgba(WHITE_GOLD_R, WHITE_GOLD_G, WHITE_GOLD_B, thr.alpha * 0.7);
          ctx!.lineWidth = 2;
          ctx!.stroke();

          // Head glow
          const mt = 1 - headT;
          const headX = mt * mt * thr.startX + 2 * mt * headT * thr.controlX + headT * headT * thr.endX;
          const headY = mt * mt * thr.startY + 2 * mt * headT * thr.controlY + headT * headT * thr.endY;
          const headGrad = ctx!.createRadialGradient(headX, headY, 0, headX, headY, 10);
          headGrad.addColorStop(0, rgba(255, 255, 255, thr.alpha));
          headGrad.addColorStop(1, rgba(BRIGHT_R, BRIGHT_G, BRIGHT_B, 0));
          ctx!.fillStyle = headGrad;
          ctx!.beginPath();
          ctx!.arc(headX, headY, 10, 0, Math.PI * 2);
          ctx!.fill();

          // Trail particles
          for (const p of thr.particles) {
            if (p.t > headT) continue;
            const pt = p.t;
            const pmt = 1 - pt;
            const px = pmt * pmt * thr.startX + 2 * pmt * pt * thr.controlX + pt * pt * thr.endX;
            const py = pmt * pmt * thr.startY + 2 * pmt * pt * thr.controlY + pt * pt * thr.endY;
            ctx!.fillStyle = rgba(GOLD_R, GOLD_G, GOLD_B, p.alpha * thr.alpha * 0.5);
            ctx!.beginPath();
            ctx!.arc(px + (Math.random() - 0.5) * 6, py + (Math.random() - 0.5) * 6, p.size, 0, Math.PI * 2);
            ctx!.fill();
          }

          ctx!.restore();
        }
      }

      // ── Node flare ──
      if (nodeFlareRef.current > 0.01) {
        // Draw flare at the center rail node position
        const nf = nodeFlareRef.current;
        const targetNodeX = nodePosRef.current.x || deckCX;
        const targetNodeY = nodePosRef.current.y || (timelineBottom - 18);
        const flareGrad = ctx!.createRadialGradient(targetNodeX, targetNodeY, 0, targetNodeX, targetNodeY, 30);
        flareGrad.addColorStop(0, rgba(WHITE_GOLD_R, WHITE_GOLD_G, WHITE_GOLD_B, nf * 0.8));
        flareGrad.addColorStop(0.3, rgba(BRIGHT_R, BRIGHT_G, BRIGHT_B, nf * 0.4));
        flareGrad.addColorStop(1, rgba(GOLD_R, GOLD_G, GOLD_B, 0));
        ctx!.save();
        ctx!.globalCompositeOperation = "lighter";
        ctx!.fillStyle = flareGrad;
        ctx!.beginPath();
        ctx!.arc(targetNodeX, targetNodeY, 30, 0, Math.PI * 2);
        ctx!.fill();
        ctx!.restore();
      }

      // Callout removed (we use the DOM timeline text instead)
    }

    /* ═════════════════════════════════════════════════════════════════
       CHOREOGRAPHY UPDATE
       ═════════════════════════════════════════════════════════════════ */
    function updateChoreography(dt: number) {
      const state = stateRef.current;
      const { w, h } = sizeRef.current;
      const cardPos = cardPosRef.current;
      const cx = cardPos.w > 0 ? cardPos.x : w / 2;
      const timelineBottom = timelineBottomRef.current || (h * 0.45);
      const deckCX = cardPos.w > 0 ? cardPos.x : cx;
      const deckCY = cardPos.h > 0 ? cardPos.y : (h * 0.67);
      const cardH = cardPos.h > 0 ? cardPos.h : (h * CARD_HEIGHT_FRAC);
      const cardCenterY = deckCY - deckLiftRef.current * Math.min(18, h * 0.025);

      if (state === "ENTRANCE") {
        entranceTimeRef.current += dt;
        if (entranceTimeRef.current >= ENTRANCE_DUR) {
          stateRef.current = "IDLE";
          entranceDoneRef.current = true;
        }
      }

      if (state === "REVEALING") {
        const t = revealTimeRef.current;
        revealTimeRef.current += dt;
        const nt = revealTimeRef.current;

        // t=0.0: Ignite pad + ribbons
        if (t < 0.01 && nt >= 0.01) {
          bloomIntensityRef.current = 1;
          spawnRevealRibbons(2);
        }

        // t=0.5: Shockwave + callout
        if (t < 0.5 && nt >= 0.5) {
          spawnShockwave(deckCX, deckCY);
          calloutAlphaRef.current = 0.01; // starts fading in
        }

        // Callout fade in
        if (nt >= 0.5 && calloutAlphaRef.current < 1) {
          calloutAlphaRef.current = Math.min(1, calloutAlphaRef.current + dt * 2);
        }

        // Lock symbol: visible during 0.5→4.5
        if (nt >= 0.3 && nt < 4.5) {
          lockAlphaRef.current = Math.min(1, lockAlphaRef.current + dt * 3);
        } else if (nt >= 4.5) {
          lockAlphaRef.current *= 0.95;
        }

        // Bloom decay
        bloomIntensityRef.current *= 0.97;

        // t=1.5→3.0: Deck lifts slightly
        if (nt >= 1.5 && nt <= 3.0) {
          const liftT = easeInOutPower3(Math.min(1, (nt - 1.5) / 1.0));
          deckLiftRef.current = liftT;
          deckTiltRef.current = liftT * 0.6;
        }

        // Yaw keyframes
        const yawKeys: Array<[number, number, (t: number) => number]> = [
          [1.5, 0, easeInOutPower3],
          [2.0, 90, easeInOutPower3],
          [2.5, 150, easeOutPower2],
          [3.0, 180, easeOutPower3],
          [4.5, 180, easeOutSine],
          [5.0, 270, easeInOutPower3],
          [5.5, 360, easeOutPower3],
        ];

        for (let i = 0; i < yawKeys.length - 1; i++) {
          const [t0, yaw0] = yawKeys[i];
          const [t1, yaw1, ease] = yawKeys[i + 1];
          if (nt >= t0 && nt < t1) {
            const keyT = ease(Math.min(1, (nt - t0) / (t1 - t0)));
            deckYawRef.current = yaw0 + (yaw1 - yaw0) * keyT;
            break;
          }
          if (i === yawKeys.length - 2 && nt >= t1) {
            deckYawRef.current = yaw1;
          }
        }

        // Show front face at yaw ~180
        if (nt >= 2.8) showFrontRef.current = true;

        // t=2.0: Flip-pop fan sparks
        if (t < 2.0 && nt >= 2.0) {
          spawnFanSparks(deckCX, cardCenterY, 35);
        }

        // t=2.5: Radial explosion
        if (t < 2.5 && nt >= 2.5) {
          spawnRadialSparks(deckCX, cardCenterY, 80);
          bloomIntensityRef.current = 0.6;
        }

        // t=3.0: Border ignite + scan comet
        if (t < 3.0 && nt >= 3.0) {
          borderGlowRef.current = 0.01;
          scanCometRef.current = { active: true, progress: 0 };
        }
        if (nt >= 3.0 && borderGlowRef.current < 1) {
          borderGlowRef.current = Math.min(1, borderGlowRef.current + dt * 3);
        }
        if (scanCometRef.current.active) {
          scanCometRef.current.progress += dt * 2;
          if (scanCometRef.current.progress >= 1) {
            scanCometRef.current.active = false;
          }
        }

        // Ring scale: 1.0 → 1.23 between t=0 and t=2.5
        if (nt <= 2.5) {
          ringScaleRef.current = 1.0 + 0.23 * easeOutPower2(Math.min(1, nt / 2.5));
        }

        // t=3.5: Light thread
        if (t < 3.5 && nt >= 3.5) {
          const cardTopY = cardCenterY - cardH * 0.5;
          const targetNodeX = nodePosRef.current.x || deckCX;
          const targetNodeY = nodePosRef.current.y || (timelineBottom - 18);
          spawnLightThread(deckCX, cardTopY, targetNodeX, targetNodeY);
        }
        if (threadRef.current && nt >= 3.5) {
          threadRef.current.progress = Math.min(1, (nt - 3.5) / 0.5);
          if (nt > 4.5) {
            threadRef.current.alpha *= 0.95;
          }
        }

        // t=4.0: Node flare
        if (t < 4.0 && nt >= 4.0) {
          nodeFlareRef.current = 1;
          const targetNodeX = nodePosRef.current.x || deckCX;
          const targetNodeY = nodePosRef.current.y || (timelineBottom - 18);
          spawnNodeSparks(targetNodeX, targetNodeY, 35);
        }
        if (nt >= 4.0) {
          nodeFlareRef.current *= 0.985;
        }

        // t=4.5: Border glow eases to 50%
        if (nt >= 4.5) {
          borderGlowRef.current += (0.5 - borderGlowRef.current) * dt * 2;
        }

        // t=5.0: Tilt eases out for flip
        if (nt >= 4.5) {
          deckTiltRef.current *= 0.95;
        }

        // t=5.5: Done
        if (nt >= REVEAL_DUR) {
          stateRef.current = "SETTLED";
          deckYawRef.current = 360;
          showFrontRef.current = true;
        }

        // Halo ribbons at lift (t=1.5)
        if (t < 1.5 && nt >= 1.5) {
          spawnRevealRibbons(3);
        }
      }

      if (state === "RESETTING") {
        // INFERRED: not shown in reference clip
        resetTimeRef.current += dt;
        const rt = resetTimeRef.current / RESET_DUR;
        const ease = easeInOutPower3(Math.min(1, rt));

        deckYawRef.current = 360 * (1 - ease);
        deckLiftRef.current = 1 - ease;
        deckTiltRef.current = 0;
        borderGlowRef.current *= 0.95;
        calloutAlphaRef.current *= 0.95;
        ringScaleRef.current = 1.23 - 0.23 * ease;
        showFrontRef.current = false;
        lockAlphaRef.current = 0;

        if (rt >= 1) {
          stateRef.current = "IDLE";
          deckYawRef.current = 0;
          deckLiftRef.current = 0;
          ringScaleRef.current = 1.0;
          borderGlowRef.current = 0;
          calloutAlphaRef.current = 0;
          nodeFlareRef.current = 0;
          threadRef.current = null;
          sparksRef.current = [];
          shockwavesRef.current = [];

          if (pendingRevealRef.current) {
            pendingRevealRef.current = false;
            startReveal();
          } else {
            // Notify parent to restore DOM card ONLY if not immediately revealing again
            props.onReset?.();
          }
        }
      }
    }

    /* ─── Animation Loop ───────────────────────────────────────────── */
    function step(now: number) {
      if (!lastTimeRef.current) lastTimeRef.current = now;
      const dt = Math.min(0.05, (now - lastTimeRef.current) / 1000);
      lastTimeRef.current = now;

      if (!inViewRef.current) {
        rafRef.current = requestAnimationFrame(step);
        return;
      }

      updateChoreography(dt);
      render(dt);
      rafRef.current = requestAnimationFrame(step);
    }

    rafRef.current = requestAnimationFrame(step);

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener("resize", resize);
      window.removeEventListener("mousemove", onMouseMove);
      io.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startReveal]);

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

TwistDeckCanvas.displayName = "TwistDeckCanvas";
export default TwistDeckCanvas;
