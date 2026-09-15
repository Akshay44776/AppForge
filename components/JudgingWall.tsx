"use client";

import React, { useState, useEffect, useRef } from "react";
import WallCard, { type JudgingCriterion } from "./WallCard";

/* ═══════════════════════════════════════════
   Icons
   ═══════════════════════════════════════════ */
const IconWrapper = ({ children }: { children: React.ReactNode }) => (
  <svg
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    {children}
  </svg>
);

/* ═══════════════════════════════════════════
   Criteria Data
   ═══════════════════════════════════════════ */
const CRITERIA: JudgingCriterion[] = [
  {
    title: "Problem Understanding",
    description: "How well the build addresses the track's base problem and its real-world relevance.",
    subtitle: "ANALYZE \u00b7 WEIGH",
    accent: "#d9a94a",
    icon: (
      <IconWrapper>
        <circle cx="11" cy="11" r="7" />
        <path d="M21 21l-4.35-4.35" />
        <path d="M11 8v3l2 2" />
      </IconWrapper>
    ),
  },
  {
    title: "Technical Execution",
    description: "Code quality, functionality, and how much of the build actually works end to end.",
    subtitle: "BUILD \u00b7 SHIP",
    accent: "#3ECF8E",
    icon: (
      <IconWrapper>
        <polyline points="16 18 22 12 16 6" />
        <polyline points="8 6 2 12 8 18" />
      </IconWrapper>
    ),
  },
  {
    title: "Adaptability",
    description: "How cleanly both twist cards were absorbed into the product, not bolted on.",
    subtitle: "PIVOT \u00b7 INTEGRATE",
    accent: "#7C9CF0",
    icon: (
      <IconWrapper>
        <path d="M17 3a2.828 2.828 0 114 4L7.5 20.5 2 22l1.5-5.5z" />
      </IconWrapper>
    ),
  },
  {
    title: "UI / UX",
    description: "Usability and design quality of the final build.",
    subtitle: "CRAFT \u00b7 REFINE",
    accent: "#A78BFA",
    icon: (
      <IconWrapper>
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <line x1="3" y1="9" x2="21" y2="9" />
        <line x1="9" y1="21" x2="9" y2="9" />
      </IconWrapper>
    ),
  },
  {
    title: "Impact & Scalability",
    description: "Whether the idea could hold up beyond the hackathon table.",
    subtitle: "SCALE \u00b7 SUSTAIN",
    accent: "#F2765A",
    icon: (
      <IconWrapper>
        <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
      </IconWrapper>
    ),
  },
  {
    title: "Presentation",
    description: "Clarity of the live demo and how well the team explains their own build.",
    subtitle: "DEMO \u00b7 CONVINCE",
    accent: "#5AD1E8",
    icon: (
      <IconWrapper>
        <rect x="2" y="3" width="20" height="14" rx="2" />
        <line x1="8" y1="21" x2="16" y2="21" />
        <line x1="12" y1="17" x2="12" y2="21" />
      </IconWrapper>
    ),
  },
];

/* ═══════════════════════════════════════════
   Component
   ═══════════════════════════════════════════ */
export default function JudgingWall() {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const wallRef = useRef<HTMLDivElement>(null);

  // Click outside to clear focus
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      if (wallRef.current && !wallRef.current.contains(e.target as Node)) {
        setActiveIndex(null);
      }
    };
    
    // Also clear on mouse leave of the entire wall container
    const handleMouseLeave = () => {
      setActiveIndex(null);
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside);
    
    const wallEl = wallRef.current;
    if (wallEl) {
      wallEl.addEventListener("mouseleave", handleMouseLeave);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
      if (wallEl) {
        wallEl.removeEventListener("mouseleave", handleMouseLeave);
      }
    };
  }, []);

  return (
    <section id="evaluation" className="section-pad relative overflow-hidden">
      {/* Background radial glow */}
      <div 
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-4xl h-[400px] pointer-events-none opacity-40 blur-[80px]"
        style={{
          background: "radial-gradient(ellipse at center, rgba(232, 161, 92, 0.15) 0%, rgba(124, 156, 240, 0.1) 50%, transparent 70%)"
        }}
      />

      <div className="wrap relative z-10">
        <div className="text-center mb-16">
          <p className="kicker mb-3">Judging</p>
          <h2 className="font-display text-3xl sm:text-5xl leading-tight">
            How teams are judged
          </h2>
          <p className="mt-5 text-muted leading-relaxed mx-auto" style={{ maxWidth: "60ch" }}>
            Six criteria. Hover or tap a card to bring it into focus.
          </p>
        </div>

        <div 
          ref={wallRef}
          className="wall-stage" 
          data-wall-active={activeIndex !== null}
        >
          {CRITERIA.map((criterion, idx) => (
            <WallCard
              key={idx}
              criterion={criterion}
              index={idx}
              isFocused={activeIndex === idx}
              onFocus={() => setActiveIndex(idx)}
              onBlur={() => setActiveIndex(null)}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
