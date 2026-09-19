/* ═══════════════════════════════════════════════════════════════════════════
   simState.ts — the choreography.

   One plain mutable object drives the whole section. The host component owns
   the clock (a single rAF), advances `t`, and derives every animation value
   into `sim.v`. The R3F scene and the HTML overlay both READ `sim.v` — nobody
   calls setState at 60fps, so the simulation triggers exactly zero React
   re-renders once it is running.

   Phases
     "idle"   — before first focus: shell + core only, cards orbiting
     "focus"  — a criterion is selected; runs the beat sheet below
     "finale" — the overview burst; returns to the settled focus state

   FOCUS beat sheet (seconds), mirroring the reference clip:
     0.00  shockwave leaves the core
     0.10  card flies in from the dock (cold) / flips to the new face (warm)
     0.40  first beam draws
     0.62  beams two and three follow
     0.35  shell floods with the accent, peaks at 1.10, settles by 2.60
     0.95  glass dome inflates
     1.15  particles burst out of the shell and assemble the glyph
     1.20  digital rain falls in
     2.25  dome dissolves
     2.40  beams recede, waveform link appears, platform wedge lights
     2.60  progress ring draws, counter runs, labels type out
     4.30  settled
   ═══════════════════════════════════════════════════════════════════════════ */

import { CRITERIA, TOTAL } from "./criteria";

export const FOCUS_DUR = 4.3;
export const FINALE_DUR = 3.6;

/* ── easing ──────────────────────────────────────────────────────────────── */
export const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
export const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
export const easeOutQuint = (t: number) => 1 - Math.pow(1 - t, 5);
export const easeInOutCubic = (t: number) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
export const easeOutBack = (t: number) => {
  const c = 1.70158 + 1;
  return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2);
};

/** normalised, eased progress of a window [a,b] at time t */
function win(t: number, a: number, b: number, ease = easeOutCubic) {
  return ease(clamp01((t - a) / (b - a)));
}

export type SimValues = {
  /** expanding frosted ring, 0→1 */
  shock: number;
  /** featured card presence 0→1 */
  card: number;
  /** 0→1 through the face-swap flip (warm re-selects only) */
  flip: number;
  /** orbiting idle cards 0→1 */
  idle: number;
  /** accent flood on the shell 0→1 */
  tint: number;
  /** per-beam draw progress */
  beam: number[];
  dome: number;
  /** glyph assembly 0→1 */
  glyph: number;
  glyphIn: number;
  rain: number;
  wave: number;
  wedge: number;
  /** core flare bump */
  flare: number;
  /** progress ring sweep 0→1 */
  ring: number;
  /** counter 0→1 */
  pct: number;
  /** typewriter progress for the ring label + description */
  type: number;
  /** finale: per-card beam progress */
  fbeam: number[];
  /** finale: supernova 0→1 */
  nova: number;
};

export type SimState = {
  phase: "idle" | "focus" | "finale";
  /** seconds inside the current phase */
  t: number;
  /** wall clock, always advancing while in view — ambient motion */
  clock: number;
  /** index into CRITERIA, or -1 while idle */
  selected: number;
  /** previous index, kept so the glyph can morph out of the old shape */
  previous: number;
  /** true when a focus starts from an already-focused state */
  warm: boolean;
  /** the index to restore when the finale ends */
  restore: number;
  running: boolean;
  reduced: boolean;
  /** -1..1 pointer parallax */
  mouseX: number;
  mouseY: number;
  /** scene root scale, driven by viewport aspect */
  fit: number;
  /** bumped every time the selection changes, so the scene can re-target */
  epoch: number;
  accent: string;
  accentHi: string;
  v: SimValues;
};

export function createSimState(): SimState {
  return {
    phase: "idle",
    t: 0,
    clock: 0,
    selected: -1,
    previous: -1,
    warm: false,
    restore: -1,
    running: false,
    reduced: false,
    mouseX: 0,
    mouseY: 0,
    fit: 1,
    epoch: 0,
    accent: CRITERIA[1].accent,
    accentHi: CRITERIA[1].accentHi,
    v: {
      shock: 0,
      card: 0,
      flip: 1,
      idle: 1,
      tint: 0,
      beam: [0, 0, 0],
      dome: 0,
      glyph: 0,
      glyphIn: 0,
      rain: 0,
      wave: 0,
      wedge: 0,
      flare: 0,
      ring: 0,
      pct: 0,
      type: 0,
      fbeam: [0, 0, 0, 0, 0, 0],
      nova: 0,
    },
  };
}

/** Start (or restart) a focus run on `index`. */
export function focus(sim: SimState, index: number) {
  if (index < 0 || index >= TOTAL) return;
  if (sim.phase === "focus" && sim.selected === index) return;
  sim.warm = sim.phase !== "idle" && sim.selected >= 0;
  sim.previous = sim.selected;
  sim.selected = index;
  sim.phase = "focus";
  sim.t = 0;
  sim.epoch += 1;
  sim.accent = CRITERIA[index].accent;
  sim.accentHi = CRITERIA[index].accentHi;
}

/** Play the six-criteria overview burst, then return to the current focus. */
export function finale(sim: SimState) {
  if (sim.phase === "finale") return;
  sim.restore = sim.selected;
  sim.phase = "finale";
  sim.t = 0;
}

/** Jump straight to the settled frame — used for prefers-reduced-motion. */
export function settle(sim: SimState) {
  sim.t = FOCUS_DUR;
}

/* ── per-frame derivation ────────────────────────────────────────────────── */

export function updateSim(sim: SimState, dt: number) {
  sim.clock += dt;
  if (sim.phase !== "idle") sim.t += dt;
  const v = sim.v;
  const t = sim.t;

  if (sim.phase === "idle") {
    v.shock = 0;
    v.card = 0;
    v.flip = 1;
    v.idle = 1;
    v.tint = 0;
    v.beam[0] = v.beam[1] = v.beam[2] = 0;
    v.dome = 0;
    v.glyph = 0;
    v.glyphIn = 0;
    v.rain = 0;
    v.wave = 0;
    v.wedge = 0;
    v.flare = 0;
    v.ring = 0;
    v.pct = 0;
    v.type = 0;
    v.nova = 0;
    for (let i = 0; i < 6; i++) v.fbeam[i] = 0;
    return;
  }

  if (sim.phase === "focus") {
    /* shockwave — only on a cold start, and a gentler one when warm */
    const shockAmp = sim.warm ? 0.55 : 1;
    v.shock = t < 1.05 ? shockAmp * win(t, 0, 1.0, easeOutQuint) : 0;

    /* the featured card */
    v.card = sim.warm ? 1 : win(t, 0.1, 0.95, easeOutCubic);
    v.flip = sim.warm ? clamp01((t - 0.05) / 0.5) : 1;

    /* orbiting idle cards retreat into the dock — but only on the cold first
       pick; a warm re-pick must never flash the ring back in */
    v.idle = sim.warm ? 0 : 1 - win(t, 0, 0.55);

    /* shell flood: up fast, then settle to a hint */
    v.tint = win(t, 0.35, 1.1) * (1 - 0.66 * win(t, 1.6, 2.7, easeInOutCubic));

    v.beam[0] = win(t, 0.4, 0.78) * (1 - win(t, 2.35, 2.85));
    v.beam[1] = win(t, 0.62, 1.05) * (1 - win(t, 2.4, 2.9));
    v.beam[2] = win(t, 0.72, 1.15) * (1 - win(t, 2.45, 2.95));

    v.dome = win(t, 0.95, 1.4, easeOutBack) * (1 - win(t, 2.25, 2.75));

    v.glyph = win(t, 1.15, 2.45, easeOutQuint);
    /* warm: the cloud stays on screen and morphs from the old icon to the new
       one, so it never blinks out between two picks */
    v.glyphIn = sim.warm ? 1 : win(t, 1.1, 1.5);

    /* the rain never fully leaves: it is part of the settled look, so it only
       drops back to an ambient level once the glyph has formed */
    v.rain = win(t, 1.2, 1.75) * (1 - 0.42 * win(t, 3.2, 4.3));
    v.wave = win(t, 2.4, 2.95);
    v.wedge = win(t, 2.3, 2.9);

    /* core flare spikes on beam impact */
    const impact = win(t, 0.72, 0.86) * (1 - win(t, 0.86, 1.45));
    v.flare = impact;

    v.ring = win(t, 2.6, 4.0, easeInOutCubic);
    v.pct = v.ring;
    v.type = win(t, 2.7, 4.1, (x) => x);

    v.nova = 0;
    for (let i = 0; i < 6; i++) v.fbeam[i] = 0;
    return;
  }

  /* ── finale ─────────────────────────────────────────────────────────── */
  const out = win(t, 0, 0.45);
  const back = win(t, FINALE_DUR - 0.55, FINALE_DUR);

  v.card = (1 - out) * (1 - back) + back;
  v.flip = 1;
  v.idle = Math.max(win(t, 0.05, 0.6) * (1 - win(t, FINALE_DUR - 0.5, FINALE_DUR)), 0);
  v.shock = 0;
  v.tint = 0.34 * (1 - out) + 0.34 * back;
  v.beam[0] = v.beam[1] = v.beam[2] = 0;
  v.dome = 0;
  v.glyph = 1;
  v.glyphIn = (1 - out) * (1 - back) + back;
  v.rain = (1 - out) * (1 - back) + back;
  v.wave = (1 - out) * (1 - back) + back;
  v.wedge = (1 - out) * (1 - back) + back;
  v.ring = (1 - out) * (1 - back) + back;
  v.pct = 1;
  v.type = 1;

  for (let i = 0; i < 6; i++) {
    v.fbeam[i] = win(t, 0.5 + i * 0.1, 1.05 + i * 0.1) * (1 - win(t, 2.35, 2.9));
  }
  const nova = win(t, 1.15, 1.55, easeOutQuint) * (1 - win(t, 1.6, 2.9, easeInOutCubic));
  v.nova = nova;
  v.flare = nova;

  if (t >= FINALE_DUR) {
    sim.phase = "focus";
    sim.warm = true;
    sim.t = FOCUS_DUR;
    if (sim.restore >= 0) sim.selected = sim.restore;
  }
}
