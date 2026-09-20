"use client";

import { useSyncExternalStore, useCallback } from "react";

/**
 * §10 — the repo has no existing zustand/jotai store, so this is a
 * ~40-line useSyncExternalStore store instead: zero new dependencies.
 * The exported hook surface is what the rest of the section consumes.
 */

export type Tier = "desktop" | "tablet" | "mobile";

export interface ForgeState {
  /** rule id currently hovered or keyboard-focused, or null */
  hovered: number | null;
  /** rule id whose dossier panel is open, or null */
  open: number | null;
  /** §8.2 — traces never return to dormant once energised */
  energised: boolean;
  /** entrance timeline progress 0..1 (mirrored for React consumers; the scene
   *  reads the ref in progressRef to avoid re-rendering at 60fps) */
  settled: boolean;
  tier: Tier;
  reducedMotion: boolean;
}

const initial: ForgeState = {
  hovered: null,
  open: null,
  energised: false,
  settled: false,
  tier: "desktop",
  reducedMotion: false,
};

let state: ForgeState = initial;
const listeners = new Set<() => void>();

function set(patch: Partial<ForgeState>) {
  let changed = false;
  for (const k of Object.keys(patch) as (keyof ForgeState)[]) {
    if (state[k] !== patch[k]) {
      changed = true;
      break;
    }
  }
  if (!changed) return;
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

const getSnapshot = () => state;
const getServerSnapshot = () => initial;

export function useForgeStore<T>(selector: (s: ForgeState) => T): T {
  return useSyncExternalStore(
    subscribe,
    () => selector(getSnapshot()),
    () => selector(getServerSnapshot())
  );
}

/** Imperative handle — safe to call from rAF / event handlers / the scene. */
export const forge = {
  get: getSnapshot,
  subscribe,
  setHovered(id: number | null) {
    set({ hovered: id, energised: state.energised || id !== null });
  },
  setOpen(id: number | null) {
    set({ open: id });
  },
  setSettled(v: boolean) {
    set({ settled: v });
  },
  setTier(t: Tier) {
    set({ tier: t });
  },
  setReducedMotion(v: boolean) {
    set({ reducedMotion: v });
  },
  reset() {
    set({ ...initial, tier: state.tier, reducedMotion: state.reducedMotion });
  },
};

/**
 * Non-reactive channel for per-frame values. The scroll timeline writes
 * `progressRef.current`; ForgeCoreScene reads it inside useFrame. React never
 * re-renders because of it (§5.1: every S1–S5 visual is a pure function of p).
 */
export const progressRef = { current: 0 };

/** Imperative one-shot core reactions (§7). Registered by ForgeCoreScene. */
type CoreApi = {
  flare: () => void;
  absorb: () => void;
  shockwave: () => void;
};
let coreApi: CoreApi | null = null;
export const registerCore = (api: CoreApi | null) => {
  coreApi = api;
};
export const core = {
  flare: () => coreApi?.flare(),
  absorb: () => coreApi?.absorb(),
  shockwave: () => coreApi?.shockwave(),
};

export function useForgeActions() {
  return useCallback(() => forge, [])();
}
