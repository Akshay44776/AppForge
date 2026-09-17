/* ═══════════════════════════════════════════════════════════════════════════
   classifiedScene.ts — single source of truth for the ClassifiedBlueprintBg
   3D scene. All tunable values live here.

   Mirrors the same pattern as genesisScene.ts but for the new "vault" scene:
   floating wireframe panels, a padlock, scanline sweep, gold dust particles,
   all on pitch-black ink with warm gold-only palette.
   ═══════════════════════════════════════════════════════════════════════════ */

/* ─────────────────────────────────────────────────────────────
   1. COLOUR TOKENS — exact site tokens, no other hues.
   ───────────────────────────────────────────────────────────── */
export const TOKENS = {
  ink: "#07090d",
  surface: "#10141b",
  gold: "#d9a94a",
  goldBright: "#f4c862",
  paper: "#ece8de",
  muted: "#828a97",
} as const;

/* ─────────────────────────────────────────────────────────────
   2. PHASE TIMINGS (seconds) — Draw → Hold → Glitch → Fade
   Each wireframe panel runs its own independent lifecycle on
   staggered timers, but they all share these base durations.
   ───────────────────────────────────────────────────────────── */
export const PHASES = {
  draw: 4.2,
  hold: 2.4,
  glitch: 0.5,
  fade: 1.4,
} as const;

export type PanelPhase = "draw" | "hold" | "glitch" | "fade";

export const CYCLE_DURATION =
  PHASES.draw + PHASES.hold + PHASES.glitch + PHASES.fade;

/* ─────────────────────────────────────────────────────────────
   3. WIREFRAME PANEL DEFINITIONS
   Each archetype defines line segments in normalised [0,1]
   space relative to a phone outline (aspect 9:19.5).
   ───────────────────────────────────────────────────────────── */
export interface WireLine {
  x1: number; y1: number; x2: number; y2: number;
}

export interface WireArchetype {
  id: string;
  lines: WireLine[];
}

export const WIRE_ARCHETYPES: WireArchetype[] = [
  {
    // Layout A: Navigation + cards + CTA button
    id: "utility",
    lines: [
      // Nav bar
      { x1: 0, y1: 0.08, x2: 1, y2: 0.08 },
      { x1: 0.1, y1: 0.04, x2: 0.4, y2: 0.04 },
      { x1: 0.75, y1: 0.035, x2: 0.9, y2: 0.055 },
      // Card 1
      { x1: 0.08, y1: 0.12, x2: 0.92, y2: 0.12 },
      { x1: 0.08, y1: 0.12, x2: 0.08, y2: 0.34 },
      { x1: 0.92, y1: 0.12, x2: 0.92, y2: 0.34 },
      { x1: 0.08, y1: 0.34, x2: 0.92, y2: 0.34 },
      { x1: 0.15, y1: 0.18, x2: 0.55, y2: 0.18 },
      { x1: 0.15, y1: 0.23, x2: 0.7, y2: 0.23 },
      { x1: 0.15, y1: 0.28, x2: 0.45, y2: 0.28 },
      // Card 2
      { x1: 0.08, y1: 0.40, x2: 0.92, y2: 0.40 },
      { x1: 0.08, y1: 0.40, x2: 0.08, y2: 0.60 },
      { x1: 0.92, y1: 0.40, x2: 0.92, y2: 0.60 },
      { x1: 0.08, y1: 0.60, x2: 0.92, y2: 0.60 },
      { x1: 0.15, y1: 0.46, x2: 0.6, y2: 0.46 },
      { x1: 0.15, y1: 0.51, x2: 0.75, y2: 0.51 },
      // CTA Button
      { x1: 0.25, y1: 0.68, x2: 0.75, y2: 0.68 },
      { x1: 0.25, y1: 0.68, x2: 0.25, y2: 0.74 },
      { x1: 0.75, y1: 0.68, x2: 0.75, y2: 0.74 },
      { x1: 0.25, y1: 0.74, x2: 0.75, y2: 0.74 },
      { x1: 0.38, y1: 0.71, x2: 0.62, y2: 0.71 },
      // Tab bar
      { x1: 0, y1: 0.88, x2: 1, y2: 0.88 },
      { x1: 0.15, y1: 0.93, x2: 0.25, y2: 0.93 },
      { x1: 0.4, y1: 0.93, x2: 0.6, y2: 0.93 },
      { x1: 0.75, y1: 0.93, x2: 0.85, y2: 0.93 },
    ],
  },
  {
    // Layout B: Search bar + list rows with avatars
    id: "list",
    lines: [
      // Search bar
      { x1: 0.08, y1: 0.05, x2: 0.92, y2: 0.05 },
      { x1: 0.08, y1: 0.05, x2: 0.08, y2: 0.10 },
      { x1: 0.92, y1: 0.05, x2: 0.92, y2: 0.10 },
      { x1: 0.08, y1: 0.10, x2: 0.92, y2: 0.10 },
      { x1: 0.15, y1: 0.075, x2: 0.5, y2: 0.075 },
      // Filter pill
      { x1: 0.08, y1: 0.135, x2: 0.30, y2: 0.135 },
      { x1: 0.34, y1: 0.135, x2: 0.52, y2: 0.135 },
      // 5 list rows
      ...Array.from({ length: 5 }, (_, i) => {
        const y = 0.19 + i * 0.125;
        return [
          // avatar box
          { x1: 0.08, y1: y, x2: 0.17, y2: y },
          { x1: 0.08, y1: y, x2: 0.08, y2: y + 0.07 },
          { x1: 0.17, y1: y, x2: 0.17, y2: y + 0.07 },
          { x1: 0.08, y1: y + 0.07, x2: 0.17, y2: y + 0.07 },
          // text lines
          { x1: 0.22, y1: y + 0.02, x2: 0.55, y2: y + 0.02 },
          { x1: 0.22, y1: y + 0.055, x2: 0.72, y2: y + 0.055 },
          // divider
          { x1: 0.05, y1: y + 0.10, x2: 0.95, y2: y + 0.10 },
        ];
      }).flat(),
      // Tab bar
      { x1: 0, y1: 0.88, x2: 1, y2: 0.88 },
      { x1: 0.15, y1: 0.93, x2: 0.25, y2: 0.93 },
      { x1: 0.4, y1: 0.93, x2: 0.6, y2: 0.93 },
      { x1: 0.75, y1: 0.93, x2: 0.85, y2: 0.93 },
    ],
  },
  {
    // Layout C: Analytics dashboard with stat cards + sparkline chart
    id: "dashboard",
    lines: [
      // Nav bar
      { x1: 0, y1: 0.07, x2: 1, y2: 0.07 },
      { x1: 0.08, y1: 0.035, x2: 0.38, y2: 0.035 },
      // Stat cards (3 small)
      { x1: 0.06, y1: 0.10, x2: 0.32, y2: 0.10 },
      { x1: 0.06, y1: 0.10, x2: 0.06, y2: 0.20 },
      { x1: 0.32, y1: 0.10, x2: 0.32, y2: 0.20 },
      { x1: 0.06, y1: 0.20, x2: 0.32, y2: 0.20 },
      { x1: 0.10, y1: 0.135, x2: 0.22, y2: 0.135 },
      { x1: 0.10, y1: 0.17, x2: 0.28, y2: 0.17 },

      { x1: 0.37, y1: 0.10, x2: 0.63, y2: 0.10 },
      { x1: 0.37, y1: 0.10, x2: 0.37, y2: 0.20 },
      { x1: 0.63, y1: 0.10, x2: 0.63, y2: 0.20 },
      { x1: 0.37, y1: 0.20, x2: 0.63, y2: 0.20 },
      { x1: 0.41, y1: 0.135, x2: 0.53, y2: 0.135 },
      { x1: 0.41, y1: 0.17, x2: 0.59, y2: 0.17 },

      { x1: 0.68, y1: 0.10, x2: 0.94, y2: 0.10 },
      { x1: 0.68, y1: 0.10, x2: 0.68, y2: 0.20 },
      { x1: 0.94, y1: 0.10, x2: 0.94, y2: 0.20 },
      { x1: 0.68, y1: 0.20, x2: 0.94, y2: 0.20 },
      { x1: 0.72, y1: 0.135, x2: 0.84, y2: 0.135 },
      { x1: 0.72, y1: 0.17, x2: 0.90, y2: 0.17 },

      // Main chart area
      { x1: 0.06, y1: 0.25, x2: 0.94, y2: 0.25 },
      { x1: 0.06, y1: 0.25, x2: 0.06, y2: 0.55 },
      { x1: 0.94, y1: 0.25, x2: 0.94, y2: 0.55 },
      { x1: 0.06, y1: 0.55, x2: 0.94, y2: 0.55 },
      // Sparkline chart path
      { x1: 0.10, y1: 0.48, x2: 0.22, y2: 0.42 },
      { x1: 0.22, y1: 0.42, x2: 0.35, y2: 0.46 },
      { x1: 0.35, y1: 0.46, x2: 0.48, y2: 0.34 },
      { x1: 0.48, y1: 0.34, x2: 0.60, y2: 0.38 },
      { x1: 0.60, y1: 0.38, x2: 0.72, y2: 0.30 },
      { x1: 0.72, y1: 0.30, x2: 0.88, y2: 0.32 },
      // Grid lines
      { x1: 0.06, y1: 0.35, x2: 0.94, y2: 0.35 },
      { x1: 0.06, y1: 0.45, x2: 0.94, y2: 0.45 },
      // Bottom list rows
      { x1: 0.06, y1: 0.60, x2: 0.94, y2: 0.60 },
      { x1: 0.10, y1: 0.63, x2: 0.50, y2: 0.63 },
      { x1: 0.10, y1: 0.67, x2: 0.38, y2: 0.67 },
      { x1: 0.06, y1: 0.72, x2: 0.94, y2: 0.72 },
      { x1: 0.10, y1: 0.75, x2: 0.46, y2: 0.75 },
      { x1: 0.10, y1: 0.79, x2: 0.40, y2: 0.79 },
      { x1: 0.06, y1: 0.84, x2: 0.94, y2: 0.84 },
    ],
  },
];

/* ─────────────────────────────────────────────────────────────
   4. PANEL PLACEMENT — where each of 3-5 panels sits in world
   space. z controls depth (closer = sharper, farther = hazy).
   ───────────────────────────────────────────────────────────── */
export interface PanelPlacement {
  position: [number, number, number];
  rotation: [number, number, number];
  scale: number;
  /** stagger offset in seconds so panels never sync */
  phaseOffset: number;
  archetypeIdx: number;
}

export const PANEL_PLACEMENTS: PanelPlacement[] = [
  {
    position: [2.2, 0.5, -4],
    rotation: [0.04, -0.22, 0.02],
    scale: 0.85,
    phaseOffset: 0,
    archetypeIdx: 0,
  },
  {
    position: [-2.6, -0.6, -7],
    rotation: [-0.03, 0.18, -0.04],
    scale: 0.7,
    phaseOffset: 3.2,
    archetypeIdx: 1,
  },
  {
    position: [0.6, 1.6, -10],
    rotation: [0.06, -0.12, 0.06],
    scale: 0.6,
    phaseOffset: 5.8,
    archetypeIdx: 2,
  },
  {
    position: [-1.4, -1.8, -13],
    rotation: [-0.02, 0.28, -0.03],
    scale: 0.5,
    phaseOffset: 2.1,
    archetypeIdx: 0,
  },
  {
    position: [3.2, -1.0, -16],
    rotation: [0.03, -0.15, 0.05],
    scale: 0.45,
    phaseOffset: 7.4,
    archetypeIdx: 1,
  },
];

/* ─────────────────────────────────────────────────────────────
   5. PHONE DIMENSIONS (world units, 9:19.5 ratio)
   ───────────────────────────────────────────────────────────── */
export const PHONE = {
  width: 0.9,
  height: 1.95,
  depth: 0.02,
  radius: 0.08,
} as const;

/* ─────────────────────────────────────────────────────────────
   6. CAMERA
   ───────────────────────────────────────────────────────────── */
export const CAMERA = {
  fov: 50,
  position: [0, 0, 4.5] as [number, number, number],
  lookAt: [0, 0, 0] as [number, number, number],
  /** Very gentle orbit radius per axis */
  orbitAmplitude: [0.15, 0.08, 0.06],
  /** Period of orbit in seconds */
  orbitPeriod: [35, 28, 42],
  /** Mouse parallax multiplier */
  mouseParallax: 0.12,
} as const;

/* ─────────────────────────────────────────────────────────────
   7. PARTICLES
   ───────────────────────────────────────────────────────────── */
export const DUST = {
  countHigh: 180,
  countMid: 100,
  countLow: 50,
  /** spread of the particle volume */
  spread: [8, 5, 14] as [number, number, number],
  /** upward drift speed */
  speed: 0.04,
  /** point size */
  size: 2.5,
} as const;

/* ─────────────────────────────────────────────────────────────
   8. SCANLINE
   ───────────────────────────────────────────────────────────── */
export const SCANLINE = {
  /** period of the vertical sweep in seconds */
  period: 4.0,
  /** height of the beam in world units */
  thickness: 0.04,
  /** vertical range of travel */
  range: 4.0,
  /** glow intensity added to intersected wireframes */
  illumination: 1.5,
} as const;

/* ─────────────────────────────────────────────────────────────
   9. POST-PROCESSING
   ───────────────────────────────────────────────────────────── */
export const POST = {
  bloomThreshold: 0.72,
  bloomSmoothing: 0.22,
  bloomIntensity: 0.65,
  noiseOpacity: 0.032,
  vignetteDarkness: 0.78,
  vignetteOffset: 0.32,
  canvasOpacity: 0.55,
} as const;

/* ─────────────────────────────────────────────────────────────
   10. PADLOCK GEOMETRY
   ───────────────────────────────────────────────────────────── */
export const PADLOCK = {
  position: [-0.6, -0.15, -1.5] as [number, number, number],
  rotation: [0.05, 0.3, 0.02] as [number, number, number],
  scale: 0.35,
  /** body rect */
  bodyWidth: 1.0,
  bodyHeight: 0.7,
  bodyDepth: 0.35,
  /** shackle (rounded U-shape) */
  shackleRadius: 0.32,
  shackleThickness: 0.09,
} as const;

/* ─────────────────────────────────────────────────────────────
   11. EASING
   ───────────────────────────────────────────────────────────── */
export const ease = {
  outCubic: (x: number) => 1 - Math.pow(1 - x, 3),
  inCubic: (x: number) => x * x * x,
  inOutCubic: (x: number) =>
    x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2,
  outExpo: (x: number) => (x >= 1 ? 1 : 1 - Math.pow(2, -10 * x)),
} as const;

export const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);

/* ─────────────────────────────────────────────────────────────
   12. PANEL PHASE RESOLVER
   Given an absolute time + this panel's offset, resolve its
   current phase and normalised 0..1 progress within it.
   ───────────────────────────────────────────────────────────── */
export function resolvePanelPhase(
  time: number,
  offset: number
): { phase: PanelPhase; t: number; cycle: number } {
  const local = ((time - offset) % CYCLE_DURATION + CYCLE_DURATION) % CYCLE_DURATION;
  const cycle = Math.floor(((time - offset) % (CYCLE_DURATION * 1000) + CYCLE_DURATION * 1000) / CYCLE_DURATION);

  if (local < PHASES.draw) {
    return { phase: "draw", t: local / PHASES.draw, cycle };
  }
  const afterDraw = local - PHASES.draw;
  if (afterDraw < PHASES.hold) {
    return { phase: "hold", t: afterDraw / PHASES.hold, cycle };
  }
  const afterHold = afterDraw - PHASES.hold;
  if (afterHold < PHASES.glitch) {
    return { phase: "glitch", t: afterHold / PHASES.glitch, cycle };
  }
  const afterGlitch = afterHold - PHASES.glitch;
  return { phase: "fade", t: afterGlitch / PHASES.fade, cycle };
}
