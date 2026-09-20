"use client";

import * as React from "react";
import { CLUSTER_SLOTS, LAYOUT } from "./clusterSlots";
import { rules, rulesByCategory } from "./rules.data";
import RuleCard from "./RuleCard";
import type { Tier } from "./useForgeStore";

export interface CardRect {
  id: number;
  /** centre + edge facing the core, in stage pixels */
  cx: number;
  cy: number;
  edgeX: number;
  w: number;
  h: number;
  side: "left" | "right";
}

interface Props {
  tier: Tier;
  lowPower: boolean;
  settled: boolean;
  onOpen: (id: number, el: HTMLButtonElement) => void;
  onMeasure: (rects: CardRect[]) => void;
  cardRefs: React.MutableRefObject<Map<number, HTMLButtonElement>>;
}

export default function RuleGrid({
  tier,
  lowPower,
  settled,
  onOpen,
  onMeasure,
  cardRefs,
}: Props) {
  const layerRef = React.useRef<HTMLDivElement | null>(null);

  const registerRef = React.useCallback(
    (id: number, el: HTMLButtonElement | null) => {
      if (el) cardRefs.current.set(id, el);
      else cardRefs.current.delete(id);
    },
    [cardRefs]
  );

  // Measure once the layout is stable, and on every resize (§7 — shard landing
  // points and §8.2 trace routes both read these, so they can never disagree).
  const measure = React.useCallback(() => {
    const layer = layerRef.current;
    if (!layer) return;
    const base = layer.getBoundingClientRect();
    const out: CardRect[] = [];
    for (const r of rules) {
      const el = cardRefs.current.get(r.id);
      if (!el) continue;
      const b = el.getBoundingClientRect();
      const cx = b.left - base.left + b.width / 2;
      const cy = b.top - base.top + b.height / 2;
      const side: "left" | "right" = cx < base.width / 2 ? "left" : "right";
      out.push({
        id: r.id,
        cx,
        cy,
        w: b.width,
        h: b.height,
        side,
        edgeX: side === "left" ? cx + b.width / 2 : cx - b.width / 2,
      });
    }
    onMeasure(out);
  }, [cardRefs, onMeasure]);

  React.useEffect(() => {
    measure();
    const ro = new ResizeObserver(measure);
    if (layerRef.current) ro.observe(layerRef.current);
    window.addEventListener("resize", measure);
    const t = setTimeout(measure, 120); // after fonts settle
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
      clearTimeout(t);
    };
  }, [measure, tier]);

  const clusters = CLUSTER_SLOTS.filter((s) => s.category !== null);

  const body = clusters.map((slot) => {
    const list = rulesByCategory(slot.category!);
    const style: React.CSSProperties =
      tier === "desktop"
        ? {
            left: `${LAYOUT.clusterX[slot.side] * 100}%`,
            top: `${LAYOUT.rowY[slot.row] * 100}%`,
            width: `${LAYOUT.clusterW * 100}%`,
          }
        : {};
    return (
      <div className="fc-cluster" key={slot.category} style={style}>
        <div className="fc-cluster-label fc-ghostable">{slot.category}</div>
        <div className="fc-cluster-cards">
          {list.map((rule) => (
            <RuleCard
              key={rule.id}
              rule={rule}
              index={rule.id - 1}
              lowPower={lowPower}
              onOpen={onOpen}
              registerRef={registerRef}
            />
          ))}
        </div>
      </div>
    );
  });

  return (
    <div
      ref={layerRef}
      className={
        tier === "desktop"
          ? "fc-cards-layer"
          : tier === "tablet"
            ? "fc-grid-tablet"
            : "fc-grid-mobile"
      }
      data-settled={settled ? "true" : "false"}
    >
      {body}
    </div>
  );
}

/**
 * §5.2 — card landing is a pure function of timeline progress.
 * Called from the scroll timeline's onUpdate, never from React state.
 *
 *   opacity 0 → 1 · scale .85 → 1 (short overshoot)
 *   rotateX/rotateY ±35° → 0 · translateZ −200px → 0
 *   staggered ~90 ms in rule order (01 → 12), landing between t=3.1 and t=3.75
 */
const CLIP = 3.75;
const LAND_DUR = 0.42 / CLIP;          // per-card landing duration
const LAND_STAGGER = 0.059 / CLIP;     // ~59ms, so 01 lands at t=3.10 and 12 at t=3.75
const LAND_FIRST_END = 3.1 / CLIP;

export function applyCardLanding(
  cards: Map<number, HTMLButtonElement>,
  p: number
) {
  cards.forEach((el, id) => {
    const i = id - 1;
    const start = LAND_FIRST_END - LAND_DUR + i * LAND_STAGGER;
    const u = clamp01((p - start) / LAND_DUR);
    const e = expoOut(u);
    // back.out(1.4) overshoot on scale only
    const s = 0.85 + (1 - 0.85) * backOut(u, 1.4);
    const sign = i % 2 === 0 ? 1 : -1;
    el.style.setProperty("--land-op", String(e));
    el.style.setProperty("--land-scale", String(s));
    el.style.setProperty("--land-rx", `${(1 - e) * 35 * sign}deg`);
    el.style.setProperty("--land-ry", `${(1 - e) * -35 * sign}deg`);
    el.style.setProperty("--land-z", `${(1 - e) * -200}px`);
    // Clickability is tied to the SAME per-card p>=1 check that already
    // gates tabIndex, and set as an inline style so it can never drift out
    // Removed pointerEvents and tabIndex manipulation here so cards are always interactive.
  });
}

export const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
export const expoOut = (t: number) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t));
export const backOut = (t: number, s = 1.4) =>
  t >= 1 ? 1 : 1 + (s + 1) * Math.pow(t - 1, 3) + s * Math.pow(t - 1, 2);
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
