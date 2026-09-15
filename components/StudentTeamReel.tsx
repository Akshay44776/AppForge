"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import StudentProfileCard from "./StudentProfileCard";

type Person = {
  name: string;
  role?: string;
  tel?: string;
  linkedin?: string;
  imgUrl?: string;
};

interface StudentTeamReelProps {
  students: Person[];
}

/* ═══════════════════════════════════════════════════════════════════════════
   CONSTANTS
   ═══════════════════════════════════════════════════════════════════════════ */
const FLOW_SPEED = 0.5;          // px per frame — constant leftward conveyor drift
const HOVER_GRACE_MS = 500;      // ms grace before flow resumes after pointer leaves
const KEYBOARD_GRACE_MS = 500;   // ms grace before flow resumes after keyboard blur
const TOUCH_GRACE_MS = 500;      // ms grace before flow resumes after touch-end
const CARD_WIDTH = 280;          // px — fixed card slot width (matches inline style)
const SETS = 3;                  // roster duplicated 3× for seamless infinite loop

/* ═══════════════════════════════════════════════════════════════════════════
   COMPONENT
   ═══════════════════════════════════════════════════════════════════════════ */
export default function StudentTeamReel({ students }: StudentTeamReelProps) {
  const N = students.length; // original roster size (e.g. 5)

  // Triplicate the roster: [set0][set1][set2] — set1 is the "home" zone,
  // set0 and set2 are seamless buffers for backward and forward overflow.
  const extendedStudents = React.useMemo(
    () => Array.from({ length: SETS }, () => students).flat(),
    [students]
  );

  const trackRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(-1);   // ORIGINAL index (0..N-1), -1 = flowing
  const [focusRatios, setFocusRatios] = useState<number[]>(() =>
    extendedStudents.map(() => 1)
  );

  /* ─────────────────────────────────────────────────────────────────────────
     SINGLE SOURCE OF TRUTH — pauseReasonsRef
     Flow runs IFF the Set is empty. evaluateFlow() is the sole gate.
     Reasons: 'hidden' | 'reducedMotion' | 'hover' | 'focus' | 'touch'
     ───────────────────────────────────────────────────────────────────────── */
  const pauseReasonsRef = useRef<Set<string>>(new Set(["hidden"]));
  // ↑ Starts with 'hidden' so drift waits for IntersectionObserver to confirm
  //   visibility. Removed on first visible callback → evaluateFlow() → flow starts.

  const rafRef = useRef(0);              // unified animation loop rAF
  const ratioRafRef = useRef(0);         // focus-ratio computation rAF
  const resumeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reducedMotionRef = useRef(false); // convenience mirror for scrollTo behavior
  const initializedRef = useRef(false);   // has initial scroll position been set?

  /* ─── Computed layout helpers ─── */
  const getOneSetWidth = useCallback(() => N * CARD_WIDTH, [N]);

  const getSpacerWidth = useCallback(() => {
    const track = trackRef.current;
    if (!track) return 0;
    return (track.clientWidth / 2) - 140;
  }, []);

  /* ═══════════════════════════════════════════════════════════════════════════
     (a) UNIFIED ANIMATION LOOP — constant leftward flow + seamless wrap

     Layout in the scroll track:
       [spacer][set0: cards 0…N-1][set1: cards N…2N-1][set2: cards 2N…3N-1][spacer]

     Home zone = set1 = scrollLeft ∈ [spacer + oneSetWidth, spacer + 2·oneSetWidth)

     WRAP CHECK runs every active frame (even when hover/touch/focus paused)
     so that manual interactions near boundaries are silently corrected.
     The wrap is a synchronous scrollLeft assignment between rAF frames —
     no visible jump because the duplicate content is pixel-identical.

     FLOW INCREMENT only executes when pauseReasonsRef is empty.
     Always adds to scrollLeft (leftward card movement). No direction
     variable — there is only one direction. Never reverses.
     ═══════════════════════════════════════════════════════════════════════════ */
  const animationLoop = useCallback(() => {
    const track = trackRef.current;
    if (!track) {
      rafRef.current = requestAnimationFrame(animationLoop);
      return;
    }

    const spacerW = getSpacerWidth();
    const oneSet = getOneSetWidth();

    // ── Seamless wrap check (runs every frame, paused or flowing) ──
    // Forward wrap: auto-flow carried us past set1 into set2 territory
    if (track.scrollLeft >= spacerW + 2 * oneSet) {
      track.scrollLeft -= oneSet;
    }
    // Backward wrap: manual swipe carried us before set1 into set0 territory
    if (track.scrollLeft <= spacerW) {
      track.scrollLeft += oneSet;
    }

    // ── Flow increment (only when fully unpaused) ──
    if (pauseReasonsRef.current.size === 0) {
      track.scrollLeft += FLOW_SPEED;
    }

    rafRef.current = requestAnimationFrame(animationLoop);
  }, [getSpacerWidth, getOneSetWidth]);

  /* ─────────────────────────────────────────────────────────────────────────
     evaluateFlow() — sole gate between loop running and fully stopped.

     The rAF loop runs whenever the section is VISIBLE (even if hover/focus/
     touch has paused the flow increment) so the wrap check stays active.
     Full rAF cancellation only happens when 'hidden' is in the Set (section
     off-screen → zero CPU).
     ───────────────────────────────────────────────────────────────────────── */
  const evaluateFlow = useCallback(() => {
    const isVisible = !pauseReasonsRef.current.has("hidden");

    if (isVisible && rafRef.current === 0) {
      // Start the loop — flow may still be paused by hover/touch/focus,
      // but the wrap check needs to run every frame regardless.
      rafRef.current = requestAnimationFrame(animationLoop);
    } else if (!isVisible && rafRef.current !== 0) {
      // Section off-screen — full stop, zero CPU.
      cancelAnimationFrame(rafRef.current);
      rafRef.current = 0;
    }

    // Clear the active-card highlight when flow is running freely
    if (pauseReasonsRef.current.size === 0) {
      setActiveIndex(-1);
    }
  }, [animationLoop]);

  /* ─── Shared timer helpers — clear-then-set on every path ─── */
  const clearResumeTimer = useCallback(() => {
    if (resumeTimerRef.current) {
      clearTimeout(resumeTimerRef.current);
      resumeTimerRef.current = null;
    }
  }, []);

  const scheduleResume = useCallback(
    (reason: string, delayMs: number) => {
      clearResumeTimer(); // prevent timer collisions across hover/touch/focus
      resumeTimerRef.current = setTimeout(() => {
        resumeTimerRef.current = null;
        pauseReasonsRef.current.delete(reason);
        evaluateFlow();
      }, delayMs);
    },
    [clearResumeTimer, evaluateFlow]
  );

  /* ─── Focus ratios — batched single-pass getBoundingClientRect() ─── */
  const updateFocusRatios = useCallback(() => {
    const track = trackRef.current;
    if (!track) return;

    const containerRect = track.getBoundingClientRect();
    const centerX = containerRect.width / 2;
    const children = track.querySelectorAll<HTMLElement>(".student-reel-card");
    const newRatios: number[] = [];
    let closestIdx = 0;
    let closestDist = Infinity;

    // Batch-read all rects in one pass (avoid layout thrashing)
    const rects: DOMRect[] = [];
    children.forEach((child) => rects.push(child.getBoundingClientRect()));

    rects.forEach((rect, i) => {
      const cardCenterX = rect.left - containerRect.left + rect.width / 2;
      const distance = cardCenterX - centerX;
      const maxDist = rect.width * 1.5;
      const signedRatio = Math.max(-1, Math.min(1, distance / maxDist));
      newRatios.push(signedRatio);

      if (Math.abs(distance) < closestDist) {
        closestDist = Math.abs(distance);
        closestIdx = i;
      }
    });

    setFocusRatios(newRatios);
    // Map extended index → original index for dot indicator sync
    if (pauseReasonsRef.current.size > 0) {
      setActiveIndex(closestIdx % N);
    }
  }, [N]);

  const handleScroll = useCallback(() => {
    cancelAnimationFrame(ratioRafRef.current);
    ratioRafRef.current = requestAnimationFrame(updateFocusRatios);
  }, [updateFocusRatios]);

  /* ─────────────────────────────────────────────────────────────────────────
     scrollToExtendedIndex — center a specific card by its EXTENDED index.
     Uses absolute scrollTo (not relative scrollBy) so each call is
     authoritative and auto-cancels any prior in-flight smooth-scroll.
     Under reduced-motion, snaps instantly (behavior: "auto").
     ───────────────────────────────────────────────────────────────────────── */
  const scrollToExtendedIndex = useCallback((extIdx: number) => {
    const track = trackRef.current;
    if (!track) return;
    const cards = track.querySelectorAll<HTMLElement>(".student-reel-card");
    if (!cards[extIdx]) return;

    const cardRect = cards[extIdx].getBoundingClientRect();
    const trackRect = track.getBoundingClientRect();
    const cardCenterInTrack = cardRect.left - trackRect.left + cardRect.width / 2;
    const trackCenter = trackRect.width / 2;
    const absoluteTarget = track.scrollLeft + (cardCenterInTrack - trackCenter);

    // (e) Reduced-motion branch: instant snap, no smooth animation
    const behavior = reducedMotionRef.current ? "auto" : "smooth";
    track.scrollTo({ left: absoluteTarget, behavior });
  }, []);

  /* ─────────────────────────────────────────────────────────────────────────
     (f) scrollToNearestCopy — for dot indicators & keyboard navigation.
     Finds the nearest visible DUPLICATE of the given original student
     (whichever of the 3 copies is closest to current scroll center)
     to avoid a massive full-loop scroll-back across all sets.
     ───────────────────────────────────────────────────────────────────────── */
  const scrollToNearestCopy = useCallback((originalIdx: number) => {
    const track = trackRef.current;
    if (!track) return;
    const cards = track.querySelectorAll<HTMLElement>(".student-reel-card");
    const trackRect = track.getBoundingClientRect();
    const trackCenter = trackRect.width / 2;

    let bestExtIdx = originalIdx;
    let bestDist = Infinity;

    // Check all 3 copies of this student
    for (let s = 0; s < SETS; s++) {
      const extIdx = s * N + originalIdx;
      if (!cards[extIdx]) continue;
      const cardRect = cards[extIdx].getBoundingClientRect();
      const cardCenterInTrack = cardRect.left - trackRect.left + cardRect.width / 2;
      const dist = Math.abs(cardCenterInTrack - trackCenter);
      if (dist < bestDist) {
        bestDist = dist;
        bestExtIdx = extIdx;
      }
    }

    scrollToExtendedIndex(bestExtIdx);
    setActiveIndex(originalIdx);
  }, [N, scrollToExtendedIndex]);

  /* ═══════════════════════════════════════════════════════════════════════════
     (b) HOVER PAUSE + CENTER HANDLERS
     onMouseEnter fires once per card — not on every pixel of movement.
     Each new hover call auto-cancels any prior in-flight smooth-scroll
     because scrollToExtendedIndex uses absolute scrollTo targets.
     ═══════════════════════════════════════════════════════════════════════════ */
  const handleCardMouseEnter = useCallback(
    (extIdx: number) => {
      clearResumeTimer();
      pauseReasonsRef.current.add("hover");
      evaluateFlow();
      scrollToExtendedIndex(extIdx);
      setActiveIndex(extIdx % N);
    },
    [N, clearResumeTimer, evaluateFlow, scrollToExtendedIndex]
  );

  const handleCardMouseLeave = useCallback(() => {
    // Grace timer: if no new card is hovered within HOVER_GRACE_MS,
    // resume flow. If a new card IS hovered, clearResumeTimer() in
    // handleCardMouseEnter cancels this — continuous handoff, no flicker.
    scheduleResume("hover", HOVER_GRACE_MS);
  }, [scheduleResume]);

  /* ─── Click fallback — same scrollToExtendedIndex path as hover ─── */
  const handleCardClick = useCallback(
    (extIdx: number) => {
      clearResumeTimer();
      pauseReasonsRef.current.add("hover");
      evaluateFlow();
      scrollToExtendedIndex(extIdx);
      setActiveIndex(extIdx % N);
    },
    [N, clearResumeTimer, evaluateFlow, scrollToExtendedIndex]
  );

  /* ═══════════════════════════════════════════════════════════════════════════
     (c) KEYBOARD FOCUS / BLUR HANDLERS
     ArrowLeft/ArrowRight navigate original indices with wrapping (circular).
     Uses scrollToNearestCopy so the reel picks the closest duplicate.
     ═══════════════════════════════════════════════════════════════════════════ */
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      e.preventDefault();

      clearResumeTimer();
      pauseReasonsRef.current.add("focus");
      evaluateFlow();

      let targetOriginal: number;
      if (e.key === "ArrowLeft") {
        targetOriginal = activeIndex <= 0 ? N - 1 : activeIndex - 1;
      } else {
        targetOriginal = activeIndex >= N - 1 ? 0 : activeIndex + 1;
      }

      scrollToNearestCopy(targetOriginal);
    },
    [N, activeIndex, clearResumeTimer, evaluateFlow, scrollToNearestCopy]
  );

  const handleTrackFocus = useCallback(() => {
    clearResumeTimer();
    pauseReasonsRef.current.add("focus");
    evaluateFlow();
  }, [clearResumeTimer, evaluateFlow]);

  const handleTrackBlur = useCallback(() => {
    scheduleResume("focus", KEYBOARD_GRACE_MS);
  }, [scheduleResume]);

  /* ═══════════════════════════════════════════════════════════════════════════
     (d) TOUCH HANDLERS — separate code path from hover
     Clear-then-set on resumeTimerRef via scheduleResume to prevent
     timer collisions with hover/focus paths.
     ═══════════════════════════════════════════════════════════════════════════ */
  const handleTouchStart = useCallback(() => {
    clearResumeTimer();
    pauseReasonsRef.current.add("touch");
    evaluateFlow();
  }, [clearResumeTimer, evaluateFlow]);

  const handleTouchEnd = useCallback(() => {
    scheduleResume("touch", TOUCH_GRACE_MS);
  }, [scheduleResume]);

  /* ═══════════════════════════════════════════════════════════════════════════
     SETUP EFFECT
     - (e) Reduced-motion listener
     - Initial scroll position → middle set (set1)
     - IntersectionObserver: 'hidden' pause reason toggle
     ═══════════════════════════════════════════════════════════════════════════ */
  useEffect(() => {
    // ── (e) Reduced motion ──
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    reducedMotionRef.current = mq.matches;
    if (mq.matches) pauseReasonsRef.current.add("reducedMotion");
    const handleMotionChange = (e: MediaQueryListEvent) => {
      reducedMotionRef.current = e.matches;
      if (e.matches) {
        pauseReasonsRef.current.add("reducedMotion");
      } else {
        pauseReasonsRef.current.delete("reducedMotion");
      }
      evaluateFlow();
    };
    mq.addEventListener("change", handleMotionChange);

    // ── Initial scroll position: start of set1 (middle copy) ──
    // This ensures the user starts in the "home zone" with full buffer
    // copies on both sides for seamless wrapping in either direction.
    const track = trackRef.current;
    if (track && !initializedRef.current) {
      const spacerWidth = (track.clientWidth / 2) - 140;
      const oneSetWidth = N * CARD_WIDTH;
      track.scrollLeft = spacerWidth + oneSetWidth;
      initializedRef.current = true;
    }

    // Initial focus-ratio computation
    updateFocusRatios();

    // ── IntersectionObserver: toggles 'hidden' pause reason ──
    // Removing 'hidden' on first visible callback triggers evaluateFlow()
    // which starts the rAF loop, which starts the leftward flow immediately
    // (no resume delay for this case — just go).
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          pauseReasonsRef.current.delete("hidden");
        } else {
          pauseReasonsRef.current.add("hidden");
          // Section left viewport — cancel any pending resume timer
          // so nothing fires while off-screen or after unmount.
          clearResumeTimer();
        }
        evaluateFlow();
      },
      { threshold: 0.1 }
    );
    if (track) observer.observe(track);

    // Kick evaluateFlow once to handle synchronous observer fires
    evaluateFlow();

    return () => {
      mq.removeEventListener("change", handleMotionChange);
      cancelAnimationFrame(ratioRafRef.current);
      cancelAnimationFrame(rafRef.current);
      rafRef.current = 0;
      if (resumeTimerRef.current) clearTimeout(resumeTimerRef.current);
      if (track) observer.unobserve(track);
    };
  }, [N, evaluateFlow, updateFocusRatios, clearResumeTimer]);

  /* ═══════════════════════════════════════════════════════════════════════════
     RENDER
     ═══════════════════════════════════════════════════════════════════════════ */
  return (
    <div className="relative">
      {/* Scrollable reel track */}
      <div
        ref={trackRef}
        className="flex items-center overflow-x-auto no-scrollbar"
        style={{
          perspective: "1200px",
          WebkitOverflowScrolling: "touch",
          paddingTop: "24px",
          paddingBottom: "80px", // space for the plugin line
        }}
        onScroll={handleScroll}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchEnd}
        onFocus={handleTrackFocus}
        onBlur={handleTrackBlur}
        tabIndex={0}
        role="region"
        aria-label="Student team, use arrow keys or swipe to browse"
        onKeyDown={handleKeyDown}
      >
        {/* Leading spacer — calc() recomputes on resize via CSS */}
        <div
          className="flex-shrink-0"
          style={{ width: "calc(50% - 140px)" }}
          aria-hidden="true"
        />

        {/* Tripled card set: [set0][set1][set2] for seamless infinite loop */}
        {extendedStudents.map((student, extIdx) => {
          const originalIdx = extIdx % N;
          return (
            <div
              key={`${student.name}-set${Math.floor(extIdx / N)}-${originalIdx}`}
              className="flex-shrink-0 px-3"
              style={{ width: `${CARD_WIDTH}px` }}
              onMouseEnter={() => handleCardMouseEnter(extIdx)}
              onMouseLeave={handleCardMouseLeave}
            >
                <StudentProfileCard
                  name={student.name}
                  role={student.role || ""}
                  tel={student.tel}
                  linkedin={student.linkedin}
                  imgUrl={student.imgUrl}
                  signedFocusRatio={focusRatios[extIdx] ?? 0}
                  positionLabel={`${originalIdx + 1} of ${N}`}
                  onClick={() => handleCardClick(extIdx)}
                />
            </div>
          );
        })}

        {/* Trailing spacer */}
        <div
          className="flex-shrink-0"
          style={{ width: "calc(50% - 140px)" }}
          aria-hidden="true"
        />
      </div>

      {/* Dot indicators — mapped to original N students only.
          Uses nearest-copy centering so clicking a dot scrolls to the
          closest duplicate, not always the first copy (avoids multi-set jump). */}
      <div className="flex justify-center gap-2 mt-4" role="tablist" aria-label="Student profiles">
        {students.map((student, originalIdx) => (
          <button
            key={student.name}
            type="button"
            role="tab"
            aria-selected={originalIdx === activeIndex}
            aria-label={`Go to ${student.name}`}
            onClick={() => {
              clearResumeTimer();
              pauseReasonsRef.current.add("hover");
              evaluateFlow();
              scrollToNearestCopy(originalIdx);
            }}
            onMouseEnter={() => {
              clearResumeTimer();
              pauseReasonsRef.current.add("hover");
              evaluateFlow();
              scrollToNearestCopy(originalIdx);
            }}
            onMouseLeave={handleCardMouseLeave}
            className="transition-all duration-300"
            style={{
              width: originalIdx === activeIndex ? "24px" : "8px",
              height: "8px",
              borderRadius: "4px",
              backgroundColor:
                originalIdx === activeIndex ? "var(--gold)" : "rgba(255,255,255,0.15)",
              border: "none",
              cursor: "pointer",
            }}
          />
        ))}
      </div>
    </div>
  );
}
