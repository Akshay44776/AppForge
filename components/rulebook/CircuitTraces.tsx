"use client";

import * as React from "react";
import type { CardRect } from "./RuleGrid";
import { useForgeStore } from "./useForgeStore";

export interface Pt {
  x: number;
  y: number;
}

/**
 * §8.2 — one pure function, reused for all 12 routes.
 * PCB style: leave the core through a short shared bus, run orthogonally,
 * 45° chamfered corners, end at the card edge facing the core.
 * `laneIndex` offsets the vertical run so same-side lines never overlap.
 */
export function routeTrace(from: Pt, to: Pt, laneIndex: number): string {
  const dir = to.x >= from.x ? 1 : -1;
  const bus = 26 + (laneIndex % 3) * 7; // short shared bus out of the core
  const fx = from.x + dir * bus;
  const fy = from.y + (laneIndex - 2.5) * 5;

  // vertical run sits in its own lane, short of the card
  const mx = to.x - dir * (34 + laneIndex * 16);
  const dy = to.y - fy;
  const sy = dy >= 0 ? 1 : -1;
  const c = Math.min(14, Math.abs(dy) / 2, Math.abs(mx - fx) / 2);

  if (!isFinite(c) || c < 2 || Math.abs(dy) < 4) {
    return `M ${from.x} ${from.y} L ${fx} ${fy} L ${to.x} ${fy}`;
  }

  return [
    `M ${from.x} ${from.y}`,
    `L ${fx} ${fy}`,
    `L ${mx - dir * c} ${fy}`,
    `L ${mx} ${fy + sy * c}`,
    `L ${mx} ${to.y - sy * c}`,
    `L ${mx + dir * c} ${to.y}`,
    `L ${to.x} ${to.y}`,
  ].join(" ");
}

interface Props {
  rects: CardRect[];
  size: { w: number; h: number };
  core: Pt;
}

export default function CircuitTraces({ rects, size, core }: Props) {
  const energised = useForgeStore((s) => s.energised);
  const hovered = useForgeStore((s) => s.hovered);
  const open = useForgeStore((s) => s.open);
  const hot = open ?? hovered;

  const routes = React.useMemo(() => {
    const laneBySide = { left: 0, right: 0 } as Record<"left" | "right", number>;
    // lane order: farthest card gets the outermost lane, so lines nest cleanly
    const ordered = [...rects].sort(
      (a, b) => Math.abs(b.cy - core.y) - Math.abs(a.cy - core.y)
    );
    const map = new Map<number, { d: string; node: Pt }>();
    for (const r of ordered) {
      const lane = laneBySide[r.side]++;
      const node = { x: r.edgeX, y: r.cy };
      map.set(r.id, { d: routeTrace(core, node, lane), node });
    }
    return rects.map((r) => ({ id: r.id, ...map.get(r.id)! }));
  }, [rects, core]);

  if (!size.w || !size.h || !rects.length) return null;

  return (
    <svg
      className="fc-traces fc-traces-layer"
      viewBox={`0 0 ${size.w} ${size.h}`}
      width={size.w}
      height={size.h}
      data-energised={energised ? "true" : "false"}
      aria-hidden="true"
      focusable="false"
    >
      {routes.map((r) => (
        <path
          key={r.id}
          className="fc-trace"
          data-hot={r.id === hot ? "true" : "false"}
          d={r.d}
        />
      ))}
      {routes.map((r) => (
        <circle
          key={`n${r.id}`}
          className="fc-trace-node"
          data-hot={r.id === hot ? "true" : "false"}
          cx={r.node.x}
          cy={r.node.y}
          r={2.6}
        />
      ))}
    </svg>
  );
}
