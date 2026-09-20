"use client";

import * as React from "react";

/**
 * §11 — zero WebGL contexts below 1024px (and on low-end / Save-Data / reduced
 * motion). Pure SVG, one gradient, no animation beyond an optional CSS glow
 * that the tablet tier's IntersectionObserver turns on.
 */
export default function StaticCore({
  size = 180,
  unsealed = true,
}: {
  size?: number;
  unsealed?: boolean;
}) {
  const uid = React.useId().replace(/:/g, "");
  const gold = `url(#fcCore${uid})`;
  const stroke = unsealed ? "var(--fc-gold-bright, #e4b554)" : "#9fb3c4";

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 200 200"
      role="img"
      aria-label="Forge Core"
      style={{
        filter: unsealed
          ? "drop-shadow(0 0 26px rgba(215,170,76,.35))"
          : "drop-shadow(0 0 18px rgba(159,179,196,.25))",
      }}
    >
      <defs>
        <linearGradient id={`fcCore${uid}`} x1="0" y1="0" x2="0.3" y2="1">
          <stop offset="0%" stopColor={unsealed ? "#f0cf87" : "#c3d3de"} />
          <stop offset="55%" stopColor={unsealed ? "#c79a3f" : "#8ea2b2"} />
          <stop offset="100%" stopColor={unsealed ? "#2a1f0c" : "#2b3440"} />
        </linearGradient>
      </defs>

      {/* icosahedron, front hull */}
      <g fill={gold} fillOpacity="0.9" stroke={stroke} strokeWidth="1.4" strokeLinejoin="round">
        <polygon points="100,18 158,52 136,104" />
        <polygon points="100,18 136,104 64,104" />
        <polygon points="100,18 64,104 42,52" />
        <polygon points="158,52 166,120 136,104" />
        <polygon points="42,52 64,104 34,120" />
        <polygon points="136,104 166,120 124,160" />
        <polygon points="64,104 124,160 76,160" />
        <polygon points="34,120 76,160 64,104" />
        <polygon points="124,160 100,182 76,160" />
      </g>

      {/* inner geodesic hint */}
      <g
        fill="none"
        stroke={stroke}
        strokeOpacity="0.35"
        strokeWidth="1"
      >
        <polygon points="100,60 128,104 72,104" />
        <line x1="100" y1="18" x2="100" y2="60" />
        <line x1="166" y1="120" x2="128" y2="104" />
        <line x1="34" y1="120" x2="72" y2="104" />
      </g>
    </svg>
  );
}
