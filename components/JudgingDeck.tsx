"use client";

import React, { useEffect, useState, useRef, useCallback } from "react";
import { useCardDeck } from "@/lib/useCardDeck";

/* ─── Types ─── */
interface JudgingCriterion {
  title: string;
  description: string;
  subtitle: string;
  icon: React.ReactNode;
  accent: string;
}

/* ─── SVG Icons (thin stroke, matching track-card style) ─── */
const icons: Record<string, React.ReactNode> = {
  problem: (
    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="7" stroke="currentColor" />
      <path d="M21 21l-4.35-4.35" stroke="currentColor" />
      <path d="M11 8v3l2 2" stroke="currentColor" />
    </svg>
  ),
  technical: (
    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="16 18 22 12 16 6" stroke="currentColor" />
      <polyline points="8 6 2 12 8 18" stroke="currentColor" />
      <line x1="12" y1="2" x2="12" y2="22" stroke="currentColor" opacity="0.3" />
    </svg>
  ),
  adaptability: (
    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 3a2.828 2.828 0 114 4L7.5 20.5 2 22l1.5-5.5L17 3z" stroke="currentColor" />
    </svg>
  ),
  uiux: (
    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" />
      <line x1="3" y1="9" x2="21" y2="9" stroke="currentColor" />
      <line x1="9" y1="21" x2="9" y2="9" stroke="currentColor" />
    </svg>
  ),
  impact: (
    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 12h-4l-3 9L9 3l-3 9H2" stroke="currentColor" />
    </svg>
  ),
  presentation: (
    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="3" width="20" height="14" rx="2" stroke="currentColor" />
      <line x1="8" y1="21" x2="16" y2="21" stroke="currentColor" />
      <line x1="12" y1="17" x2="12" y2="21" stroke="currentColor" />
    </svg>
  ),
};

/* ─── Data ─── */
const CRITERIA: JudgingCriterion[] = [
  {
    title: "Problem Understanding",
    description: "How well the build addresses the track's base problem and its real-world relevance.",
    subtitle: "ANALYZE · WEIGH",
    icon: icons.problem,
    accent: "var(--gold)",
  },
  {
    title: "Technical Execution",
    description: "Code quality, functionality, and how much of the build actually works end to end.",
    subtitle: "BUILD · SHIP",
    icon: icons.technical,
    accent: "#3ECF8E",
  },
  {
    title: "Adaptability",
    description: "How cleanly both twist cards were absorbed into the product, not bolted on.",
    subtitle: "PIVOT · INTEGRATE",
    icon: icons.adaptability,
    accent: "var(--periwinkle)",
  },
  {
    title: "UI / UX",
    description: "Usability and design quality of the final build.",
    subtitle: "CRAFT · REFINE",
    icon: icons.uiux,
    accent: "#A78BFA",
  },
  {
    title: "Impact & Scalability",
    description: "Whether the idea could hold up beyond the hackathon table.",
    subtitle: "SCALE · SUSTAIN",
    icon: icons.impact,
    accent: "#F2765A",
  },
  {
    title: "Presentation",
    description: "Clarity of the live demo and how well the team explains their own build.",
    subtitle: "DEMO · CONVINCE",
    icon: icons.presentation,
    accent: "#5AD1E8",
  },
];

/* ─── Card Transform ─── */
function cardTransform(stackIndex: number, total: number): React.CSSProperties {
  const depth = stackIndex * -40;
  const lift = stackIndex * 10;
  const tilt = stackIndex * 2.5 * (stackIndex % 2 === 0 ? 1 : -1);
  const scale = 1 - stackIndex * 0.045;
  const opacity = stackIndex === 0 ? 1 : Math.max(0.2, 0.55 - stackIndex * 0.07);

  return {
    transform: `translateZ(${depth}px) translateY(${lift}px) rotateZ(${tilt}deg) scale(${scale})`,
    opacity,
    zIndex: total - stackIndex,
    pointerEvents: stackIndex === 0 ? "auto" : "none",
  };
}

/* ─── Component ─── */
export default function JudgingDeck() {
  const [reducedMotion, setReducedMotion] = useState(false);
  const stageRef = useRef<HTMLDivElement>(null);
  const touchStartX = useRef<number | null>(null);

  useEffect(() => {
    setReducedMotion(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }, []);

  const { activeIndex, isAnimating, next, prev, goTo, getStackIndex } = useCardDeck({
    count: CRITERIA.length,
    reducedMotion,
  });

  /* Keyboard */
  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        next();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        prev();
      }
    },
    [next, prev]
  );

  /* Swipe */
  const onTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  }, []);

  const onTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      if (touchStartX.current === null) return;
      const diff = e.changedTouches[0].clientX - touchStartX.current;
      if (Math.abs(diff) > 40) {
        diff < 0 ? next() : prev();
      }
      touchStartX.current = null;
    },
    [next, prev]
  );

  const current = CRITERIA[activeIndex];

  return (
    <section id="evaluation" className="section-pad relative overflow-hidden">
      <div className="wrap">
        <p className="kicker mb-3">Judging</p>
        <h2 className="font-display text-3xl sm:text-5xl leading-tight">How teams are judged</h2>
        <p className="mt-5 text-muted leading-relaxed" style={{ maxWidth: "60ch" }}>
          Six criteria — click the front card to cycle through each one.
        </p>

        {/* Deck Stage */}
        <div className="mt-14 flex flex-col items-center">
          <div
            ref={stageRef}
            className="judging-deck-stage relative"
            style={{
              perspective: "1600px",
              perspectiveOrigin: "50% 30%",
              width: "100%",
              maxWidth: "520px",
              height: "420px",
            }}
            onTouchStart={onTouchStart}
            onTouchEnd={onTouchEnd}
          >
            {CRITERIA.map((criterion, i) => {
              const stackIdx = getStackIndex(i);
              const isFront = stackIdx === 0;
              const style = reducedMotion
                ? {
                    opacity: isFront ? 1 : 0,
                    zIndex: isFront ? 10 : 0,
                    transition: "opacity 0.3s ease",
                  }
                : {
                    ...cardTransform(stackIdx, CRITERIA.length),
                    transformStyle: "preserve-3d" as const,
                    transition: isAnimating
                      ? "transform 0.7s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.5s ease"
                      : "none",
                    willChange: "transform, opacity",
                    transformOrigin: isFront && isAnimating ? "0% 50%" : "50% 50%",
                  };

              return (
                <div
                  key={criterion.title}
                  className="absolute inset-0 rounded-2xl"
                  style={style}
                >
                  <button
                    type="button"
                    tabIndex={isFront ? 0 : -1}
                    aria-label={`Criterion ${activeIndex + 1} of ${CRITERIA.length}: ${criterion.title}`}
                    onClick={() => isFront && next()}
                    onKeyDown={isFront ? onKeyDown : undefined}
                    className="judging-card group relative w-full h-full rounded-2xl border text-left p-8 sm:p-10 flex flex-col cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-ink"
                    style={{
                      background: "linear-gradient(145deg, rgba(16,20,27,0.95), rgba(13,13,18,0.98))",
                      borderColor: isFront
                        ? `color-mix(in srgb, ${criterion.accent} 35%, transparent)`
                        : "rgba(255,255,255,0.06)",
                      boxShadow: isFront
                        ? `0 16px 60px rgba(0,0,0,0.5), 0 0 30px ${criterion.accent}15, inset 0 1px 0 rgba(255,255,255,0.08)`
                        : "0 8px 30px rgba(0,0,0,0.35)",
                      focusVisibleRingColor: criterion.accent,
                    } as React.CSSProperties}
                  >
                    {/* Top highlight line */}
                    <div className="absolute top-0 left-0 right-0 h-px rounded-t-2xl bg-gradient-to-r from-transparent via-white/15 to-transparent" />

                    {/* Pulsing glow ring for front card */}
                    {isFront && (
                      <div
                        className="absolute inset-0 rounded-2xl pointer-events-none judging-pulse-ring"
                        style={{
                          boxShadow: `inset 0 0 0 1px ${criterion.accent}20, 0 0 20px ${criterion.accent}08`,
                        }}
                      />
                    )}

                    {/* Icon */}
                    <div
                      className="mb-5 transition-transform duration-300 group-hover:scale-110"
                      style={{
                        color: criterion.accent,
                        filter: `drop-shadow(0 0 12px ${criterion.accent}40)`,
                      }}
                    >
                      {criterion.icon}
                    </div>

                    {/* Subtitle */}
                    <p
                      className="text-[11px] tracking-[0.15em] font-mono font-medium mb-2"
                      style={{ color: criterion.accent }}
                    >
                      {criterion.subtitle}
                    </p>

                    {/* Title */}
                    <h3 className="font-display text-2xl sm:text-3xl text-paper leading-tight">
                      {criterion.title}
                    </h3>

                    {/* Description */}
                    <p className="mt-4 text-sm text-muted leading-relaxed" style={{ maxWidth: "42ch" }}>
                      {criterion.description}
                    </p>

                    {/* Spacer + position indicator on front card */}
                    <div className="mt-auto pt-6 flex items-center justify-between w-full">
                      <span className="text-[11px] tracking-widest text-muted/60 font-mono">
                        {String(activeIndex + 1).padStart(2, "0")} / {String(CRITERIA.length).padStart(2, "0")}
                      </span>
                      {isFront && (
                        <span className="text-[11px] tracking-wider text-muted/40 flex items-center gap-1.5 group-hover:text-muted/70 transition-colors">
                          NEXT
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="9 18 15 12 9 6" />
                          </svg>
                        </span>
                      )}
                    </div>
                  </button>
                </div>
              );
            })}
          </div>

          {/* Dot indicators */}
          <div className="mt-8 flex items-center gap-2.5" role="tablist" aria-label="Judging criteria">
            {CRITERIA.map((criterion, i) => (
              <button
                key={criterion.title}
                type="button"
                role="tab"
                aria-selected={i === activeIndex}
                aria-label={`${criterion.title}`}
                onClick={() => goTo(i)}
                className="w-2 h-2 rounded-full transition-all duration-300"
                style={{
                  backgroundColor:
                    i === activeIndex
                      ? criterion.accent
                      : "rgba(255,255,255,0.15)",
                  transform: i === activeIndex ? "scale(1.4)" : "scale(1)",
                  boxShadow:
                    i === activeIndex
                      ? `0 0 8px ${criterion.accent}50`
                      : "none",
                }}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
