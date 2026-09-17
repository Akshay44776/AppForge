"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Countdown from "./Countdown";
import ConstellationBg, { ConstellationBgHandle } from "./ConstellationBg";
import PhoneMockupLoop from "./domains/PhoneMockupLoop";
import { EVENT_DATE } from "@/lib/site";

/* ═══════════════════════════════════════════════════════════════════════════
   Tracks — "Three Domains" section.

   Structure:
     1. ConstellationBg — amber plexus particle network (z-0, behind all)
     2. Section content — heading, paragraph, countdown (z-10)
     3. Domain card grid — 3 cards with in-card phone mockup loops
     4. HoverPhoneReveal — shared 3D wireframe phone overlay (z-20)
     5. Expectation bullets below cards

   The existing locked → unsealing → open state machine is preserved
   for the future unseal transition.
   ═══════════════════════════════════════════════════════════════════════════ */

/* ─── Domain data ──────────────────────────────────────────────────────── */
const DOMAINS = [
  {
    index: 1,
    tag: "DOMAIN · 01",
    title: "Civic, Safety & Community Impact",
    chip: "3 PROBLEM STATEMENTS",
    phaseOffset: 0,
  },
  {
    index: 2,
    tag: "DOMAIN · 02",
    title: "Trust, Security & Intelligent Agents",
    chip: "3 PROBLEM STATEMENTS",
    phaseOffset: 650,
  },
  {
    index: 3,
    tag: "DOMAIN · 03",
    title: "Smart Mobility, Workforce & Privacy Fintech",
    chip: "3 PROBLEM STATEMENTS",
    phaseOffset: 1300,
  },
];

const CARD_BODY =
  "Domain name only. The three problem statements inside are written, reviewed, and sealed — until the day of the event.";

/* ─── DomainCard ───────────────────────────────────────────────────────── */
function DomainCard({
  domain,
  sealed = true,
  isHovered,
  onHover,
  onBlur,
  onClick,
  cardRef,
}: {
  domain: (typeof DOMAINS)[number];
  sealed?: boolean;
  isHovered: boolean;
  onHover: () => void;
  onBlur: () => void;
  onClick: (e: React.MouseEvent<HTMLDivElement>) => void;
  cardRef: (el: HTMLDivElement | null) => void;
}) {
  const [phase, setPhase] = useState<"locked" | "unsealing" | "open">("locked");

  useEffect(() => {
    if (!sealed && phase === "locked") {
      setPhase("unsealing");
      const t = setTimeout(() => setPhase("open"), 900);
      return () => clearTimeout(t);
    }
    if (sealed && phase !== "locked") setPhase("locked");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sealed]);

  return (
    <div
      ref={cardRef}
      className={`domain-card panel-${phase}`}
      onMouseEnter={onHover}
      onMouseLeave={onBlur}
      onClick={onClick}
      onFocus={onHover}
      onBlur={onBlur}
      tabIndex={0}
      role="article"
      aria-label={`${domain.tag}: ${domain.title}`}
      style={{
        position: "relative",
        overflow: "hidden",
        background: "var(--surface)",
        border: "1px solid rgba(255,255,255,0.06)",
        borderRadius: "14px",
        padding: "28px",
        display: "flex",
        flexDirection: "column",
        minHeight: "420px",
        transition: "border-color 0.3s ease, box-shadow 0.3s ease",
        borderColor: isHovered ? "rgba(217,169,74,0.2)" : "rgba(255,255,255,0.06)",
        boxShadow: isHovered
          ? "0 0 30px rgba(217,169,74,0.06), inset 0 1px 0 rgba(217,169,74,0.08)"
          : "none",
      }}
    >
      {/* Sealed panel texture */}
      <div
        className="absolute inset-0 opacity-15 pointer-events-none"
        style={{
          backgroundImage: "url(/textures/sealed-panel.png)",
          backgroundSize: "cover",
        }}
        aria-hidden="true"
      />
      <div className="scanline" aria-hidden="true" />

      {/* Top row: tag + chip */}
      <div className="relative flex items-center justify-between gap-2 mb-4">
        <span
          className="font-display text-[11px] tracking-[0.08em] uppercase"
          style={{ color: "var(--gold)" }}
        >
          {domain.tag}
        </span>
        <span
          className="text-[10px] tracking-[0.06em] uppercase px-2 py-0.5 rounded-full"
          style={{
            color: "var(--gold)",
            border: "1px solid rgba(217,169,74,0.2)",
            opacity: 0.7,
          }}
        >
          {domain.chip}
        </span>
      </div>

      {/* Domain title */}
      <h3
        className="relative font-display text-xl leading-snug"
        style={{ color: "var(--paper)" }}
      >
        {domain.title}
      </h3>

      {/* Body copy */}
      <p
        className="relative mt-3 text-sm leading-relaxed"
        style={{ color: "var(--muted)" }}
      >
        {CARD_BODY}
      </p>

      {/* Phone mockup loop */}
      <div className="relative flex-1 flex items-center justify-center mt-4 mb-4">
        <div className={`locked-content`}>
          <PhoneMockupLoop phaseOffset={domain.phaseOffset} />
        </div>
        <div className="open-content">
          {/* Future: revealed content renders here when unsealed */}
        </div>
      </div>

      {/* Amber divider */}
      <div
        className="relative w-full mb-3"
        style={{
          height: "1px",
          background: "linear-gradient(90deg, transparent, var(--gold), transparent)",
          opacity: 0.25,
        }}
        aria-hidden="true"
      />

      {/* SEALED UNTIL LAUNCH pill */}
      <div className="relative locked-content flex items-center justify-center gap-2">
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="var(--gold)"
          strokeWidth="1.5"
          aria-hidden="true"
        >
          <rect x="4" y="10" width="16" height="10" rx="1.5" />
          <path d="M8 10V7a4 4 0 0 1 8 0v3" />
        </svg>
        <span
          className="text-xs tracking-[0.1em] uppercase font-display"
          style={{ color: "var(--gold)" }}
        >
          Sealed until launch
        </span>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   Tracks — Top-level section
   ═══════════════════════════════════════════════════════════════════════════ */
export default function Tracks() {
  const [activeCard, setActiveCard] = useState<number | null>(null);
  const cardRefsArray = useRef<(HTMLDivElement | null)[]>([null, null, null]);
  const cardRefs = useRef(cardRefsArray.current);
  const containerRef = useRef<HTMLDivElement>(null);
  const constellationRef = useRef<ConstellationBgHandle>(null);

  const handleCardClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    constellationRef.current?.triggerBurst(
      rect.left + rect.width / 2,
      rect.top + rect.height / 2
    );
  }, []);

  // Keep cardRefs.current in sync
  useEffect(() => {
    cardRefs.current = cardRefsArray.current;
  });

  const setCardRef = useCallback(
    (index: number) => (el: HTMLDivElement | null) => {
      cardRefsArray.current[index] = el;
    },
    []
  );

  return (
    <section id="tracks" className="relative section-pad overflow-hidden">
      {/* Background: constellation particle network */}
      <ConstellationBg ref={constellationRef} />

      <div ref={containerRef} className="wrap relative z-10">
        {/* Eyebrow */}
        <p className="kicker mb-3">Kept under wraps</p>

        {/* Heading */}
        <h2 className="font-display text-3xl sm:text-5xl leading-tight">
          Three Domains
        </h2>

        {/* Supporting paragraph */}
        <p
          className="mt-5 leading-relaxed"
          style={{ maxWidth: "65ch", color: "var(--muted)" }}
        >
          The challenge is built around three domains. Inside each domain sit
          three original problem statements — written, reviewed, and sealed
          together, revealed only on the day of the event. Every problem
          statement ships with a set of general expectations to build against.
          What you add on top of that is entirely up to you.
        </p>

        {/* Countdown */}
        <div className="mt-10 flex flex-wrap items-center gap-6">
          <p className="text-sm" style={{ color: "var(--muted)" }}>
            Problem statements unlock in
          </p>
          <Countdown to={EVENT_DATE} />
        </div>

        {/* Domain cards grid */}
        <div className="mt-8 grid md:grid-cols-3 gap-5">
          {DOMAINS.map((d, i) => (
            <DomainCard
              key={d.index}
              domain={d}
              isHovered={activeCard === i}
              onHover={() => setActiveCard(i)}
              onBlur={() => setActiveCard(null)}
              onClick={handleCardClick}
              cardRef={setCardRef(i)}
            />
          ))}
        </div>

        {/* Hover phone reveal was removed */}

        {/* Expectation bullets */}
        <ul
          className="mt-10 space-y-2 text-sm"
          style={{ maxWidth: "70ch", color: "var(--muted)" }}
        >
          <li>
            • A working core build that meets the general expectations
            announced at the start of the challenge.
          </li>
          <li>
            • One original feature or approach that&apos;s entirely your own —
            this is what sets your build apart from everyone else on the same
            statement.
          </li>
        </ul>
      </div>
    </section>
  );
}
