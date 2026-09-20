"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import "./forge-core.css";

import { rules } from "./rules.data";
import RuleGrid, { applyCardLanding, clamp01, type CardRect } from "./RuleGrid";
import CircuitTraces from "./CircuitTraces";
import RulePanel from "./RulePanel";
import { ForgeIconDefs } from "./RuleIcons";
import { EnergyTurbulenceDefs } from "./RuleCard";
import StaticCore from "./fallbacks/StaticCore";
import {
  forge,
  progressRef,
  useForgeStore,
  type Tier,
} from "./useForgeStore";

/** §11 — separate lazy chunk; never in the initial JS payload. */
const ForgeCoreScene = dynamic(() => import("./ForgeCoreScene"), {
  ssr: false,
  loading: () => null,
});

/* scroll budget: 260% scrub + 60% dwell (§5.1) */
const SCRUB_VH = 2.6;
const DWELL_VH = 0.6;
const SCRUB_SMOOTH = 0.6;

export interface RulebookSectionProps {
  /**
   * §2.6 — keep the repo's existing eyebrow/heading. Pass the repo's header
   * component here and it is rendered untouched; the defaults below are used
   * only if the current Rules section has no heading of its own.
   */
  renderHeader?: () => React.ReactNode;
  eyebrow?: string;
  heading?: string;
  /** gold token, read from CSS at runtime if omitted */
  goldHex?: string;
}

export default function RulebookSection({
  renderHeader,
  eyebrow = "Rulebook",
  // §2.6 — the repo's Rules section already has its own heading, so it wins
  // over the video's "The Rules".
  heading = "The Twelve Gates",
  goldHex,
}: RulebookSectionProps) {
  const rootRef = React.useRef<HTMLElement | null>(null);
  const stageRef = React.useRef<HTMLDivElement | null>(null);
  const cardRefs = React.useRef(new Map<number, HTMLButtonElement>());
  const closePanelRef = React.useRef<(() => void) | null>(null);
  const originRect = React.useRef<DOMRect | null>(null);
  const pendingOpen = React.useRef<number | null>(null);

  const [tier, setTier] = React.useState<Tier>("desktop");
  const [lowPower, setLowPower] = React.useState(false);
  const [reduced, setReduced] = React.useState(false);
  const [inView, setInView] = React.useState(false);
  const [rects, setRects] = React.useState<CardRect[]>([]);
  const [stage, setStage] = React.useState({ w: 0, h: 0 });
  const [gold, setGold] = React.useState(goldHex ?? "#d9a94a");

  const openId = useForgeStore((s) => s.open);
  const settled = useForgeStore((s) => s.settled);

  const openRule = openId ? rules.find((r) => r.id === openId) ?? null : null;
  const desktop = tier === "desktop" && !reduced && !lowPower;

  /* ---------------- capability + tier detection (§11) ---------------- */
  React.useEffect(() => {
    const nav = navigator as Navigator & {
      deviceMemory?: number;
      connection?: { saveData?: boolean };
    };
    const weak =
      (nav.hardwareConcurrency ?? 8) <= 4 ||
      (nav.deviceMemory ?? 8) <= 4 ||
      nav.connection?.saveData === true ||
      !probeWebGL2();

    const mqReduce = window.matchMedia("(prefers-reduced-motion: reduce)");

    const apply = () => {
      const w = window.innerWidth;
      const t: Tier = weak || w < 640 ? "mobile" : w < 1024 ? "tablet" : "desktop";
      setTier(t);
      forge.setTier(t);
      setLowPower(weak);
      setReduced(mqReduce.matches);
      forge.setReducedMotion(mqReduce.matches);
    };

    apply();
    window.addEventListener("resize", apply);
    mqReduce.addEventListener("change", apply);
    return () => {
      window.removeEventListener("resize", apply);
      mqReduce.removeEventListener("change", apply);
    };
  }, []);

  /* ---------------- read the repo's gold token (§3) ---------------- */
  React.useEffect(() => {
    if (goldHex || !rootRef.current) return;
    const v = getComputedStyle(rootRef.current)
      .getPropertyValue("--fc-gold")
      .trim();
    if (v) setGold(v);
  }, [goldHex]);

  /* ---------------- stage size ---------------- */
  React.useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const measure = () => {
      const r = el.getBoundingClientRect();
      setStage({ w: r.width, h: r.height });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [tier]);

  /* ---------------- in-view (lazy mount + pause loop, §7) ---------------- */
  React.useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => setInView(e.isIntersecting),
      { rootMargin: "300px 0px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  /* ---------------- scrubbed entrance timeline (§5.1) ----------------
   * Sticky pin + smoothed scroll progress. This mirrors the hero's
   * pin-and-scrub contract exactly: p is a pure number in [0,1] and every
   * S1–S5 visual reads it. If the audit prefers GSAP ScrollTrigger, this hook
   * is the single swap point — replace the body, keep progressRef.current.
   */
  React.useEffect(() => {
    if (tier !== "desktop") {
      progressRef.current = 1;
      applyCardLanding(cardRefs.current, 1);
      forge.setSettled(true);
      return;
    }
    if (reduced) {
      progressRef.current = 1;
      applyCardLanding(cardRefs.current, 1);
      forge.setSettled(true);
      return;
    }

    let raf = 0;
    let smoothed = 0;
    let alive = true;

    const read = () => {
      const el = rootRef.current;
      if (!el) return 0;
      const r = el.getBoundingClientRect();
      const range = window.innerHeight * SCRUB_VH;
      return clamp01(-r.top / range);
    };

    const loop = () => {
      if (!alive) return;
      const raw = read();
      smoothed += (raw - smoothed) * (1 - Math.pow(1 - 0.18, SCRUB_SMOOTH * 6));
      if (Math.abs(raw - smoothed) < 0.0008) smoothed = raw;
      progressRef.current = smoothed;
      applyCardLanding(cardRefs.current, smoothed);
      const el = rootRef.current;
      if (el) {
        el.style.setProperty(
          "--fc-chrome-opacity",
          String(0.06 + 0.94 * clamp01((smoothed * 3.75 - 2.9) / 0.7))
        );
      }
      const done = smoothed >= 0.999;
      if (done !== forge.get().settled) forge.setSettled(done);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    /* §5.1 — keyboard focus entering before p = 1 jumps the timeline */
    const onFocusIn = (e: FocusEvent) => {
      if (progressRef.current >= 0.999) return;
      if (!rootRef.current?.contains(e.target as Node)) return;
      const el = rootRef.current!;
      const target =
        window.scrollY + el.getBoundingClientRect().top + window.innerHeight * SCRUB_VH;
      window.scrollTo({ top: target, behavior: "auto" });
      smoothed = 1;
      progressRef.current = 1;
      applyCardLanding(cardRefs.current, 1);
      forge.setSettled(true);
    };
    document.addEventListener("focusin", onFocusIn);

    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      document.removeEventListener("focusin", onFocusIn);
    };
  }, [tier, reduced]);

  /* ---------------- panel orchestration (§8.4) ---------------- */
  const handleOpen = React.useCallback(
    (id: number, el: HTMLButtonElement) => {
      const current = forge.get().open;
      if (current === id) return;
      originRect.current = el.getBoundingClientRect();
      if (current !== null) {
        // close the current panel first, then open the new one
        pendingOpen.current = id;
        closePanelRef.current?.();
        return;
      }
      forge.setOpen(id);
    },
    []
  );

  const handleClosed = React.useCallback(() => {
    const returnTo = forge.get().open;
    forge.setOpen(null);
    const next = pendingOpen.current;
    pendingOpen.current = null;
    if (next != null) {
      const el = cardRefs.current.get(next);
      if (el) originRect.current = el.getBoundingClientRect();
      requestAnimationFrame(() => forge.setOpen(next));
    } else if (returnTo != null) {
      cardRefs.current.get(returnTo)?.focus({ preventScroll: true });
    }
  }, []);

  /* click outside closes (§8.4) */
  React.useEffect(() => {
    if (openId == null) return;
    const onDown = (e: PointerEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest(".fc-panel")) return;
      if (t.closest(".fc-card")) return; // handled by handleOpen
      closePanelRef.current?.();
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [openId]);

  const coreCenter = React.useMemo(
    () => ({ x: stage.w / 2, y: stage.h / 2 }),
    [stage.w, stage.h]
  );

  const header = renderHeader ? (
    renderHeader()
  ) : (
    <div className="fc-header">
      {/* §2.6 — the repo's existing eyebrow + heading markup, reused verbatim:
          same .wrap container, same .kicker, same trailing gold hairline, same
          font-display h2. Only .fc-ghostable is added, to let the entrance
          timeline ramp opacity 6% -> 100% (§5.2). Nothing is restyled. */}
      <div className="wrap">
        <p className="kicker mb-3 fc-ghostable" style={{ letterSpacing: "0.15em" }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: "8px" }}>
            {eyebrow}
            <span
              aria-hidden="true"
              style={{
                display: "inline-block",
                width: "32px",
                height: "1px",
                background: "var(--fc-gold)",
                opacity: 0.5,
              }}
            />
          </span>
        </p>
        <h2
          className="font-display text-3xl sm:text-5xl leading-tight fc-ghostable"
          style={{ color: "var(--fc-text)", margin: 0 }}
        >
          {heading}
        </h2>
      </div>
    </div>
  );

  return (
    <section
      id="rules"
      ref={rootRef}
      className="fc-root"
      data-tier={tier}
      data-inview={inView ? "true" : "false"}
      data-panel={openId != null ? "open" : "closed"}
      aria-labelledby={undefined}
      style={
        desktop
          ? { height: `calc(100vh + ${(SCRUB_VH + DWELL_VH) * 100}vh)` }
          : undefined
      }
    >
      <ForgeIconDefs />
      <EnergyTurbulenceDefs />

      <div
        ref={stageRef}
        className="fc-stage"
        style={desktop ? { position: "sticky", top: 0 } : undefined}
      >
        <div className="fc-stage-bg" />
        {header}

        {/* tablet / mobile / reduced-motion: static SVG core, zero WebGL */}
        {!desktop && (
          <div className="fc-static-wrap">
            <StaticCore size={tier === "mobile" ? 132 : 180} />
          </div>
        )}

        {desktop && (
          <CircuitTraces rects={rects} size={stage} core={coreCenter} />
        )}

        {desktop && inView && stage.w > 0 && (
          <ForgeCoreScene
            active={inView}
            rects={rects}
            stage={stage}
            goldHex={gold}
            bloom={!lowPower}
          />
        )}

        <RuleGrid
          tier={desktop ? "desktop" : tier}
          lowPower={lowPower}
          settled={desktop ? settled : true}
          onOpen={handleOpen}
          onMeasure={setRects}
          cardRefs={cardRefs}
        />

        {/* Affordance note — tells people the cards open a full rule dossier.
            aria-hidden because each card is already a <button> whose accessible
            name and full rule text are exposed directly (§8.1), so announcing
            this line again would only add noise for screen-reader users. */}
        <p className="fc-hint fc-ghostable" aria-hidden="true">
          Click a card to read the full rule
        </p>

        <div className="fc-panel-layer">
          {openRule && (
            <RulePanel
              key={openRule.id}
              rule={openRule}
              originRect={originRect.current}
              stageRect={stageRef.current?.getBoundingClientRect() ?? null}
              tier={desktop ? "desktop" : tier}
              reducedMotion={reduced}
              coreCenter={coreCenter}
              onClosed={handleClosed}
              closeRef={closePanelRef}
            />
          )}
        </div>
      </div>
    </section>
  );
}

function probeWebGL2() {
  try {
    const c = document.createElement("canvas");
    return !!c.getContext("webgl2");
  } catch {
    return false;
  }
}
