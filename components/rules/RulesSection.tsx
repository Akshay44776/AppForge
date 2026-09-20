"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { RULES_META, CATEGORY_COLORS, type RuleMeta } from "./rulesMeta";

/* ═══════════════════════════════════════════════════════════════════════════
   RulesSection — "The Twelve Gates"

   A premium interactive rules experience with:
   - Wall view: 4×3 grid of obsidian rule cards with 3D tilt on hover
   - Focused view: single card expanded with full text
   - Canvas ember particles + drifting slab field background
   - Smooth transitions between states
   - Rail navigation + keyboard controls
   - Full a11y with DOM <ol> for screen readers
   - Reduced motion fallback
   ═══════════════════════════════════════════════════════════════════════════ */

const GOLD = "#d9a94a";
const GOLD_BRIGHT = "#f4c862";
const EMBER_RED = "#FF5B3A";
const INK = "#07090d";
const SURFACE = "#0C1017";
const PAPER = "#ece8de";

/* ─── Ember Particle Canvas ──────────────────────────────────────────────── */
function EmberCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef(0);
  const visibleRef = useRef(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const isMobile = window.innerWidth < 768;
    const particleCount = isMobile ? 40 : 90;

    interface Ember {
      x: number; y: number;
      vx: number; vy: number;
      size: number;
      alpha: number;
      life: number;
      maxLife: number;
      isRed: boolean;
    }

    let embers: Ember[] = [];
    let w = 0, h = 0;
    let mouseX = -9999, mouseY = -9999;

    function resize() {
      const rect = canvas!.parentElement?.getBoundingClientRect();
      if (!rect) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      w = rect.width;
      h = rect.height;
      canvas!.width = Math.round(w * dpr);
      canvas!.height = Math.round(h * dpr);
      canvas!.style.width = `${w}px`;
      canvas!.style.height = `${h}px`;
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function spawnEmber(fromX?: number, fromY?: number) {
      const x = fromX ?? Math.random() * w;
      const y = fromY ?? h + 10;
      embers.push({
        x, y,
        vx: (Math.random() - 0.5) * 0.8,
        vy: -(0.15 + Math.random() * 0.55),
        size: 1 + Math.random() * 2.5,
        alpha: 0.3 + Math.random() * 0.5,
        life: 0,
        maxLife: 4 + Math.random() * 6,
        isRed: Math.random() < 0.15,
      });
    }

    // Seed
    for (let i = 0; i < particleCount; i++) {
      embers.push({
        x: Math.random() * (w || 1200),
        y: Math.random() * (h || 800),
        vx: (Math.random() - 0.5) * 0.5,
        vy: -(0.1 + Math.random() * 0.4),
        size: 1 + Math.random() * 2.5,
        alpha: 0.2 + Math.random() * 0.35,
        life: Math.random() * 4,
        maxLife: 4 + Math.random() * 6,
        isRed: Math.random() < 0.15,
      });
    }

    resize();

    function draw() {
      if (!visibleRef.current) {
        rafRef.current = requestAnimationFrame(draw);
        return;
      }

      ctx!.clearRect(0, 0, w, h);

      // Forge glow background
      const glow = ctx!.createRadialGradient(w * 0.5, h * 0.6, 0, w * 0.5, h * 0.6, Math.max(w, h) * 0.6);
      glow.addColorStop(0, "rgba(217,169,74,0.06)");
      glow.addColorStop(0.5, "rgba(217,169,74,0.02)");
      glow.addColorStop(1, "rgba(7,9,13,0)");
      ctx!.fillStyle = glow;
      ctx!.fillRect(0, 0, w, h);

      // Spawn
      if (embers.length < particleCount && Math.random() < 0.12) {
        spawnEmber();
      }

      const live: Ember[] = [];
      for (const e of embers) {
        e.life += 0.016;
        if (e.life > e.maxLife) continue;

        // Curl noise drift
        const noiseX = Math.sin(e.y * 0.008 + e.life * 0.5) * 0.12;
        e.x += e.vx + noiseX;
        e.y += e.vy;

        // Pointer vortex
        if (mouseX > -9000) {
          const dx = e.x - mouseX;
          const dy = e.y - mouseY;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 150 && dist > 5) {
            const angle = Math.atan2(dy, dx) + Math.PI / 2;
            const force = (1 - dist / 150) * 0.4;
            e.vx += Math.cos(angle) * force * 0.016;
            e.vy += Math.sin(angle) * force * 0.016;
          }
        }

        const t = e.life / e.maxLife;
        const fadeIn = Math.min(1, t * 5);
        const fadeOut = t > 0.6 ? 1 - (t - 0.6) / 0.4 : 1;
        const a = e.alpha * fadeIn * fadeOut;

        const r = e.isRed ? 255 : 217;
        const g = e.isRed ? 91 : 169;
        const b = e.isRed ? 58 : 74;

        // Outer glow
        ctx!.fillStyle = `rgba(${r},${g},${b},${a * 0.4})`;
        ctx!.beginPath();
        ctx!.arc(e.x, e.y, e.size * 3, 0, Math.PI * 2);
        ctx!.fill();

        // Core
        ctx!.fillStyle = `rgba(${Math.min(255, r + 40)},${Math.min(255, g + 60)},${Math.min(255, b + 80)},${a})`;
        ctx!.beginPath();
        ctx!.arc(e.x, e.y, e.size, 0, Math.PI * 2);
        ctx!.fill();

        live.push(e);
      }
      embers = live;

      rafRef.current = requestAnimationFrame(draw);
    }

    const io = new IntersectionObserver(
      ([entry]) => {
        visibleRef.current = entry.isIntersecting;
      },
      { threshold: 0.02 }
    );
    io.observe(canvas);

    const onMouse = (e: MouseEvent) => {
      const rect = canvas!.getBoundingClientRect();
      mouseX = e.clientX - rect.left;
      mouseY = e.clientY - rect.top;
    };
    const onLeave = () => { mouseX = -9999; mouseY = -9999; };

    window.addEventListener("mousemove", onMouse, { passive: true });
    window.addEventListener("resize", resize, { passive: true });
    canvas.parentElement?.addEventListener("mouseleave", onLeave);

    rafRef.current = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener("mousemove", onMouse);
      window.removeEventListener("resize", resize);
      canvas.parentElement?.removeEventListener("mouseleave", onLeave);
      io.disconnect();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none"
      style={{ zIndex: 0 }}
      aria-hidden="true"
    />
  );
}

/* ─── Slab Field Canvas (drifting outlined rectangles) ───────────────────── */
function SlabFieldCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef(0);
  const visibleRef = useRef(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const isMobile = window.innerWidth < 768;
    const slabCount = isMobile ? 12 : 28;

    interface Slab {
      x: number; y: number;
      w: number; h: number;
      rot: number;
      rotSpeed: number;
      vx: number; vy: number;
      opacity: number;
      depth: number; // parallax factor
      hasGlow: boolean;
      glowPhase: number;
    }

    let W = 0, H = 0;
    let mouseX = 0.5, mouseY = 0.5;

    const slabs: Slab[] = [];

    function resize() {
      const rect = canvas!.parentElement?.getBoundingClientRect();
      if (!rect) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      W = rect.width;
      H = rect.height;
      canvas!.width = Math.round(W * dpr);
      canvas!.height = Math.round(H * dpr);
      canvas!.style.width = `${W}px`;
      canvas!.style.height = `${H}px`;
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    // Build slabs
    for (let i = 0; i < slabCount; i++) {
      const scale = 0.5 + Math.random() * 1.2;
      slabs.push({
        x: Math.random() * 1400,
        y: Math.random() * 1000,
        w: (60 + Math.random() * 50) * scale,
        h: (16 + Math.random() * 12) * scale,
        rot: Math.random() * Math.PI * 2,
        rotSpeed: (Math.random() - 0.5) * 0.003,
        vx: (Math.random() - 0.5) * 0.15,
        vy: (Math.random() - 0.5) * 0.1,
        opacity: 0.04 + Math.random() * 0.08,
        depth: 0.3 + Math.random() * 0.7,
        hasGlow: Math.random() < 0.12,
        glowPhase: Math.random() * Math.PI * 2,
      });
    }

    resize();

    function draw() {
      if (!visibleRef.current) {
        rafRef.current = requestAnimationFrame(draw);
        return;
      }

      ctx!.clearRect(0, 0, W, H);

      for (const s of slabs) {
        s.x += s.vx;
        s.y += s.vy;
        s.rot += s.rotSpeed;

        // Wrap
        if (s.x < -100) s.x = W + 100;
        if (s.x > W + 100) s.x = -100;
        if (s.y < -80) s.y = H + 80;
        if (s.y > H + 80) s.y = -80;

        // Parallax from mouse
        const px = s.x + (mouseX - 0.5) * 30 * s.depth;
        const py = s.y + (mouseY - 0.5) * 20 * s.depth;

        ctx!.save();
        ctx!.translate(px, py);
        ctx!.rotate(s.rot);

        ctx!.beginPath();
        ctx!.roundRect(-s.w / 2, -s.h / 2, s.w, s.h, 3);
        ctx!.strokeStyle = `rgba(236,232,222,${s.opacity})`;
        ctx!.lineWidth = 0.8;
        ctx!.stroke();

        // Travelling edge light on special slabs
        if (s.hasGlow) {
          s.glowPhase += 0.015;
          const gx = Math.cos(s.glowPhase) * s.w * 0.4;
          const gy = Math.sin(s.glowPhase) * s.h * 0.3;
          const grad = ctx!.createRadialGradient(gx, gy, 0, gx, gy, s.w * 0.4);
          grad.addColorStop(0, `rgba(217,169,74,${s.opacity * 3})`);
          grad.addColorStop(1, "rgba(217,169,74,0)");
          ctx!.fillStyle = grad;
          ctx!.fill();
        }

        ctx!.restore();
      }

      rafRef.current = requestAnimationFrame(draw);
    }

    const io = new IntersectionObserver(
      ([entry]) => { visibleRef.current = entry.isIntersecting; },
      { threshold: 0.02 }
    );
    io.observe(canvas);

    const onMouse = (e: MouseEvent) => {
      mouseX = e.clientX / window.innerWidth;
      mouseY = e.clientY / window.innerHeight;
    };
    window.addEventListener("mousemove", onMouse, { passive: true });
    window.addEventListener("resize", resize, { passive: true });

    rafRef.current = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener("mousemove", onMouse);
      window.removeEventListener("resize", resize);
      io.disconnect();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none"
      style={{ zIndex: 0, opacity: 0.7 }}
      aria-hidden="true"
    />
  );
}

/* ─── Rule Card (interactive, 3D tilt) ───────────────────────────────────── */
function RuleCard({
  rule,
  index,
  isActive,
  isFocused,
  onFocus,
  onHover,
  onBlur,
}: {
  rule: RuleMeta;
  index: number;
  isActive: boolean;
  isFocused: boolean;
  onFocus: () => void;
  onHover: () => void;
  onBlur: () => void;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const [glowPos, setGlowPos] = useState({ x: 50, y: 50 });
  const [isHovered, setIsHovered] = useState(false);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    const el = cardRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    setTilt({ x: (y - 0.5) * -8, y: (x - 0.5) * 8 });
    setGlowPos({ x: x * 100, y: y * 100 });
  }, []);

  const handlePointerEnter = useCallback(() => { setIsHovered(true); onHover(); }, [onHover]);
  const handlePointerLeave = useCallback(() => {
    setIsHovered(false);
    setTilt({ x: 0, y: 0 });
    setGlowPos({ x: 50, y: 50 });
    onBlur();
  }, [onBlur]);

  const accentColor = rule.isHeat ? EMBER_RED : GOLD;
  const categoryColor = CATEGORY_COLORS[rule.category] || GOLD;

  return (
    <div
      ref={cardRef}
      className="rules-gate-card"
      role="button"
      tabIndex={0}
      aria-label={`Rule ${rule.number}: ${rule.shortTitle}`}
      onClick={onFocus}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onFocus(); } }}
      onPointerMove={handlePointerMove}
      onPointerEnter={handlePointerEnter}
      onPointerLeave={handlePointerLeave}
      style={{
        perspective: "700px",
        animationDelay: `${index * 60}ms`,
        "--accent": accentColor,
        "--cat-color": categoryColor,
      } as CSSProperties}
    >
      <div
        className="rules-gate-card-inner"
        style={{
          transform: isHovered
            ? `rotateX(${tilt.x}deg) rotateY(${tilt.y}deg) translateZ(12px)`
            : "rotateX(0) rotateY(0) translateZ(0)",
          transition: isHovered
            ? "transform 0.06s ease-out"
            : "transform 0.45s cubic-bezier(.2,.8,.2,1)",
          borderColor: isHovered
            ? `color-mix(in srgb, var(--accent) 40%, transparent)`
            : rule.isHeat
              ? "rgba(255,91,58,0.12)"
              : "rgba(236,232,222,0.08)",
          boxShadow: isHovered
            ? `0 8px 32px rgba(0,0,0,0.5), 0 0 20px color-mix(in srgb, var(--accent) 10%, transparent), inset 0 1px 0 rgba(255,255,255,0.06)`
            : "0 4px 16px rgba(0,0,0,0.4)",
        }}
      >
        {/* Cursor glow */}
        <div
          className="rules-card-glow"
          style={{
            opacity: isHovered ? 1 : 0,
            background: `radial-gradient(ellipse at ${glowPos.x}% ${glowPos.y}%, ${accentColor}22 0%, transparent 55%)`,
          }}
        />

        {/* Heat shimmer for disqualification rules */}
        {rule.isHeat && (
          <div className="rules-heat-shimmer" aria-hidden="true" />
        )}

        {/* Content */}
        <div className="rules-card-top-row">
          <span className="rules-card-number" style={{ color: accentColor }}>
            {rule.number}
          </span>
          <span className="rules-card-category" style={{ color: categoryColor, borderColor: `${categoryColor}33` }}>
            {rule.category}
          </span>
        </div>

        <h3 className="rules-card-title">{rule.shortTitle}</h3>

        {/* Show full text only in focused mode */}
        {isFocused && (
          <p className="rules-card-text">{rule.text}</p>
        )}
        {!isFocused && (
          <p className="rules-card-text-preview">
            {rule.text.length > 80 ? rule.text.slice(0, 78) + "…" : rule.text}
          </p>
        )}
      </div>
    </div>
  );
}

/* ─── Focused Card View ──────────────────────────────────────────────────── */
function FocusedCard({
  rule,
  onClose,
  onPrev,
  onNext,
  current,
  total,
}: {
  rule: RuleMeta;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
  current: number;
  total: number;
}) {
  const accentColor = rule.isHeat ? EMBER_RED : GOLD;
  const categoryColor = CATEGORY_COLORS[rule.category] || GOLD;

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft" || e.key === "ArrowUp" || e.key === "k") onPrev();
      if (e.key === "ArrowRight" || e.key === "ArrowDown" || e.key === "j") onNext();
      if (e.key === "Home") { e.preventDefault(); /* handled by parent */ }
      if (e.key === "End") { e.preventDefault(); }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose, onPrev, onNext]);

  return (
    <div className="rules-focused-overlay" onClick={onClose}>
      <div className="rules-focused-card" onClick={(e) => e.stopPropagation()}>
        {/* Close button */}
        <button className="rules-focused-close" onClick={onClose} aria-label="Close">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>

        {/* Heat shimmer */}
        {rule.isHeat && <div className="rules-focused-heat" aria-hidden="true" />}

        {/* Number */}
        <div className="rules-focused-number" style={{ color: accentColor }}>
          {rule.number}
        </div>

        {/* Category */}
        <span className="rules-focused-category" style={{ color: categoryColor, borderColor: `${categoryColor}44` }}>
          {rule.category}
        </span>

        {/* Title */}
        <h3 className="rules-focused-title">{rule.shortTitle}</h3>

        {/* Divider */}
        <div className="rules-focused-divider" style={{ background: `linear-gradient(90deg, transparent, ${accentColor}44, transparent)` }} />

        {/* Text */}
        <p className="rules-focused-text">{rule.text}</p>

        {/* Navigation */}
        <div className="rules-focused-nav">
          <button
            className="rules-focused-nav-btn"
            onClick={onPrev}
            disabled={current <= 0}
            aria-label="Previous rule"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
          <span className="rules-focused-counter" style={{ color: GOLD }}>
            {String(current + 1).padStart(2, "0")} / {String(total).padStart(2, "0")}
          </span>
          <button
            className="rules-focused-nav-btn"
            onClick={onNext}
            disabled={current >= total - 1}
            aria-label="Next rule"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M9 18l6-6-6-6" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Rail Navigation ────────────────────────────────────────────────────── */
function RailNav({
  active,
  hovered,
  onSelect,
}: {
  active: number;
  hovered: number;
  onSelect: (i: number) => void;
}) {
  return (
    <nav className="rules-rail" aria-label="Rule navigation">
      {RULES_META.map((rule, i) => (
        <button
          key={i}
          className={`rules-rail-tick ${active === i ? "rules-rail-active" : ""} ${hovered === i ? "rules-rail-hovered" : ""}`}
          onClick={() => onSelect(i)}
          aria-label={`Rule ${rule.number}: ${rule.shortTitle}`}
          title={`${rule.number} · ${rule.shortTitle}`}
        >
          <span className="rules-rail-dot" style={{
            background: active === i ? (rule.isHeat ? EMBER_RED : GOLD) : "rgba(236,232,222,0.25)",
          }} />
          {(active === i || hovered === i) && (
            <span className="rules-rail-label">{rule.shortTitle}</span>
          )}
        </button>
      ))}
    </nav>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   Main Section Component
   ═══════════════════════════════════════════════════════════════════════════ */
export default function RulesSection() {
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const [hoveredIndex, setHoveredIndex] = useState(-1);
  const [showList, setShowList] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [reduced, setReduced] = useState(false);
  const sectionRef = useRef<HTMLElement>(null);
  const liveRef = useRef<HTMLParagraphElement>(null);

  // Visibility detection
  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setIsVisible(true); },
      { threshold: 0.1 }
    );
    io.observe(el);

    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener("change", onChange);

    return () => { io.disconnect(); mq.removeEventListener("change", onChange); };
  }, []);

  // Announce focused rule for a11y
  useEffect(() => {
    if (focusedIndex >= 0 && liveRef.current) {
      const r = RULES_META[focusedIndex];
      liveRef.current.textContent = `Rule ${r.number} of 12: ${r.shortTitle}`;
    }
  }, [focusedIndex]);

  // Keyboard: O for overview, Esc to close
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "o" || e.key === "O") {
        if (focusedIndex >= 0) setFocusedIndex(-1);
      }
      if (e.key === "Escape" && focusedIndex >= 0) {
        setFocusedIndex(-1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [focusedIndex]);

  const handleFocus = useCallback((i: number) => setFocusedIndex(i), []);
  const handlePrev = useCallback(() => setFocusedIndex((prev) => Math.max(0, prev - 1)), []);
  const handleNext = useCallback(() => setFocusedIndex((prev) => Math.min(11, prev + 1)), []);
  const handleClose = useCallback(() => setFocusedIndex(-1), []);

  return (
    <section
      id="rules"
      ref={sectionRef}
      className="relative overflow-hidden"
      style={{ background: INK, minHeight: "100vh" }}
    >
      {/* ── Background layers ── */}
      {!reduced && (
        <>
          <SlabFieldCanvas />
          <EmberCanvas />
        </>
      )}

      {/* Vignette */}
      <div className="rules-vignette" aria-hidden="true" />

      {/* ── Content ── */}
      <div className="wrap relative" style={{ zIndex: 10, paddingTop: "clamp(4rem, 10vw, 8rem)", paddingBottom: "clamp(4rem, 10vw, 6rem)" }}>
        {/* Header */}
        <div className={`rules-header ${isVisible ? "rules-header-visible" : ""}`}>
          <p className="kicker mb-3" style={{ letterSpacing: "0.15em" }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: "8px" }}>
              Rulebook
              <span style={{
                display: "inline-block",
                width: "32px",
                height: "1px",
                background: GOLD,
                opacity: 0.5,
              }} />
            </span>
          </p>
          <div className="rules-title-row">
            <h2 className="font-display text-3xl sm:text-5xl leading-tight" style={{ color: PAPER }}>
              The Twelve Gates
            </h2>
            <div className="rules-mode-toggles">
              <button
                className={`rules-toggle-btn ${!showList ? "rules-toggle-active" : ""}`}
                onClick={() => setShowList(false)}
                aria-label="Grid view"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="3" width="7" height="7" rx="1" />
                  <rect x="14" y="3" width="7" height="7" rx="1" />
                  <rect x="3" y="14" width="7" height="7" rx="1" />
                  <rect x="14" y="14" width="7" height="7" rx="1" />
                </svg>
              </button>
              <button
                className={`rules-toggle-btn ${showList ? "rules-toggle-active" : ""}`}
                onClick={() => setShowList(true)}
                aria-label="List view"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* a11y live region */}
        <p ref={liveRef} className="sr-only" aria-live="polite" />

        {/* ── List Mode (the original view, styled) ── */}
        {showList && (
          <ol className="rules-list-mode">
            {RULES_META.map((r, i) => (
              <li
                key={i}
                className={`rules-list-item ${r.isHeat ? "rules-list-heat" : ""}`}
              >
                <span className="rules-list-number" style={{ color: r.isHeat ? EMBER_RED : GOLD }}>
                  {r.number}
                </span>
                <div>
                  <span className="rules-list-title">{r.shortTitle}</span>
                  <span className="rules-list-text">{r.text}</span>
                </div>
              </li>
            ))}
          </ol>
        )}

        {/* ── Grid / Wall Mode ── */}
        {!showList && (
          <>
            <div className={`rules-wall ${isVisible ? "rules-wall-visible" : ""}`}>
              {RULES_META.map((rule, i) => (
                <RuleCard
                  key={i}
                  rule={rule}
                  index={i}
                  isActive={focusedIndex === i}
                  isFocused={false}
                  onFocus={() => handleFocus(i)}
                  onHover={() => setHoveredIndex(i)}
                  onBlur={() => setHoveredIndex(-1)}
                />
              ))}
            </div>

            {/* Rail */}
            <RailNav
              active={focusedIndex}
              hovered={hoveredIndex}
              onSelect={handleFocus}
            />
          </>
        )}

        {/* ── Focused Overlay ── */}
        {focusedIndex >= 0 && !showList && (
          <FocusedCard
            rule={RULES_META[focusedIndex]}
            onClose={handleClose}
            onPrev={handlePrev}
            onNext={handleNext}
            current={focusedIndex}
            total={12}
          />
        )}
      </div>

      {/* ── SEO / a11y DOM (always present, visually hidden in grid mode) ── */}
      <ol className="sr-only" aria-label="AppForge Rulebook">
        {RULES_META.map((r, i) => (
          <li key={i}>{r.text}</li>
        ))}
      </ol>
    </section>
  );
}
