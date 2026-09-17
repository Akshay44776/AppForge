"use client";

import { useEffect, useRef, useState } from "react";

/* ═══════════════════════════════════════════════════════════════════════════
   PhoneMockupLoop — 5-state looping micro-animation inside a phone outline.

   Each state cross-fades (opacity + slight scale), holding ~2s each.
   All content is abstract (bars/blocks) — no readable text.

   States:
     0 — Code lines (amber keyword bars + dim bars)
     1 — App icon grid (2×2 rounded rects + progress bar)
     2 — Checklist (4 rows with staggered checkmark ticks)
     3 — Analytics bars (3-4 vertical bars rising in + progress bar)
     4 — Morphing center icon (shape pulse)

   Props:
     phaseOffset — ms delay before starting the loop (stagger cards)

   Accessibility / Performance:
     - prefers-reduced-motion: freeze on state 0 (code lines), no cycling
     - Cleanup: all intervals/timeouts cleared on unmount
     - Fixed-height container: no layout shift during cross-fades
   ═══════════════════════════════════════════════════════════════════════════ */

const STATE_COUNT = 5;
const HOLD_MS = 2000;
const FADE_MS = 400;

const GOLD = "var(--gold)";
const GOLD_BRIGHT = "var(--gold-bright)";
const DIM = "rgba(130,138,151,0.25)";
const DIM_BRIGHT = "rgba(130,138,151,0.4)";

export default function PhoneMockupLoop({
  phaseOffset = 0,
}: {
  phaseOffset?: number;
}) {
  const [activeState, setActiveState] = useState(0);
  const [visible, setVisible] = useState(true);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();
  const reducedMotionRef = useRef(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    const mql = window.matchMedia("(prefers-reduced-motion: reduce)");
    reducedMotionRef.current = mql.matches;

    if (reducedMotionRef.current) return;

    // Initial stagger delay
    timerRef.current = setTimeout(() => {
      if (!mountedRef.current) return;
      const cycle = () => {
        if (!mountedRef.current) return;
        // Fade out
        setVisible(false);
        timerRef.current = setTimeout(() => {
          if (!mountedRef.current) return;
          setActiveState((prev) => (prev + 1) % STATE_COUNT);
          // Fade in
          setVisible(true);
          // Hold, then repeat
          timerRef.current = setTimeout(cycle, HOLD_MS);
        }, FADE_MS);
      };
      timerRef.current = setTimeout(cycle, HOLD_MS);
    }, phaseOffset);

    const onMotionChange = (e: MediaQueryListEvent) => {
      reducedMotionRef.current = e.matches;
      if (e.matches && timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
    mql.addEventListener("change", onMotionChange);

    return () => {
      mountedRef.current = false;
      if (timerRef.current) clearTimeout(timerRef.current);
      mql.removeEventListener("change", onMotionChange);
    };
  }, [phaseOffset]);

  return (
    <div
      className="relative mx-auto"
      style={{
        width: "120px",
        height: "210px",
        /* Fixed height — no layout shift during cross-fades */
      }}
      aria-hidden="true"
    >
      {/* Phone outline */}
      <div
        className="absolute inset-0 rounded-[14px]"
        style={{
          border: "1.5px solid var(--gold)",
          opacity: 0.35,
        }}
      />

      {/* Phone notch/top bar */}
      <div
        className="absolute top-[8px] left-1/2 -translate-x-1/2 rounded-full"
        style={{
          width: "30px",
          height: "4px",
          background: "var(--gold)",
          opacity: 0.2,
        }}
      />

      {/* Screen content area */}
      <div
        className="absolute flex items-center justify-center"
        style={{
          top: "20px",
          left: "8px",
          right: "8px",
          bottom: "12px",
          transition: `opacity ${FADE_MS}ms ease, transform ${FADE_MS}ms ease`,
          opacity: visible ? 1 : 0,
          transform: visible ? "scale(1)" : "scale(0.95)",
        }}
      >
        {activeState === 0 && <CodeLinesState />}
        {activeState === 1 && <AppIconGridState />}
        {activeState === 2 && <ChecklistState />}
        {activeState === 3 && <AnalyticsBarsState />}
        {activeState === 4 && <MorphingIconState />}
      </div>
    </div>
  );
}

/* ─── State 0: Code Lines ─────────────────────────────────────────── */
function CodeLinesState() {
  const lines = [
    { w: "55%", color: GOLD, opacity: 0.6 },
    { w: "80%", color: DIM, opacity: 1 },
    { w: "45%", color: GOLD, opacity: 0.45 },
    { w: "70%", color: DIM, opacity: 1 },
    { w: "35%", color: GOLD, opacity: 0.55 },
    { w: "60%", color: DIM_BRIGHT, opacity: 0.8 },
  ];

  return (
    <div className="w-full flex flex-col gap-[6px] px-1">
      {lines.map((l, i) => (
        <div
          key={i}
          className="rounded-[2px]"
          style={{
            width: l.w,
            height: "4px",
            background: l.color,
            opacity: l.opacity,
          }}
        />
      ))}
    </div>
  );
}

/* ─── State 1: App Icon Grid ───────────────────────────────────────── */
function AppIconGridState() {
  return (
    <div className="w-full flex flex-col items-center gap-3 px-1">
      <div className="grid grid-cols-2 gap-[8px]">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="rounded-[6px]"
            style={{
              width: "36px",
              height: "36px",
              background:
                i === 0
                  ? `linear-gradient(135deg, var(--gold), var(--gold-bright))`
                  : DIM,
              opacity: i === 0 ? 0.5 : 0.3,
            }}
          />
        ))}
      </div>
      {/* Progress bar */}
      <div
        className="rounded-full overflow-hidden"
        style={{ width: "70%", height: "3px", background: DIM }}
      >
        <div
          className="h-full rounded-full"
          style={{
            width: "45%",
            background: GOLD,
            opacity: 0.6,
            animation: "mockup-progress 2s ease-in-out infinite alternate",
          }}
        />
      </div>
    </div>
  );
}

/* ─── State 2: Checklist with staggered checkmarks ──────────────── */
function ChecklistState() {
  const [ticked, setTicked] = useState(0);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    let count = 0;
    const tick = () => {
      if (!mountedRef.current) return;
      count++;
      setTicked(count);
      if (count < 4) {
        timerRef.current = setTimeout(tick, 280);
      }
    };
    timerRef.current = setTimeout(tick, 400);
    return () => {
      mountedRef.current = false;
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const rows = [
    { w: "65%" },
    { w: "75%" },
    { w: "55%" },
    { w: "70%" },
  ];

  return (
    <div className="w-full flex flex-col gap-[8px] px-1">
      {rows.map((r, i) => (
        <div key={i} className="flex items-center gap-[6px]">
          {/* Checkmark box */}
          <div
            className="flex-shrink-0 flex items-center justify-center rounded-[3px]"
            style={{
              width: "14px",
              height: "14px",
              border: `1.5px solid ${ticked > i ? "var(--gold)" : "rgba(130,138,151,0.3)"}`,
              transition: "border-color 0.2s ease",
            }}
          >
            {ticked > i && (
              <svg width="8" height="8" viewBox="0 0 10 10" fill="none">
                <path
                  d="M2 5.5L4 7.5L8 3"
                  stroke="var(--gold-bright)"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{
                    animation: "mockup-check-in 0.25s ease forwards",
                  }}
                />
              </svg>
            )}
          </div>
          {/* Text bar */}
          <div
            className="rounded-[2px]"
            style={{
              width: r.w,
              height: "4px",
              background: ticked > i ? "var(--gold)" : DIM,
              opacity: ticked > i ? 0.5 : 0.8,
              transition: "background 0.3s ease, opacity 0.3s ease",
            }}
          />
        </div>
      ))}
    </div>
  );
}

/* ─── State 3: Analytics Bars ─────────────────────────────────────── */
function AnalyticsBarsState() {
  const bars = [
    { h: "45%", delay: 0 },
    { h: "70%", delay: 150 },
    { h: "35%", delay: 300 },
    { h: "85%", delay: 450 },
  ];

  return (
    <div className="w-full flex flex-col items-center gap-3 px-2">
      <div
        className="flex items-end justify-center gap-[10px]"
        style={{ height: "80px" }}
      >
        {bars.map((b, i) => (
          <div
            key={i}
            className="rounded-t-[3px]"
            style={{
              width: "16px",
              height: b.h,
              background:
                i === 1 || i === 3
                  ? `linear-gradient(to top, var(--gold), var(--gold-bright))`
                  : DIM_BRIGHT,
              opacity: i === 1 || i === 3 ? 0.55 : 0.35,
              animation: `mockup-bar-rise 0.6s ease ${b.delay}ms both`,
            }}
          />
        ))}
      </div>
      {/* Progress bar */}
      <div
        className="rounded-full overflow-hidden"
        style={{ width: "80%", height: "3px", background: DIM }}
      >
        <div
          className="h-full rounded-full"
          style={{
            width: "60%",
            background: GOLD,
            opacity: 0.5,
          }}
        />
      </div>
    </div>
  );
}

/* ─── State 4: Morphing Center Icon ───────────────────────────────── */
function MorphingIconState() {
  return (
    <div className="flex items-center justify-center">
      <div
        style={{
          width: "40px",
          height: "40px",
          border: "2px solid var(--gold)",
          opacity: 0.5,
          animation: "mockup-morph 3s ease-in-out infinite",
        }}
      />
    </div>
  );
}
