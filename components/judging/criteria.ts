/* ═══════════════════════════════════════════════════════════════════════════
   criteria.ts — single source of truth for the "How teams are judged" section.

   Every part of the simulation (3D card face, glyph particles, beams, dock,
   progress ring, description) reads from this file. Change copy or colour
   here and the whole scene follows.

   `icon` entries are SVG path "d" strings authored on a 0 0 24 24 grid and
   meant to be STROKED (round cap/join). The same strings are used three ways:
     · <path d={...}/> in the HTML dock
     · new Path2D(d) on the card's canvas texture
     · rasterised + sampled to build the particle glyph
   ═══════════════════════════════════════════════════════════════════════════ */

export type Criterion = {
  id: string;
  /** 1-based, shown as "02 / 06" */
  index: number;
  title: string;
  /** pre-broken so the card face and dock wrap identically */
  titleLines: string[];
  tagline: string;
  description: string;
  /** label under the progress ring */
  ringLabel: string;
  accent: string;
  accentHi: string;
  icon: string[];
};

export const CRITERIA: Criterion[] = [
  {
    id: "problem",
    index: 1,
    title: "Problem Understanding",
    titleLines: ["Problem", "Understanding"],
    tagline: "ANALYZE \u00b7 WEIGH",
    description:
      "How well the build addresses the track's base problem and its real-world relevance.",
    ringLabel: "Analyze and Weigh",
    accent: "#d9a94a",
    accentHi: "#e8cb92",
    icon: [
      "M18 11a7 7 0 1 1-14 0 7 7 0 0 1 14 0Z",
      "M21 21l-4.35-4.35",
      "M11 8v3l2 2",
    ],
  },
  {
    id: "technical",
    index: 2,
    title: "Technical Execution",
    titleLines: ["Technical", "Execution"],
    tagline: "BUILD \u00b7 SHIP",
    description:
      "Code quality, functionality, and how much of the build actually works end to end.",
    ringLabel: "Build and Ship",
    accent: "#3ECF8E",
    accentHi: "#8be2bb",
    icon: ["M16 18l6-6-6-6", "M8 6l-6 6 6 6", "M14 4l-4 16"],
  },
  {
    id: "adaptability",
    index: 3,
    title: "Adaptability",
    titleLines: ["Adaptability"],
    tagline: "PIVOT \u00b7 INTEGRATE",
    description:
      "How cleanly both twist cards were absorbed into the product, not bolted on.",
    ringLabel: "Pivot and Integrate",
    accent: "#7C9CF0",
    accentHi: "#b0c4f6",
    icon: ["M17 3a2.83 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"],
  },
  {
    id: "uiux",
    index: 4,
    title: "UI / UX",
    titleLines: ["UI / UX"],
    tagline: "CRAFT \u00b7 REFINE",
    description: "Usability and design quality of the final build.",
    ringLabel: "Craft and Refine",
    accent: "#A78BFA",
    accentHi: "#cab9fc",
    icon: [
      "M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z",
      "M3 9h18",
      "M9 21V9",
    ],
  },
  {
    id: "impact",
    index: 5,
    title: "Impact & Scalability",
    titleLines: ["Impact &", "Scalability"],
    tagline: "SCALE \u00b7 SUSTAIN",
    description: "Whether the idea could hold up beyond the hackathon table.",
    ringLabel: "Scale and Sustain",
    accent: "#F2765A",
    accentHi: "#f7ad9c",
    icon: ["M22 12h-4l-3 9L9 3l-3 9H2"],
  },
  {
    id: "presentation",
    index: 6,
    title: "Presentation",
    titleLines: ["Presentation"],
    tagline: "DEMO \u00b7 CONVINCE",
    description:
      "Clarity of the live demo and how well the team explains their own build.",
    ringLabel: "Demo and Convince",
    accent: "#5AD1E8",
    accentHi: "#9ce3f1",
    icon: [
      "M4 3h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z",
      "M8 21h8",
      "M12 17v4",
    ],
  },
];

export const TOTAL = CRITERIA.length;

/** Default focus when the section first scrolls into view. */
export const DEFAULT_INDEX = 1; // Technical Execution

/* ── small colour helpers (no dependency on three) ───────────────────────── */

export function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

export function rgba(hex: string, a: number) {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}
