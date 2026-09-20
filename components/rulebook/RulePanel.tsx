"use client";

import * as React from "react";
import { pad2, type Rule } from "./rules.data";
import { core as coreApi, type Tier } from "./useForgeStore";

// §3 audit: the site's two real easing curves (Prizes / Rules gate cards /
// Twist Deck wall / Judging dock) — no generic defaults.
const EASE_OUT = "cubic-bezier(0.22, 1, 0.36, 1)"; // interactive snap/settle
const EASE_P3 = "cubic-bezier(0.2, 0.8, 0.2, 1)"; // reveal/entrance

interface Props {
  rule: Rule;
  /** the card that was clicked, for the shared-element flight and focus return */
  originRect: DOMRect | null;
  stageRect: DOMRect | null;
  tier: Tier;
  reducedMotion: boolean;
  /** stage-space centre of the core */
  coreCenter: { x: number; y: number };
  onClosed: () => void;
  /** set by the parent so it can ask the panel to play its close animation */
  closeRef: React.MutableRefObject<(() => void) | null>;
}

export default function RulePanel({
  rule,
  originRect,
  stageRect,
  tier,
  reducedMotion,
  coreCenter,
  onClosed,
  closeRef,
}: Props) {
  const panelRef = React.useRef<HTMLDivElement | null>(null);
  const flyerRef = React.useRef<HTMLDivElement | null>(null);
  const orbitRef = React.useRef<HTMLDivElement | null>(null);
  const scrollRef = React.useRef<HTMLDivElement | null>(null);
  const closing = React.useRef(false);
  const [scrollable, setScrollable] = React.useState(false);

  const sheet = false; // Always show in center of screen as requested
  const flight = !sheet && !reducedMotion && !!originRect && !!stageRect;

  /* ---------------- open ---------------- */
  React.useEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;

    if (!flight) {
      panel.animate(
        [
          { opacity: 0, transform: sheet ? "none" : "scale(.97)" },
          { opacity: 1, transform: "none" },
        ],
        { duration: reducedMotion ? 200 : 260, easing: EASE_OUT, fill: "both" }
      );
      focusInside();
      return;
    }

    const flyer = flyerRef.current!;
    const sr = stageRect!;
    const or = originRect!;
    const sx = or.left - sr.left + or.width / 2;
    const sy = or.top - sr.top + or.height / 2;
    const dx = coreCenter.x - sx;
    const dy = coreCenter.y - sy;
    // arc: bow the midpoint away from the straight line (§8.3.2 curved path)
    const bow = Math.sign(dx || 1) * -0.18;

    flyer.style.width = `${or.width}px`;
    flyer.style.height = `${or.height}px`;
    flyer.style.left = `${sx - or.width / 2}px`;
    flyer.style.top = `${sy - or.height / 2}px`;

    // 1. detach (0–0.3s) → 2. fly + turn edge-on (0.3–0.9s)
    const fly = flyer.animate(
      [
        { transform: "translate3d(0,0,0) rotateY(0deg) scale(1)", opacity: 1, offset: 0 },
        { transform: "translate3d(0,0,60px) rotateY(0deg) scale(1.15)", opacity: 1, offset: 0.214 },
        {
          transform: `translate3d(${dx * 0.5}px, ${dy * 0.5 + dy * bow}px, 90px) rotateY(60deg) scale(1.05)`,
          opacity: 1,
          offset: 0.5,
        },
        {
          transform: `translate3d(${dx}px, ${dy}px, 0) rotateY(90deg) scale(.9)`,
          opacity: 1,
          offset: 0.642,
        },
        {
          transform: `translate3d(${dx}px, ${dy}px, 0) rotateY(90deg) scale(.9)`,
          opacity: 0,
          offset: 0.66,
        },
      ],
      { duration: 1400, easing: EASE_P3, fill: "both" }
    );

    // 3. unfold (0.9–1.4s): continue past edge-on, resolve face-on at −8°
    const unfold = panel.animate(
      [
        { opacity: 0, transform: "rotateY(-90deg) scale(.9)", offset: 0 },
        { opacity: 0, transform: "rotateY(-90deg) scale(.9)", offset: 0.642 },
        { opacity: 1, transform: "rotateY(-22deg) scale(1.02)", offset: 0.85 },
        { opacity: 1, transform: "rotateY(-8deg) scale(1)", offset: 1 },
      ],
      { duration: 1400, easing: EASE_P3, fill: "both" }
    );

    // 4. orbit ring: one full turn in ~0.9s, then a faint permanent halo
    const orbit = orbitRef.current;
    orbit?.animate(
      [
        { opacity: 0, ["--fc-orbit" as string]: "0deg", offset: 0 },
        { opacity: 0, offset: 0.62 },
        { opacity: 1, offset: 0.72 },
        { opacity: 0.28, ["--fc-orbit" as string]: "360deg", offset: 1 },
      ],
      { duration: 1550, easing: "linear", fill: "both" }
    );

    const t = setTimeout(focusInside, 900);
    return () => {
      clearTimeout(t);
      fly.cancel();
      unfold.cancel();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function focusInside() {
    const el = panelRef.current?.querySelector<HTMLElement>(
      ".fc-panel-close"
    );
    el?.focus({ preventScroll: true });
  }

  React.useEffect(() => {
    const s = scrollRef.current;
    if (s) setScrollable(s.scrollHeight > s.clientHeight + 4);
  }, [rule.id]);

  /* ---------------- close ---------------- */
  const close = React.useCallback(() => {
    if (closing.current) return;
    closing.current = true;
    const panel = panelRef.current;
    if (!panel || reducedMotion || sheet) {
      panel?.animate([{ opacity: 1 }, { opacity: 0 }], {
        duration: 180,
        fill: "both",
      });
      setTimeout(onClosed, reducedMotion ? 160 : 200);
      return;
    }
    // §8.3 close: rotateY → 90°, shrink into the core, then absorb + shockwave
    panel.animate(
      [
        { opacity: 1, transform: "rotateY(-8deg) scale(1)" },
        { opacity: 1, transform: "rotateY(60deg) scale(.6)", offset: 0.66 },
        { opacity: 0, transform: "rotateY(90deg) scale(.14)" },
      ],
      { duration: 900, easing: EASE_P3, fill: "both" }
    );
    orbitRef.current?.animate([{ opacity: 0.28 }, { opacity: 0 }], {
      duration: 400,
      fill: "both",
    });
    setTimeout(() => {
      coreApi.absorb();
      coreApi.shockwave();
    }, 620);
    setTimeout(onClosed, 900);
  }, [onClosed, reducedMotion, sheet]);

  React.useEffect(() => {
    closeRef.current = close;
    return () => {
      closeRef.current = null;
    };
  }, [close, closeRef]);

  /* ---------------- esc + focus trap (§8.4) ---------------- */
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        close();
        return;
      }
      if (e.key !== "Tab") return;
      const root = panelRef.current;
      if (!root) return;
      const f = root.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (!f.length) return;
      const first = f[0];
      const last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      } else if (!root.contains(document.activeElement)) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [close]);

  const titleId = `fc-panel-title-${rule.id}`;

  const panel = (
    <div
      ref={panelRef}
      id="fc-rule-panel"
      className={sheet ? "fc-panel fc-sheet" : "fc-panel"}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      style={
        sheet
          ? undefined
          : {
              left: `${coreCenter.x}px`,
              top: `${coreCenter.y}px`,
              translate: "-50% -50%",
            }
      }
    >
      {!sheet && <div ref={orbitRef} className="fc-orbit" aria-hidden="true" />}
      <div className="fc-panel-head">
        <span className="fc-panel-badge" aria-hidden="true">
          {pad2(rule.id)}
        </span>
        <span className="fc-panel-title" id={titleId}>
          {rule.title}
        </span>
        <button
          type="button"
          className="fc-panel-close"
          onClick={close}
          aria-label={`Close rule ${pad2(rule.id)}`}
        >
          ×
        </button>
      </div>

      <div className="fc-panel-scroll" ref={scrollRef}>
        <p className="fc-body">{rule.body}</p>
      </div>

      {scrollable && (
        <span className="fc-panel-more" aria-hidden="true">
          ⌄
        </span>
      )}
    </div>
  );

  return (
    <>
      {flight && (
        <div ref={flyerRef} className="fc-flyer" aria-hidden="true">
          <span>{pad2(rule.id)}</span>
        </div>
      )}
      {sheet && (
        <div className="fc-sheet-backdrop" onClick={close} aria-hidden="true" />
      )}
      {panel}
    </>
  );
}
