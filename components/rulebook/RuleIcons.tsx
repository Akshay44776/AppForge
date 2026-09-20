"use client";

import * as React from "react";

/**
 * §8.5 — flat gold inline SVG, one component per rule. No raster, no AI art.
 * A single subtle top→bottom gradient, dimmer than the big number, is shared
 * from <ForgeIconDefs/>, which RulebookSection mounts once. The gradient
 * stops read the repo's real --gold token (see forge-core.css §3 audit).
 */

const G = "url(#fcIconGold)";
const RED = "#c0392b"; // §8.5 card 11 — the only non-gold accent

export function ForgeIconDefs() {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      width="0"
      height="0"
      style={{ position: "absolute", width: 0, height: 0 }}
    >
      <defs>
        <linearGradient id="fcIconGold" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--fc-gold-icon-top)" />
          <stop offset="100%" stopColor="var(--fc-gold-icon-bot)" />
        </linearGradient>
      </defs>
    </svg>
  );
}

type P = React.SVGProps<SVGSVGElement>;

const Svg = ({ children, ...p }: P & { children: React.ReactNode }) => (
  <svg
    viewBox="0 0 48 48"
    width="100%"
    height="100%"
    fill={G}
    aria-hidden="true"
    focusable="false"
    {...p}
  >
    {children}
  </svg>
);

/** 01 — ID badge with lanyard clip, photo silhouette, text lines, check badge */
export const Icon01 = (p: P) => (
  <Svg {...p}>
    <path d="M21 3h6v4h-6z" />
    <path d="M22.5 7h3l2 4h-7z" />
    <path d="M9 11h30a2 2 0 0 1 2 2v28a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2V13a2 2 0 0 1 2-2Zm0 3v26h30V14H9Z" />
    <circle cx="18" cy="23" r="4.2" />
    <path d="M11.6 34c.7-3.4 3.3-5.3 6.4-5.3s5.7 1.9 6.4 5.3H11.6Z" />
    <path d="M28 21h9v2.6h-9zM28 26h9v2.6h-9zM28 31h6v2.6h-6z" />
    <path d="M36.5 32.5a6.5 6.5 0 1 1 0 13 6.5 6.5 0 0 1 0-13Zm-.9 9.6 4.6-4.6-1.7-1.7-2.9 2.9-1.5-1.5-1.7 1.7 3.2 3.2Z" />
  </Svg>
);

/** 02 — three people silhouettes with a small "2–4" above them */
export const Icon02 = (p: P) => (
  <Svg {...p}>
    <text
      x="24"
      y="11"
      textAnchor="middle"
      fontSize="10"
      fontWeight="700"
      fill={G}
      style={{ fontFamily: "inherit", letterSpacing: "0.02em" }}
    >
      2–4
    </text>
    <circle cx="24" cy="22" r="5.4" />
    <path d="M14.4 39c.8-5.3 4.7-8.4 9.6-8.4s8.8 3.1 9.6 8.4H14.4Z" />
    <circle cx="11" cy="25.5" r="4.1" />
    <path d="M3.4 39c.6-4 3.3-6.4 7.1-6.4 1 0 1.9.2 2.7.5-1.8 1.5-3.1 3.5-3.7 5.9H3.4Z" />
    <circle cx="37" cy="25.5" r="4.1" />
    <path d="M44.6 39h-6.1c-.6-2.4-1.9-4.4-3.7-5.9.8-.3 1.7-.5 2.7-.5 3.8 0 6.5 2.4 7.1 6.4Z" />
  </Svg>
);

/** 03 — two coin stacks beside a QR code */
export const Icon03 = (p: P) => (
  <Svg {...p}>
    <ellipse cx="10" cy="14" rx="7" ry="2.8" />
    <path d="M3 17v3.4c0 1.5 3.1 2.8 7 2.8s7-1.3 7-2.8V17c0 1.6-3.1 2.8-7 2.8S3 18.6 3 17Z" />
    <path d="M3 23.4v3.4c0 1.5 3.1 2.8 7 2.8s7-1.3 7-2.8v-3.4c0 1.6-3.1 2.8-7 2.8s-7-1.2-7-2.8Z" />
    <path d="M3 29.8v3.4C3 34.7 6.1 36 10 36s7-1.3 7-2.8v-3.4c0 1.6-3.1 2.8-7 2.8s-7-1.2-7-2.8Z" />
    <path d="M23 10h9v9h-9v-9Zm2.4 2.4v4.2h4.2v-4.2h-4.2Z" />
    <path d="M36 10h9v9h-9v-9Zm2.4 2.4v4.2h4.2v-4.2h-4.2Z" />
    <path d="M23 23h9v9h-9v-9Zm2.4 2.4v4.2h4.2v-4.2h-4.2Z" />
    <path d="M36 23h3v3h-3zM42 23h3v3h-3zM39 26h3v3h-3zM36 29h3v3h-3zM42 29h3v3h-3zM36 35h3v3h-3zM39 35h6v3h-6zM23 35h9v3h-9z" />
  </Svg>
);

/** 04 — left stack of 3 rows branching to right-hand boxes */
export const Icon04 = (p: P) => (
  <Svg {...p}>
    <path d="M4 9h13v5H4zM4 21h13v5H4zM4 33h13v5H4z" />
    <path d="M17 11h5v2h-5zM17 23h5v2h-5zM17 35h5v2h-5z" />
    <path d="M21 12h2v24h-2z" />
    <path d="M23 15h5v2h-5zM23 23h5v2h-5zM23 31h5v2h-5z" />
    <path d="M28 11h16v10H28zm2.4 2.4v5.2h11.2v-5.2H30.4Z" />
    <path d="M28 27h16v10H28zm2.4 2.4v5.2h11.2v-5.2H30.4Z" />
  </Svg>
);

/** 05 — three-step staircase with a right-pointing arrow beneath */
export const Icon05 = (p: P) => (
  <Svg {...p}>
    <path d="M7 30h9v4H7zM18 23h9v11h-9zM29 16h9v18h-9z" />
    <path d="M7 24h7v2.6H7zM18 17h7v2.6h-7zM29 10h7v2.6h-7z" />
    <path d="M7 39h28v3H7z" />
    <path d="m34 34.5 8 6-8 6v-12z" />
  </Svg>
);

/** 06 — circular "twist" arrow: U-turn arrow with a broken ring */
export const Icon06 = (p: P) => (
  <Svg {...p}>
    <path d="M24 6a18 18 0 0 1 17 12.2l-3.4 1.2A14.4 14.4 0 0 0 24 9.6V6Z" />
    <path d="M42 24a18 18 0 0 1-9 15.6l-1.8-3.1A14.4 14.4 0 0 0 38.4 24H42Z" />
    <path d="M24 42a18 18 0 0 1-15.6-9l3.1-1.8A14.4 14.4 0 0 0 24 38.4V42Z" />
    <path d="M6 24c0-4.3 1.5-8.3 4-11.4l2.8 2.2A14.3 14.3 0 0 0 9.6 24H6Z" />
    <path d="M17.5 17.5h3.6v9.6a4.2 4.2 0 0 0 8.4 0v-6h3.6v6a7.8 7.8 0 0 1-15.6 0v-9.6Z" />
    <path d="m19.3 12 5.2 6.4h-10.4L19.3 12Z" />
    <path d="m31.3 36.4-5.2-6.4h10.4l-5.2 6.4Z" />
  </Svg>
);

/** 07 — hammer, wrench and screwdriver standing side by side */
export const Icon07 = (p: P) => (
  <Svg {...p}>
    {/* hammer */}
    <path d="M5 7h13v6H5z" />
    <path d="M18 8.4h4.2v3.2H18z" />
    <path d="M10 13h3.2v28H10z" />
    {/* wrench */}
    <path d="M27.4 6.6a7.2 7.2 0 0 0-2 9.7L23 18.7l3 3 2.4-2.4a7.2 7.2 0 0 0 9.7-2l-5-1.3-1.4-5.1-5.3-1.3 1-2.9Z" />
    <path d="M23.9 21.6 27 24.7 24.6 41h-3.2l2.5-19.4Z" />
    {/* screwdriver */}
    <path d="M38 6h5v9h-5z" />
    <path d="M38.6 15h3.8v4h-3.8z" />
    <path d="M39.3 19h2.4v22h-2.4z" />
  </Svg>
);

/** 08 — microchip with radiating pins */
export const Icon08 = (p: P) => (
  <Svg {...p}>
    <path d="M14 14h20v20H14V14Zm2.8 2.8v14.4h14.4V16.8H16.8Z" />
    <path d="M20 20h8v8h-8z" />
    <path d="M18 5h2.6v8H18zM22.7 5h2.6v8h-2.6zM27.4 5h2.6v8h-2.6z" />
    <path d="M18 35h2.6v8H18zM22.7 35h2.6v8h-2.6zM27.4 35h2.6v8h-2.6z" />
    <path d="M5 18h8v2.6H5zM5 22.7h8v2.6H5zM5 27.4h8v2.6H5z" />
    <path d="M35 18h8v2.6h-8zM35 22.7h8v2.6h-8zM35 27.4h8v2.6h-8z" />
  </Svg>
);

/** 09 — handshake */
export const Icon09 = (p: P) => (
  <Svg {...p}>
    <path d="M3 17h8.5v13H3z" />
    <path d="M36.5 17H45v13h-8.5z" />
    <path d="M12 17.8 17.6 14c1-.7 2.3-.9 3.5-.5l6 2 5.6-1.6 3.4 3.4v11.5l-3.2 1.9-5.6-4.2-4.6 1.1c-1.6.4-3.2-.2-4-1.6l-.3-.6 6.9-2.5-.9-2.4-7.1 2.6c-1.3.5-2.7-.1-3.3-1.3L12 17.8Z" />
    <path d="m27.4 30.6 5.3 4a2.3 2.3 0 0 1-3.2 3.2l-4.6-3.6 2.5-3.6Z" />
    <path d="m22.6 32.2 4 3.1a2.3 2.3 0 0 1-3.1 3.3l-3.6-2.9 2.7-3.5Z" />
  </Svg>
);

/** 10 — dashboard panel: pie chart, bar chart, small percentage lines */
export const Icon10 = (p: P) => (
  <Svg {...p}>
    <path d="M4 7h40v34H4V7Zm2.8 2.8v28.4h34.4V9.8H6.8Z" />
    <path d="M17 14v9h9a9 9 0 0 0-9-9Z" />
    <path d="M15 16.2a9 9 0 1 0 9.8 12.3l-9.8-3.9V16.2Z" />
    <path d="M30 32h2.8v5H30zM34.4 28h2.8v9h-2.8zM38.8 23h2.8v14h-2.8z" />
    <path d="M30 14h12v2.2H30zM30 18h9v2.2h-9zM30 22h6v2.2h-6z" />
    <path d="M8 32h16v2.2H8z" />
  </Svg>
);

/** 11 — flag on a pole, flag in muted signal red */
export const Icon11 = (p: P) => (
  <Svg {...p}>
    <path d="M11 4h3.4v40H11z" />
    <path d="M7 41h11.4v3H7z" />
    <path fill={RED} d="M14.4 7h24l-4.6 8 4.6 8h-24V7Z" />
  </Svg>
);

/** 12 — gavel with sound block */
export const Icon12 = (p: P) => (
  <Svg {...p}>
    <g transform="rotate(-38 24 22)">
      <path d="M13 12h22v10H13z" />
      <path d="M22 22h4v20h-4z" />
      <path d="M9 14h4v6H9zM35 14h4v6h-4z" />
    </g>
    <path d="M6 40h30v5H6z" />
    <path d="M9 36h24v3.4H9z" />
  </Svg>
);

export const RULE_ICONS: Record<number, (p: P) => React.JSX.Element> = {
  1: Icon01,
  2: Icon02,
  3: Icon03,
  4: Icon04,
  5: Icon05,
  6: Icon06,
  7: Icon07,
  8: Icon08,
  9: Icon09,
  10: Icon10,
  11: Icon11,
  12: Icon12,
};

export function RuleIcon({ id, ...p }: Omit<P, "id"> & { id: number }) {
  const C = RULE_ICONS[id];
  return C ? <C {...p} /> : null;
}
