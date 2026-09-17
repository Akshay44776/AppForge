/* ═══════════════════════════════════════════════════════════════════════════
   genesisScene.ts — single source of truth for the GenesisBackground 3D scene.

   Everything tunable lives here: colour tokens (mirrored from app/globals.css),
   phase timings, camera framing, particle budgets, the rotating prompt
   fragments, and the three UI archetypes expressed as pure data.

   Nothing in here imports three/R3F — it is plain data so it can be read from
   both the client scene and (if ever needed) the server.
   ═══════════════════════════════════════════════════════════════════════════ */

/* ─────────────────────────────────────────────────────────────
   1. COLOUR TOKENS — do not invent new colours.
   Mirrors :root in app/globals.css exactly.
   ───────────────────────────────────────────────────────────── */
export const TOKENS = {
  ink: "#07090d",
  surface: "#10141b",
  surface2: "#171c24",
  /* --line is rgba(236,232,222,0.10); the hex below is the base colour and
     the alpha is applied separately in the shaders via uLineAlpha. */
  line: "#ece8de",
  lineAlpha: 0.1,
  gold: "#d9a94a",
  goldBright: "#f4c862",
  paper: "#ece8de",
  muted: "#828a97",
} as const;

/* ─────────────────────────────────────────────────────────────
   2. PHASE TIMINGS (seconds)
   The scene is a pure function of elapsed time within one cycle,
   so the whole loop is deterministic and seek-able.
   ───────────────────────────────────────────────────────────── */
export const PHASES = {
  idlePrompt: 4.2, // typewriter runs, screen dormant
  submitting: 0.55, // caret pulse + gold flash
  assembling: 3.4, // wireframe → solid build-out + data rain
  holding: 2.2, // finished mock breathes
  dissolving: 1.9, // fracture back into particles
} as const;

export type ScenePhase =
  | "idle-prompt"
  | "submitting"
  | "assembling"
  | "holding"
  | "dissolving";

export const PHASE_ORDER: ScenePhase[] = [
  "idle-prompt",
  "submitting",
  "assembling",
  "holding",
  "dissolving",
];

export const CYCLE_DURATION =
  PHASES.idlePrompt +
  PHASES.submitting +
  PHASES.assembling +
  PHASES.holding +
  PHASES.dissolving;

/** Cumulative start time of each phase within one cycle. */
export const PHASE_STARTS: Record<ScenePhase, number> = (() => {
  let t = 0;
  const out = {} as Record<ScenePhase, number>;
  for (const p of PHASE_ORDER) {
    out[p] = t;
    t += PHASES[camel(p)];
  }
  return out;
})();

function camel(p: ScenePhase): keyof typeof PHASES {
  switch (p) {
    case "idle-prompt":
      return "idlePrompt";
    case "submitting":
      return "submitting";
    case "assembling":
      return "assembling";
    case "holding":
      return "holding";
    default:
      return "dissolving";
  }
}

/**
 * Resolve absolute scene time into { phase, t (0..1 within phase), cycle }.
 * Called once per frame from GenesisBackground and passed down via context —
 * every child derives its animation from this, so nothing can drift.
 */
export function resolvePhase(time: number): {
  phase: ScenePhase;
  t: number;
  cycle: number;
} {
  const cycle = Math.floor(time / CYCLE_DURATION);
  const local = time - cycle * CYCLE_DURATION;
  let acc = 0;
  for (const p of PHASE_ORDER) {
    const d = PHASES[camel(p)];
    if (local < acc + d) {
      return { phase: p, t: (local - acc) / d, cycle };
    }
    acc += d;
  }
  return { phase: "dissolving", t: 1, cycle };
}

/* ─────────────────────────────────────────────────────────────
   3. EASING — every transform in the scene is driven through one
   of these, never a raw Math.sin. (Sine is used only as a tiny
   additive breathing term on top of an eased base.)
   ───────────────────────────────────────────────────────────── */
export const ease = {
  outCubic: (x: number) => 1 - Math.pow(1 - x, 3),
  inCubic: (x: number) => x * x * x,
  inOutCubic: (x: number) =>
    x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2,
  outQuint: (x: number) => 1 - Math.pow(1 - x, 5),
  outExpo: (x: number) => (x >= 1 ? 1 : 1 - Math.pow(2, -10 * x)),
  /** Slight overshoot — used for the nav bar scale-Y entrance. */
  outBack: (x: number) => {
    const c1 = 1.7,
      c3 = c1 + 1;
    return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
  },
};

/** clamp + remap helper used all over the scene */
export const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
export const remap = (x: number, a: number, b: number) =>
  clamp01((x - a) / Math.max(b - a, 1e-6));

/* ─────────────────────────────────────────────────────────────
   4. PROMPT FRAGMENTS
   Ambient flavour text ONLY. These are deliberately generic and
   must never contain (or hint at) AppForge's real sealed problem
   statements.
   ───────────────────────────────────────────────────────────── */
export const PROMPT_FRAGMENTS = [
  "build a queue system for\u2014",
  "an app that helps commuters\u2014",
  "track shared expenses in\u2014",
  "a dashboard for small clinics\u2014",
  "let neighbours swap tools\u2014",
  "a feed for campus notices\u2014",
] as const;

/* ─────────────────────────────────────────────────────────────
   5. PHONE / SCREEN GEOMETRY (world units)
   ───────────────────────────────────────────────────────────── */
export const PHONE = {
  width: 1.0,
  height: 2.04,
  depth: 0.105,
  radius: 0.115,
  /** screen inset from the chassis edge */
  bezel: 0.045,
  /** how far the screen plane floats in front of the chassis face */
  screenZ: 0.056,
} as const;

export const SCREEN = {
  width: PHONE.width - PHONE.bezel * 2,
  height: PHONE.height - PHONE.bezel * 2,
} as const;

/* ─────────────────────────────────────────────────────────────
   6. UI ARCHETYPES — data, not components.
   Coordinates are NORMALISED to the screen plane:
     x: 0 = screen left,  1 = screen right
     y: 0 = screen top,   1 = screen bottom
   UIAssembly/index.tsx maps these into local screen space.
   ───────────────────────────────────────────────────────────── */
export type PieceKind = "nav" | "card" | "row" | "chart" | "pill" | "fab";

export interface PieceDef {
  kind: PieceKind;
  /** normalised rect on the screen plane */
  x: number;
  y: number;
  w: number;
  h: number;
  /** entrance delay in seconds, measured from the start of `assembling` */
  delay: number;
  /** optional: renders as a large panel drifting OFF the screen plane */
  float?: { x: number; y: number; z: number; rot: number };
  /** rows/cards use this to tint an inner accent bar gold */
  accent?: boolean;
}

export interface Archetype {
  id: string;
  label: string;
  pieces: PieceDef[];
}

/* stagger helper: 80–120ms apart as specified */
const stagger = (i: number, base = 0, step = 0.1) => base + i * step;

export const ARCHETYPES: Archetype[] = [
  /* ── 1. Utility / list app ───────────────────────────────── */
  {
    id: "utility",
    label: "utility-list",
    pieces: [
      { kind: "nav", x: 0.0, y: 0.0, w: 1.0, h: 0.075, delay: 0 },
      { kind: "card", x: 0.07, y: 0.105, w: 0.86, h: 0.062, delay: 0.12 }, // search bar
      { kind: "pill", x: 0.07, y: 0.195, w: 0.22, h: 0.04, delay: 0.22, accent: true },
      { kind: "pill", x: 0.33, y: 0.195, w: 0.2, h: 0.04, delay: 0.3 },
      { kind: "pill", x: 0.57, y: 0.195, w: 0.24, h: 0.04, delay: 0.38 },
      ...Array.from({ length: 5 }, (_, i): PieceDef => ({
        kind: "row",
        x: 0.07,
        y: 0.27 + i * 0.105,
        w: 0.86,
        h: 0.085,
        delay: stagger(i, 0.5, 0.1),
        accent: i === 1,
      })),
      { kind: "nav", x: 0.0, y: 0.925, w: 1.0, h: 0.075, delay: 1.05 },
      /* drifting off-screen panels — the "exploded UI" halo */
      {
        kind: "card",
        x: 0.1,
        y: 0.3,
        w: 0.7,
        h: 0.34,
        delay: 0.85,
        float: { x: -1.15, y: 0.22, z: 0.55, rot: -0.38 },
      },
      {
        kind: "card",
        x: 0.1,
        y: 0.3,
        w: 0.62,
        h: 0.3,
        delay: 1.15,
        float: { x: 1.2, y: -0.34, z: 0.42, rot: 0.3 },
      },
    ],
  },

  /* ── 2. Dashboard app ────────────────────────────────────── */
  {
    id: "dashboard",
    label: "dashboard",
    pieces: [
      { kind: "nav", x: 0.0, y: 0.0, w: 1.0, h: 0.075, delay: 0 },
      { kind: "card", x: 0.07, y: 0.115, w: 0.4, h: 0.115, delay: 0.14, accent: true },
      { kind: "card", x: 0.53, y: 0.115, w: 0.4, h: 0.115, delay: 0.24 },
      { kind: "chart", x: 0.07, y: 0.26, w: 0.86, h: 0.27, delay: 0.42 },
      { kind: "card", x: 0.07, y: 0.565, w: 0.4, h: 0.1, delay: 0.66 },
      { kind: "card", x: 0.53, y: 0.565, w: 0.4, h: 0.1, delay: 0.74 },
      ...Array.from({ length: 3 }, (_, i): PieceDef => ({
        kind: "row",
        x: 0.07,
        y: 0.7 + i * 0.07,
        w: 0.86,
        h: 0.055,
        delay: stagger(i, 0.84, 0.09),
      })),
      { kind: "nav", x: 0.0, y: 0.925, w: 1.0, h: 0.075, delay: 1.12 },
      {
        kind: "chart",
        x: 0.1,
        y: 0.3,
        w: 0.72,
        h: 0.3,
        delay: 0.95,
        float: { x: 1.22, y: 0.3, z: 0.5, rot: 0.34 },
      },
      {
        kind: "card",
        x: 0.1,
        y: 0.3,
        w: 0.6,
        h: 0.32,
        delay: 1.2,
        float: { x: -1.2, y: -0.4, z: 0.38, rot: -0.28 },
      },
    ],
  },

  /* ── 3. Social / feed app ────────────────────────────────── */
  {
    id: "social",
    label: "social-feed",
    pieces: [
      { kind: "nav", x: 0.0, y: 0.0, w: 1.0, h: 0.075, delay: 0 },
      { kind: "row", x: 0.07, y: 0.105, w: 0.86, h: 0.06, delay: 0.12 }, // story strip
      { kind: "card", x: 0.07, y: 0.195, w: 0.86, h: 0.27, delay: 0.26, accent: true },
      { kind: "card", x: 0.07, y: 0.49, w: 0.86, h: 0.27, delay: 0.46 },
      ...Array.from({ length: 2 }, (_, i): PieceDef => ({
        kind: "row",
        x: 0.07,
        y: 0.79 + i * 0.062,
        w: 0.86,
        h: 0.05,
        delay: stagger(i, 0.68, 0.1),
      })),
      { kind: "fab", x: 0.74, y: 0.83, w: 0.17, h: 0.083, delay: 0.9, accent: true },
      { kind: "nav", x: 0.0, y: 0.925, w: 1.0, h: 0.075, delay: 1.0 },
      {
        kind: "card",
        x: 0.1,
        y: 0.3,
        w: 0.68,
        h: 0.36,
        delay: 0.8,
        float: { x: -1.25, y: 0.34, z: 0.46, rot: -0.32 },
      },
      {
        kind: "card",
        x: 0.1,
        y: 0.3,
        w: 0.66,
        h: 0.33,
        delay: 1.1,
        float: { x: 1.18, y: -0.28, z: 0.58, rot: 0.36 },
      },
    ],
  },
];

/* ─────────────────────────────────────────────────────────────
   7. PARTICLES
   ───────────────────────────────────────────────────────────── */
export const PARTICLES = {
  countHigh: 720,
  countMid: 420,
  countLow: 220,
  /** vertical extent the data-rain falls through */
  rainHeight: 3.2,
  /** how far debris flings out during dissolve */
  debrisRadius: 1.55,
} as const;

/* ─────────────────────────────────────────────────────────────
   8. CAMERA
   ───────────────────────────────────────────────────────────── */
export const CAMERA = {
  fov: 38,
  base: [0.8, 0.42, 6.8] as [number, number, number],
  lookAt: [0.8, -0.02, 0] as [number, number, number],
  /** scroll-linked dolly range — deliberately tiny, never scroll-jacky */
  dolly: 0.55,
  pan: 0.28,
  /** pointer parallax */
  mouse: 0.16,
} as const;

/* ─────────────────────────────────────────────────────────────
   9. POST-PROCESSING — tuned so ONLY gold-emissive surfaces bloom
   and the sealed dossier cards stay fully legible on top.
   ───────────────────────────────────────────────────────────── */
export const POST = {
  bloomThreshold: 0.72,
  bloomSmoothing: 0.28,
  bloomIntensity: 1.0,
  chromaticOffset: 0.00055,
  noiseOpacity: 0.035,
  vignetteDarkness: 0.6,
  /** global canvas opacity. The scene now sits in the empty right-hand
      gutter rather than behind the copy, so it no longer has to be dimmed
      to keep the dossier cards legible. */
  canvasOpacity: 1,

  /** Minimum viewport width that actually has a gutter to put the scene in.
      Below this the layout is full-bleed and there is nowhere to show a 3D
      panel without burying it behind the cards again — so we fall back to
      the 2D BlueprintBackground instead. */
  panelMinWidth: 1120,
  /** width of the render panel: clamp(min, vw-relative, max) */
  panelWidth: "clamp(400px, 45vw, 750px)",
} as const;

/* ═════════════════════════════════════════════════════════════════════════
   10. SCENE STATE

   One mutable object, written once per frame by the <SceneDirector> inside
   GenesisBackground and read by every child in its own useFrame. Passing this
   by reference (instead of React state or context) means the whole 60fps
   animation loop causes ZERO React re-renders — the component tree mounts
   once and then only three.js objects are touched.
   ═════════════════════════════════════════════════════════════════════════ */
export interface SceneState {
  /** seconds since the scene started (paused when off-screen) */
  time: number;
  phase: ScenePhase;
  /** 0..1 progress within the current phase */
  t: number;
  cycle: number;
  /** index into ARCHETYPES for the cycle currently being built */
  archetype: number;

  /* ── derived drive signals, all 0..1 ── */
  /** screen backlight */
  power: number;
  /** one-shot submit flash */
  flash: number;
  /** screen shatter-lattice visibility */
  shatter: number;
  /** data-rain particle weight */
  rain: number;
  /** shatter-debris particle weight */
  debris: number;
  /** seconds since `assembling` began (negative before it starts) */
  assembleClock: number;
  /** UI-piece fracture amount during `dissolving` */
  pieceShatter: number;
  /** master fade for the whole UI layer */
  uiOpacity: number;

  /* ── external inputs ── */
  /** 0..1 scroll progress of #tracks through the viewport */
  scroll: number;
  mouseX: number;
  mouseY: number;
  /** 1 = full quality, <1 = degraded by PerformanceMonitor */
  quality: number;
}

export function createSceneState(): SceneState {
  return {
    time: 0,
    phase: "idle-prompt",
    t: 0,
    cycle: 0,
    archetype: 0,
    power: 0,
    flash: 0,
    shatter: 0,
    rain: 0,
    debris: 0,
    assembleClock: -1,
    pieceShatter: 0,
    uiOpacity: 0,
    scroll: 0.5,
    mouseX: 0,
    mouseY: 0,
    quality: 1,
  };
}

/**
 * Write all derived drive signals for the given absolute scene time.
 * Pure w.r.t. `time` — the entire loop is reproducible from the clock alone.
 */
export function updateSceneState(s: SceneState, time: number) {
  const { phase, t, cycle } = resolvePhase(time);
  s.time = time;
  s.phase = phase;
  s.t = t;
  s.cycle = cycle;
  s.archetype = cycle % ARCHETYPES.length;

  /* defaults for this frame */
  let power = 0,
    flash = 0,
    shatter = 0,
    rain = 0,
    debris = 0,
    pieceShatter = 0,
    uiOpacity = 0;
  let assembleClock = -1;

  switch (phase) {
    case "idle-prompt": {
      /* Screen dormant, with a barely-there standby glow that swells in the
         last beat so the submit doesn't come out of nowhere. */
      power = 0.06 + ease.inCubic(remap(t, 0.72, 1)) * 0.1;
      break;
    }

    case "submitting": {
      /* Caret pulse → flash → screen fractures into the gold lattice. */
      power = 0.16 + ease.outExpo(t) * 0.5;
      flash = Math.sin(clamp01(t) * Math.PI) ** 2; // rise & fall within phase
      shatter = ease.outCubic(t);
      rain = ease.inCubic(remap(t, 0.45, 1)) * 0.6;
      break;
    }

    case "assembling": {
      power = 0.66 + ease.outCubic(t) * 0.34;
      /* Lattice lingers under the build, then recedes as solid panels land. */
      shatter = 1 - ease.inOutCubic(remap(t, 0.15, 0.82));
      rain = 0.6 + ease.outCubic(remap(t, 0, 0.2)) * 0.4;
      rain *= 1 - ease.inCubic(remap(t, 0.78, 1)) * 0.55;
      assembleClock = t * PHASES.assembling;
      uiOpacity = 1;
      break;
    }

    case "holding": {
      power = 1;
      shatter = 0;
      rain = 0.45 * (1 - ease.inOutCubic(remap(t, 0, 0.55)));
      assembleClock = PHASES.assembling + t * PHASES.holding;
      uiOpacity = 1;
      break;
    }

    case "dissolving": {
      power = 1 - ease.inOutCubic(t);
      shatter = ease.outCubic(remap(t, 0, 0.45)) * (1 - ease.inCubic(remap(t, 0.5, 1)));
      debris = ease.outQuint(t);
      pieceShatter = ease.inCubic(remap(t, 0, 0.72));
      uiOpacity = 1 - ease.inCubic(remap(t, 0.5, 1));
      assembleClock = PHASES.assembling + PHASES.holding + t * PHASES.dissolving;
      break;
    }
  }

  s.power = power;
  s.flash = flash;
  s.shatter = shatter;
  s.rain = rain;
  s.debris = debris;
  s.assembleClock = assembleClock;
  s.pieceShatter = pieceShatter;
  s.uiOpacity = uiOpacity;
}
