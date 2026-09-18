"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import TwistDeckCanvas, { TwistDeckCanvasHandle } from "./TwistDeckCanvas";

/* ═══════════════════════════════════════════
   Data
   ═══════════════════════════════════════════ */
const EXAMPLES = [
  "Example twist: your app must now work fully offline.",
  "Example twist: a new user group just joined — teenagers, not adults.",
  "Example twist: the whole UI must now pass a strict dark-mode-only constraint.",
  "Example twist: your app has to work with a 2G connection — under 200 KB per screen.",
  "Example twist: add real-time collaboration for at least two simultaneous users.",
];

const CAPTION = "Example only — real twists are sealed until the event.";

interface RoundData {
  id: string;
  label: string;
  title: string;
  time: string;
  duration: string;
  teamsMay: string;
  checkpoint: string;
}

const ROUNDS: RoundData[] = [
  {
    id: "r1",
    label: "Round 1",
    title: "Feasibility",
    time: "Hr 0:00 – 2:00",
    duration: "120 min",
    teamsMay: "Ideate/pivot freely, start coding immediately, set up repo & stack.",
    checkpoint: "Checkpoint 1: Repo w/ first commit · problem-fit & stack articulated · basic wireframe shown (2-min informal mentor walk-by).",
  },
  {
    id: "r2",
    label: "Round 2",
    title: "Build + Twist",
    time: "Hr 2:00 – 6:00",
    duration: "240 min · Twist at Hr 3:00",
    teamsMay: "Free build Hr 2–3, then build core feature + integrate twist in parallel Hr 3–6.",
    checkpoint: "Checkpoint 2: Core feature working end-to-end (partial ok) · twist demonstrably integrated · visible commit history + note on twist change.",
  },
  {
    id: "r3",
    label: "Round 3",
    title: "Final Polish & Pitch",
    time: "Hr 6:00 – 8:00",
    duration: "120 min",
    teamsMay: "Polish/bugfix, deploy/package, rehearse pitch.",
    checkpoint: "Final Judging: Full working demo · 3–5 min pitch ready · regression check (R1 & R2 checklist items still functional).",
  },
];

/* ═══════════════════════════════════════════
   Components
   ═══════════════════════════════════════════ */

function RoundDetail({ data, isHoverMode, align = "center" }: { data: RoundData; isHoverMode: boolean; align?: "left"|"center"|"right" }) {
  const [expanded, setExpanded] = useState(false);

  // Tooltip alignment logic
  const alignClass = align === "left" 
    ? "sm:left-0 sm:translate-x-0 sm:origin-top-left" 
    : align === "right" 
      ? "sm:right-0 sm:translate-x-0 sm:origin-top-right" 
      : "sm:left-1/2 sm:-translate-x-1/2 sm:origin-top";

  return (
    <div
      className={`group relative mt-3 ${isHoverMode ? "" : "mobile-accordion w-full"}`}
      onClick={() => { if (!isHoverMode) setExpanded(!expanded); }}
      onKeyDown={(e) => {
        if (!isHoverMode && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          setExpanded(!expanded);
        }
      }}
      tabIndex={isHoverMode ? -1 : 0}
      role={isHoverMode ? "presentation" : "button"}
      aria-expanded={!isHoverMode ? expanded : undefined}
    >
      {/* The compact trigger pill */}
      <button 
        tabIndex={-1}
        className={`px-4 py-1.5 border border-line bg-surface/80 rounded-full text-[11px] uppercase tracking-wider text-muted transition-colors whitespace-nowrap 
          ${expanded && !isHoverMode ? "text-gold border-gold/50 bg-surface2" : "group-hover:text-gold group-hover:border-gold/50 group-hover:bg-surface2"}`}
      >
        {data.label}
        {(!isHoverMode) && (
          <svg className={`inline-block ml-2 w-3 h-3 text-muted transition-transform duration-300 ${expanded ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        )}
      </button>

      {/* The Tooltip / Accordion Panel */}
      <div
        className={`w-full sm:w-72 p-5 bg-surface2/95 sm:backdrop-blur-md border border-line rounded-lg shadow-2xl z-50 text-left transition-all duration-300
          ${isHoverMode 
            ? `absolute top-full mt-3 ${alignClass} opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto sm:group-focus-within:opacity-100 sm:group-focus-within:pointer-events-auto translate-y-2 group-hover:translate-y-0`
            : expanded 
              ? "max-h-[500px] opacity-100 mt-3" 
              : "max-h-0 opacity-0 overflow-hidden !border-transparent !p-0 !mt-0 !mb-0"
          }`
        }
        aria-hidden={isHoverMode ? undefined : !expanded}
      >
        <div className="space-y-4">
          <div>
            <p className="text-[10px] uppercase tracking-widest text-muted/70 mb-1.5">Teams May:</p>
            <p className="text-xs text-paper/90 leading-relaxed">{data.teamsMay}</p>
          </div>
          <div className="h-px w-full bg-line" />
          <div>
            <p className="text-[10px] uppercase tracking-widest text-gold mb-1.5">Gate:</p>
            <p className="text-xs text-paper/90 leading-relaxed">{data.checkpoint}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function TwistDeck() {
  const [idx, setIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [announced, setAnnounced] = useState("");
  const [deckHidden, setDeckHidden] = useState(false);
  const canvasRef = useRef<TwistDeckCanvasHandle>(null);
  const [fadeMode, setFadeMode] = useState(false);

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const touch = window.matchMedia("(hover: none)").matches;
    setFadeMode(reduced || touch);
  }, []);

  const draw = useCallback(() => {
    setIdx((prev) => {
      let next = Math.floor(Math.random() * EXAMPLES.length);
      if (next === prev) next = (next + 1) % EXAMPLES.length;
      return next;
    });
  }, []);

  const onClick = () => {
    // Trigger the canvas cinematic
    canvasRef.current?.triggerReveal();
    // Announce to screen readers
    setAnnounced(EXAMPLES[idx]);
    // Hide the DOM card so the gold canvas card shows through
    setDeckHidden(true);

    if (fadeMode) {
      draw();
      setFlipped(true);
      return;
    }
    if (flipped) {
      setFlipped(false);
      setTimeout(() => { draw(); setFlipped(true); }, 520);
    } else {
      draw();
      setFlipped(true);
    }
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick(); }
  };

  const card =
    "absolute inset-0 border border-line bg-surface rounded flex flex-col items-center justify-center p-6 text-center shadow-lg";

  return (
    <section id="twistdeck" className="relative section-pad" style={{ minHeight: "clamp(640px, 56vw, 820px)", overflow: "hidden" }}>
      <TwistDeckCanvas ref={canvasRef} text={EXAMPLES[idx]} onReset={() => setDeckHidden(false)} />
      {/* Screen reader announcement */}
      <div className="sr-only" aria-live="polite" role="status">
        {announced}
      </div>
      <div className="wrap relative z-10">
        <p className="kicker mb-3">The mechanic</p>
        <h2 className="font-display text-3xl sm:text-5xl leading-tight">The Twist Deck & Rounds</h2>
        <p className="mt-5 text-muted leading-relaxed" style={{ maxWidth: "65ch" }}>
          AppForge spans three rounds. At Hr 3:00, the Twist Deck is drawn, releasing a single, compulsory twist simultaneously to all teams. You cannot redraw or trade your twist.
        </p>

        {/* 1. TIMELINE RAIL & ROUND DETAILS (Desktop) */}
        <div className="mt-20 w-full mb-16 hidden md:block relative z-50">
          <div className="relative max-w-5xl mx-auto flex justify-between items-start">
            
            {/* The horizontal line */}
            <div className="absolute top-[13px] left-8 right-8 h-px bg-line z-0" aria-hidden />

            {/* Tick 1: Hr 0 */}
            <div className="relative z-10 flex flex-col items-center w-24 -ml-12">
              <div className="timeline-dot" />
              <span className="timeline-label mt-3">Hr 0</span>
            </div>

            {/* Tick 2: Checkpoint 1 & Round 1 */}
            <div className="relative z-10 flex flex-col items-center w-40">
              <div className="timeline-dot" />
              <span className="timeline-label mt-3">Checkpoint 1</span>
              <RoundDetail data={ROUNDS[0]} isHoverMode={!fadeMode} align="left" />
            </div>

            {/* Tick 3: Hr 3 Twist */}
            <div className="relative z-10 flex flex-col items-center w-32">
              <div className="timeline-dot timeline-dot--gold shadow-[0_0_15px_rgba(217,169,74,0.6)]" />
              <span className="timeline-label font-bold text-gold mt-3 whitespace-nowrap">Hr 3 Twist</span>
              {/* Subtle line pointing down to the deck */}
              <div className="w-px h-12 bg-gradient-to-b from-gold/40 to-transparent mt-4 opacity-50" aria-hidden />
            </div>

            {/* Tick 4: Checkpoint 2 & Round 2 */}
            <div className="relative z-10 flex flex-col items-center w-40">
              <div className="timeline-dot" />
              <span className="timeline-label mt-3">Checkpoint 2</span>
              <RoundDetail data={ROUNDS[1]} isHoverMode={!fadeMode} align="right" />
            </div>

            {/* Tick 5: Final Judging & Round 3 */}
            <div className="relative z-10 flex flex-col items-center w-32 -mr-16">
              <div className="timeline-dot" />
              <span className="timeline-label mt-3 whitespace-nowrap">Final Judging</span>
              <RoundDetail data={ROUNDS[2]} isHoverMode={!fadeMode} align="right" />
            </div>
          </div>
        </div>

        {/* 1.5 TIMELINE RAIL (Mobile Vertical) */}
        <div className="mt-16 w-full md:hidden flex flex-col space-y-8 relative pl-6 max-w-sm mx-auto z-50">
           {/* Vertical line */}
           <div className="absolute top-2 bottom-2 left-[29px] w-px bg-line z-0" aria-hidden />
           
           <div className="relative z-10 flex flex-col items-start">
             <div className="flex items-center gap-4">
                <div className="timeline-dot" />
                <span className="timeline-label">Hr 0</span>
             </div>
           </div>
           
           <div className="relative z-10 flex flex-col items-start">
             <div className="flex items-center gap-4">
                <div className="timeline-dot" />
                <span className="timeline-label">Checkpoint 1</span>
             </div>
             <div className="pl-6 w-full">
               <RoundDetail data={ROUNDS[0]} isHoverMode={false} align="left" />
             </div>
           </div>
           
           <div className="relative z-10 flex flex-col items-start">
             <div className="flex items-center gap-4">
                <div className="timeline-dot timeline-dot--gold shadow-[0_0_15px_rgba(217,169,74,0.6)]" />
                <span className="timeline-label font-bold text-gold">Hr 3 Twist</span>
             </div>
           </div>
           
           <div className="relative z-10 flex flex-col items-start">
             <div className="flex items-center gap-4">
                <div className="timeline-dot" />
                <span className="timeline-label">Checkpoint 2</span>
             </div>
             <div className="pl-6 w-full">
               <RoundDetail data={ROUNDS[1]} isHoverMode={false} align="left" />
             </div>
           </div>
           
           <div className="relative z-10 flex flex-col items-start">
             <div className="flex items-center gap-4">
                <div className="timeline-dot" />
                <span className="timeline-label">Final Judging</span>
             </div>
             <div className="pl-6 w-full">
               <RoundDetail data={ROUNDS[2]} isHoverMode={false} align="left" />
             </div>
           </div>
        </div>

        {/* 2. THE 3-CARD BLOCK (Anchored visually under Hr 3) */}
        <div className="mt-12 md:-mt-2 grid md:grid-cols-[1fr_auto_1fr] gap-6 md:gap-10 items-center w-full max-w-5xl mx-auto relative z-10">
          
          {/* Twist severity — contained */}
          <div className="border border-gold/40 bg-surface2 p-6 md:p-8 shadow-[0_18px_50px_rgba(0,0,0,0.55)] max-w-sm justify-self-end w-full rounded">
            <svg width="24" height="24" viewBox="0 0 34 34" className="mb-4 opacity-70" aria-hidden>
              <rect x="8" y="4" width="18" height="26" rx="2" fill="none" stroke="#d9a94a" strokeWidth="1" transform="rotate(8 17 17)" />
            </svg>
            <p className="text-[10px] tracking-widest text-muted uppercase">Twist severity</p>
            <h3 className="font-display text-xl mt-1 text-paper">Contained</h3>
            <p className="mt-3 text-sm text-muted leading-relaxed">
              A light addition — like a sudden constraint on UI or an offline support requirement.
            </p>
          </div>

          {/* Deck */}
          <div className="deck-scene w-44 h-60 sm:w-52 sm:h-72 justify-self-center shrink-0" style={{ opacity: deckHidden ? 0 : 1, transition: "opacity 300ms ease" }}>
            <button
              type="button"
              onClick={onClick}
              onKeyDown={onKey}
              aria-label="Preview a draw from the example twist deck"
              className={`relative w-full h-full text-left outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-4 focus-visible:ring-offset-ink rounded ${fadeMode ? "" : "deck-scene"} ${!fadeMode && flipped ? "deck-flipped" : ""}`}
              style={{ perspective: fadeMode ? undefined : "inherit" }}
            >
              {fadeMode ? (
                <div className="relative w-full h-full">
                  <div className={card} style={{ opacity: flipped ? 0 : 1, transition: "opacity 400ms ease" }} aria-hidden={flipped}>
                    <DeckFront />
                  </div>
                  <div className={card} style={{ opacity: flipped ? 1 : 0, transition: "opacity 400ms ease 200ms" }} aria-hidden={!flipped}>
                    <DeckBack text={EXAMPLES[idx]} />
                  </div>
                </div>
              ) : (
                <div className="deck-inner relative w-full h-full rounded shadow-[0_15px_35px_rgba(0,0,0,0.5)]">
                  <div className={`deck-face ${card}`}>
                    <DeckFront />
                  </div>
                  <div className={`deck-face deck-back ${card}`}>
                    <DeckBack text={EXAMPLES[idx]} />
                  </div>
                </div>
              )}
            </button>
          </div>

          {/* Twist severity — structural */}
          <div className="border border-gold/40 bg-surface2 p-6 md:p-8 shadow-[0_18px_50px_rgba(0,0,0,0.55)] max-w-sm justify-self-start w-full rounded">
            <svg width="28" height="28" viewBox="0 0 42 42" className="mb-4" aria-hidden>
              <rect x="7" y="12" width="26" height="20" rx="2" fill="none" stroke="#d9a94a" strokeWidth="1.6" />
              <rect x="9" y="7" width="26" height="20" rx="2" fill="none" stroke="#d9a94a" strokeWidth="1.2" />
              <rect x="11" y="2" width="26" height="20" rx="2" fill="none" stroke="#d9a94a" strokeWidth="1" />
            </svg>
            <p className="text-[10px] tracking-widest text-muted uppercase">Twist severity</p>
            <h3 className="font-display text-2xl mt-1 text-paper">Structural</h3>
            <p className="mt-3 text-sm text-muted leading-relaxed">
              A heavy pivot — changing target users, underlying architecture, or core user flow.
            </p>
          </div>
        </div>
        
        <p className="mt-10 text-center text-xs text-muted mb-16">
          Preview a draw — click the deck. {CAPTION}
        </p>

      </div>
    </section>
  );
}

function DeckFront() {
  return (
    <>
      <div className="absolute inset-2 border border-gold/25 rounded" aria-hidden />
      <p className="font-display text-gold tracking-[0.3em] text-sm">TWIST DECK</p>
      <p className="mt-2 text-xs text-muted">Preview a draw</p>
    </>
  );
}

function DeckBack({ text }: { text: string }) {
  return (
    <>
      <p className="font-display text-sm sm:text-base text-paper leading-snug">{text}</p>
      <p className="mt-4 text-[10px] text-gold/80">{CAPTION}</p>
    </>
  );
}
