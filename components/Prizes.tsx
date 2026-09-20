"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/* ═══════════════════════════════════════════════════════════════════════════
   Prizes — Cinematic prize section with hero backdrop & interactive cards
   Design is unchanged. Adds: pointer/scroll-driven 3D parallax on the hero
   plate, a flowing light shaft + floor current, depth-layered glass cards.
   ═══════════════════════════════════════════════════════════════════════════ */

const STATS = [
  {
    value: "₹45,000",
    label: "Prize pool",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H18M6 9v12m0-12h7.5M18 4l-2 5m2-5h-1.5a2.5 2.5 0 0 0 0 5H18m-4.5 0L12 21m1.5-12H18m0 0v2" />
        <path d="M6 21h12" />
      </svg>
    ),
  },
  {
    value: "1 day",
    label: "Format",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2" />
        <path d="M16 2v4M8 2v4M3 10h18" />
        <path d="M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01" />
      </svg>
    ),
  },
  {
    value: "2–4",
    label: "Team size",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
  },
  {
    value: "₹400",
    label: "Entry fee per team",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <path d="M8 8h8M8 12h8M10 16l4-8" />
      </svg>
    ),
  },
] as const;

const prefersReducedMotion = () =>
  typeof window !== "undefined" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ─── Stat Card with 3D tilt ──────────────────────────────────────────────── */
function StatCard({ stat, index }: { stat: (typeof STATS)[number]; index: number }) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const [isHovered, setIsHovered] = useState(false);
  const [isPressed, setIsPressed] = useState(false);
  const [glowPos, setGlowPos] = useState({ x: 50, y: 50 });

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    const card = cardRef.current;
    if (!card) return;
    const rect = card.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    setTilt({
      x: (y - 0.5) * -18,
      y: (x - 0.5) * 18,
    });
    setGlowPos({ x: x * 100, y: y * 100 });
  }, []);

  const handlePointerEnter = useCallback(() => setIsHovered(true), []);
  const handlePointerLeave = useCallback(() => {
    setIsHovered(false);
    setIsPressed(false);
    setTilt({ x: 0, y: 0 });
    setGlowPos({ x: 50, y: 50 });
  }, []);
  const handlePointerDown = useCallback(() => setIsPressed(true), []);
  const handlePointerUp = useCallback(() => setIsPressed(false), []);

  return (
    <div
      ref={cardRef}
      className="prize-stat-card"
      style={{
        perspective: "800px",
        animationDelay: `${index * 120}ms`,
      }}
      onPointerMove={handlePointerMove}
      onPointerEnter={handlePointerEnter}
      onPointerLeave={handlePointerLeave}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
    >
      <div
        className="prize-stat-card-inner"
        style={{
          transform: isHovered
            ? `rotateX(${tilt.x}deg) rotateY(${tilt.y}deg) scale3d(${isPressed ? 0.97 : 1.04}, ${isPressed ? 0.97 : 1.04}, 1)`
            : "rotateX(0) rotateY(0) scale3d(1,1,1)",
          transition: isHovered
            ? "transform 0.08s ease-out"
            : "transform 0.5s cubic-bezier(0.2, 0.8, 0.2, 1)",
        }}
      >
        {/* Shimmer glow that follows cursor */}
        <div
          className="prize-card-glow"
          style={{
            opacity: isHovered ? 1 : 0,
            background: `radial-gradient(circle at ${glowPos.x}% ${glowPos.y}%, rgba(217,169,74,0.18) 0%, transparent 60%)`,
          }}
        />

        {/* Border highlight on hover */}
        <div
          className="prize-card-border-highlight"
          style={{
            opacity: isHovered ? 1 : 0,
            background: `conic-gradient(from ${Math.atan2(glowPos.y - 50, glowPos.x - 50) * 180 / Math.PI}deg at ${glowPos.x}% ${glowPos.y}%, rgba(217,169,74,0.5), transparent 40%, transparent 60%, rgba(244,200,98,0.3) 100%)`,
          }}
        />

        {/* Flowing specular sheen — travels across the glass on hover */}
        <div
          className={`prize-card-sheen ${isHovered ? "prize-card-sheen-on" : ""}`}
          aria-hidden="true"
        />

        {/* Content — lifted off the glass plane in real 3D space */}
        <div
          className="prize-card-content"
          style={{
            transform: isHovered ? "translateZ(26px)" : "translateZ(0)",
            transition: "transform 0.45s cubic-bezier(0.2, 0.8, 0.2, 1)",
          }}
        >
          <div
            className="prize-card-icon"
            style={{
              transform: isHovered ? "translateZ(22px)" : "translateZ(0)",
              transition: "transform 0.5s cubic-bezier(0.2, 0.8, 0.2, 1)",
            }}
          >
            {stat.icon}
          </div>
          <p className="prize-card-value">{stat.value}</p>
          <p className="prize-card-label">{stat.label}</p>
        </div>

        {/* Sparkling dots on hover */}
        {isHovered && (
          <div className="prize-card-sparkles" aria-hidden="true">
            {[...Array(6)].map((_, i) => (
              <span
                key={i}
                className="prize-sparkle-dot"
                style={{
                  left: `${15 + Math.random() * 70}%`,
                  top: `${15 + Math.random() * 70}%`,
                  animationDelay: `${i * 0.15}s`,
                  width: `${2 + Math.random() * 2}px`,
                  height: `${2 + Math.random() * 2}px`,
                }}
              />
            ))}
          </div>
        )}
      </div>

      {/* Gold pool cast on the floor beneath the card */}
      <div
        className="prize-card-floor"
        style={{ opacity: isHovered ? 1 : 0 }}
        aria-hidden="true"
      />
    </div>
  );
}

/* ─── Gold Particle Canvas ─────────────────────────────────────────────────── */
function PrizeParticles() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef(0);
  const visibleRef = useRef(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    if (prefersReducedMotion()) return;

    const isMobile = window.innerWidth < 768;
    const particleCount = isMobile ? 30 : 60;

    interface Spark {
      x: number; y: number;
      vx: number; vy: number;
      size: number; alpha: number;
      life: number; maxLife: number;
      drift: number;
    }

    let sparks: Spark[] = [];
    let w = 0, h = 0;
    let t = 0;

    function resize() {
      const rect = canvas!.parentElement?.getBoundingClientRect();
      if (!rect) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = rect.width;
      h = rect.height;
      canvas!.width = Math.round(w * dpr);
      canvas!.height = Math.round(h * dpr);
      canvas!.style.width = `${w}px`;
      canvas!.style.height = `${h}px`;
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function spawnSpark() {
      sparks.push({
        x: Math.random() * w,
        y: h + 5,
        vx: (Math.random() - 0.5) * 0.6,
        vy: -(0.3 + Math.random() * 0.8),
        size: 1 + Math.random() * 2.5,
        alpha: 0.3 + Math.random() * 0.5,
        life: 0,
        maxLife: 3 + Math.random() * 4,
        drift: Math.random() * Math.PI * 2,
      });
    }

    // Seed initial particles
    for (let i = 0; i < particleCount; i++) {
      sparks.push({
        x: Math.random() * (w || 800),
        y: Math.random() * (h || 600),
        vx: (Math.random() - 0.5) * 0.5,
        vy: -(0.2 + Math.random() * 0.6),
        size: 1 + Math.random() * 2.5,
        alpha: 0.2 + Math.random() * 0.4,
        life: Math.random() * 3,
        maxLife: 3 + Math.random() * 4,
        drift: Math.random() * Math.PI * 2,
      });
    }

    resize();

    function draw() {
      if (!visibleRef.current) {
        rafRef.current = requestAnimationFrame(draw);
        return;
      }

      t += 0.006;
      ctx!.clearRect(0, 0, w, h);

      // Spawn new sparks
      if (sparks.length < particleCount && Math.random() < 0.15) {
        spawnSpark();
      }

      const live: Spark[] = [];
      for (const s of sparks) {
        s.life += 0.016;
        if (s.life > s.maxLife) continue;

        // Flowing current — embers ride a slow horizontal air stream
        const flow = Math.sin(t * 1.6 + s.drift + s.y * 0.004) * 0.22;
        s.x += s.vx + flow;
        s.y += s.vy;
        s.vx += (Math.random() - 0.5) * 0.02;
        s.vx *= 0.99;

        if (s.x < -20) s.x = w + 20;
        if (s.x > w + 20) s.x = -20;

        const p = s.life / s.maxLife;
        const fadeIn = Math.min(1, p * 5);
        const fadeOut = p > 0.7 ? 1 - (p - 0.7) / 0.3 : 1;
        // Gentle pulse so the field feels alive rather than uniform
        const pulse = 0.82 + 0.18 * Math.sin(t * 5 + s.drift);
        const a = s.alpha * fadeIn * fadeOut * pulse;

        // Gold glow dot
        ctx!.fillStyle = `rgba(217,169,74,${a * 0.6})`;
        ctx!.beginPath();
        ctx!.arc(s.x, s.y, s.size * 2.5, 0, Math.PI * 2);
        ctx!.fill();

        // Bright core
        ctx!.fillStyle = `rgba(255,230,160,${a})`;
        ctx!.beginPath();
        ctx!.arc(s.x, s.y, s.size, 0, Math.PI * 2);
        ctx!.fill();

        live.push(s);
      }
      sparks = live;

      rafRef.current = requestAnimationFrame(draw);
    }

    const io = new IntersectionObserver(
      ([entry]) => {
        visibleRef.current = entry.isIntersecting;
        if (entry.isIntersecting && rafRef.current === 0) {
          rafRef.current = requestAnimationFrame(draw);
        }
      },
      { threshold: 0.05 }
    );
    io.observe(canvas);

    rafRef.current = requestAnimationFrame(draw);

    window.addEventListener("resize", resize);
    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener("resize", resize);
      io.disconnect();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none"
      style={{ zIndex: 2 }}
      aria-hidden="true"
    />
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   Main Prizes Section
   ═══════════════════════════════════════════════════════════════════════════ */
export default function Prizes() {
  const sectionRef = useRef<HTMLElement>(null);
  const bgRef = useRef<HTMLImageElement>(null);
  const shaftRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLDivElement>(null);
  const amountRef = useRef<HTMLParagraphElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setIsVisible(true); },
      { threshold: 0.15 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  /* ── Pointer + scroll driven 3D parallax ──
     Every layer of the plate moves at its own depth, so the podium, the light
     shaft and the headline separate as the cursor travels across the section. */
  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;
    if (prefersReducedMotion()) return;

    const target = { x: 0, y: 0 };
    const cur = { x: 0, y: 0 };
    let scrollT = 0;
    let raf = 0;
    let inView = false;

    const onPointerMove = (e: PointerEvent) => {
      const rect = section.getBoundingClientRect();
      target.x = (e.clientX - rect.left) / rect.width - 0.5;
      target.y = (e.clientY - rect.top) / rect.height - 0.5;
    };

    const onPointerLeave = () => {
      target.x = 0;
      target.y = 0;
    };

    const tick = () => {
      if (!inView) {
        raf = requestAnimationFrame(tick);
        return;
      }

      cur.x += (target.x - cur.x) * 0.07;
      cur.y += (target.y - cur.y) * 0.07;

      const rect = section.getBoundingClientRect();
      const vh = window.innerHeight || 1;
      // -1 (section below fold) → 1 (section above fold)
      scrollT = Math.max(-1, Math.min(1, 1 - (rect.top + rect.height / 2) / (vh / 2 + rect.height / 2)));

      if (bgRef.current) {
        bgRef.current.style.transform =
          `translate3d(${-cur.x * 22}px, ${-cur.y * 14 + scrollT * 18}px, 0) scale(1.08)`;
      }
      if (shaftRef.current) {
        shaftRef.current.style.transform =
          `translate3d(${-cur.x * 52}px, ${scrollT * 26}px, 0)`;
      }
      if (textRef.current) {
        textRef.current.style.transform =
          `rotateY(${cur.x * 4}deg) rotateX(${-cur.y * 3}deg) translate3d(${cur.x * 10}px, ${cur.y * 6}px, 0)`;
      }
      if (amountRef.current) {
        amountRef.current.style.transform = `translate3d(${cur.x * 16}px, ${cur.y * 8}px, 60px)`;
      }

      raf = requestAnimationFrame(tick);
    };

    const io = new IntersectionObserver(
      ([entry]) => { inView = entry.isIntersecting; },
      { threshold: 0.02 }
    );
    io.observe(section);

    section.addEventListener("pointermove", onPointerMove, { passive: true });
    section.addEventListener("pointerleave", onPointerLeave, { passive: true });
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      section.removeEventListener("pointermove", onPointerMove);
      section.removeEventListener("pointerleave", onPointerLeave);
      io.disconnect();
    };
  }, []);

  return (
    <section
      id="prizes"
      ref={sectionRef}
      className="relative overflow-hidden prizes-section-3d"
      style={{ background: "#07090d" }}
    >
      {/* ── Hero Background Image ── */}
      <div className="prizes-hero-bg" aria-hidden="true">
        <img
          ref={bgRef}
          src="/textures/prizes-hero-bg.jpg"
          alt=""
          loading="lazy"
          decoding="async"
          className="prizes-hero-img"
        />
        {/* Left-side text-safe gradient overlay */}
        <div className="prizes-hero-overlay-left" />
        {/* Bottom fade for cards area */}
        <div className="prizes-hero-overlay-bottom" />
        {/* Top edge blend */}
        <div className="prizes-hero-overlay-top" />

        {/* Flowing volumetric shaft falling onto the podium */}
        <div ref={shaftRef} className="prizes-light-shaft" />
        {/* Slow light current travelling across the reflective floor */}
        <div className="prizes-floor-flow" />
      </div>

      {/* ── Floating gold particles ── */}
      <PrizeParticles />

      {/* ── Content ── */}
      <div className="wrap relative" style={{ zIndex: 10 }}>
        <div className="prizes-content-grid">
          {/* Left Column: Text */}
          <div className={`prizes-text-col ${isVisible ? "prizes-text-visible" : ""}`}>
            <div ref={textRef} className="prizes-text-3d">
              <p className="kicker mb-3" style={{ letterSpacing: "0.15em" }}>
                <span style={{ display: "inline-flex", alignItems: "center", gap: "8px" }}>
                  PRIZES
                  <span style={{
                    display: "inline-block",
                    width: "32px",
                    height: "1px",
                    background: "var(--gold)",
                    opacity: 0.6,
                  }} />
                </span>
              </p>
              <h2 className="font-display text-3xl sm:text-5xl leading-tight" style={{ color: "var(--paper)" }}>
                Win big at AppForge
              </h2>
              <p
                ref={amountRef}
                className="mt-8 font-display text-6xl sm:text-8xl prizes-amount"
                style={{
                  background: "linear-gradient(180deg, #f4c862 0%, #d9a94a 60%, #a67c30 100%)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                  filter: "drop-shadow(0 2px 12px rgba(217,169,74,0.3))",
                }}
              >
                ₹45,000
                <span className="prizes-amount-sweep" aria-hidden="true" />
              </p>
              <div className="prizes-amount-rule" aria-hidden="true" />
              <p className="mt-3 prizes-subtitle">
                Awarded across winning teams at the closing ceremony.
              </p>
              <p className="mt-6 text-xs leading-relaxed" style={{ color: "var(--muted)", maxWidth: "420px", opacity: 0.8 }}>
                Rewards are structured based on team size, category, technical depth and overall impact, with additional perks and recognition for outstanding projects. The exact breakdown may vary and will be communicated during the event.
              </p>
            </div>
          </div>

          {/* Right Column: space for the hero bg image (doesn't need content) */}
          <div className="prizes-hero-col" aria-hidden="true" />
        </div>

        {/* ── Stat Cards Row ── */}
        <div className={`prizes-stats-row ${isVisible ? "prizes-stats-visible" : ""}`}>
          {STATS.map((stat, i) => (
            <StatCard key={stat.label} stat={stat} index={i} />
          ))}
        </div>
      </div>

      {/* Bottom edge blend into next section */}
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          height: "80px",
          background: "linear-gradient(to bottom, transparent, #07090d)",
          zIndex: 5,
          pointerEvents: "none",
        }}
        aria-hidden="true"
      />
    </section>
  );
}
