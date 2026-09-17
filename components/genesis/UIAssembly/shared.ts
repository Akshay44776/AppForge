import { useMemo, useRef } from "react";
import * as THREE from "three";

import {
  SCREEN,
  TOKENS,
  clamp01,
  type PieceDef,
  type SceneState,
} from "@/lib/genesisScene";
import {
  WireframeSolidMaterial,
  type WireframeSolidMaterialImpl,
} from "../materials/wireframeSolidMaterial";

/* ═══════════════════════════════════════════════════════════════════════════
   shared.ts — the small amount of machinery every UI piece needs.

   Kept out of index.tsx on purpose: the piece components import this, and
   index.tsx imports the piece components, so putting these helpers in index
   would create a circular import.
   ═══════════════════════════════════════════════════════════════════════════ */

/* ─── Per-piece entrance timing (seconds) ──────────────────────────────── */
export const ENTER_DUR = 0.52; // wireframe outline draws itself
export const SOLID_LAG = 0.30; // how long the outline hangs before filling
export const SOLID_DUR = 0.46; // wireframe → solid crossfade

/* ─── One shared geometry for every piece ──────────────────────────────────
   A 1×1 unit quad, subdivided 6×8. The subdivision exists purely so the
   shatter vertex shader has cells to throw around; a 1×1 quad would only be
   able to translate as a whole. Every piece scales this same buffer, so the
   entire UI layer is one geometry upload for the life of the page. */
export const PIECE_GEOMETRY = new THREE.PlaneGeometry(1, 1, 6, 8);

/* ─── Normalised archetype rect → local screen-space rect ──────────────── */
export interface PieceRect {
  x: number;
  y: number;
  z: number;
  w: number;
  h: number;
}

export function toRect(def: PieceDef, index: number): PieceRect {
  return {
    /* normalised x is left-edge based; convert to a centre offset */
    x: (def.x + def.w / 2 - 0.5) * SCREEN.width,
    /* normalised y runs top→bottom; world y runs bottom→top */
    y: (0.5 - (def.y + def.h / 2)) * SCREEN.height,
    /* tiny per-piece z stagger stops coplanar quads from z-fighting */
    z: index * 0.0012,
    w: def.w * SCREEN.width,
    h: def.h * SCREEN.height,
  };
}

/* ─── Material factory ─────────────────────────────────────────────────── */
export function makePieceMaterial(
  seed: number,
  aspect: number,
  accent: number,
  border: number,
  radius: number
): WireframeSolidMaterialImpl {
  const m = new WireframeSolidMaterial() as unknown as WireframeSolidMaterialImpl;
  m.transparent = true;
  m.depthWrite = false;
  m.side = THREE.DoubleSide;
  m.toneMapped = false;

  m.uniforms.uSeed.value = seed;
  m.uniforms.uAspect.value = aspect;
  m.uniforms.uAccent.value = accent;
  m.uniforms.uBorder.value = border;
  m.uniforms.uRadius.value = radius;
  m.uniforms.uGold.value = new THREE.Color(TOKENS.gold);
  m.uniforms.uGoldBright.value = new THREE.Color(TOKENS.goldBright);
  m.uniforms.uSurface.value = new THREE.Color(TOKENS.surface);
  m.uniforms.uPaper.value = new THREE.Color(TOKENS.paper);
  m.uniforms.uLine.value = new THREE.Color(TOKENS.line);
  return m;
}

/* ─── Props every piece component takes ────────────────────────────────── */
export interface PieceProps {
  def: PieceDef;
  rect: PieceRect;
  seed: number;
  state: SceneState;
}

export interface PieceDrive {
  /** 0..1 entrance progress */
  enter: number;
  /** 0..1 wireframe → solid */
  solid: number;
  /** 0..1 fracture */
  shatter: number;
  visible: boolean;
}

/**
 * usePieceDrive returns a per-frame function that:
 *   1. derives this piece's entrance / solidify / shatter values from the
 *      shared scene clock, and
 *   2. writes them straight into the piece's shader uniforms.
 *
 * The caller then only has to deal with its own transform, which is what
 * actually differs between a nav bar and a list row.
 */
export function usePieceDrive(
  props: PieceProps,
  material: WireframeSolidMaterialImpl
) {
  const { def, state } = props;
  const out = useRef<PieceDrive>({
    enter: 0,
    solid: 0,
    shatter: 0,
    visible: false,
  });

  return useMemo(() => {
    return (): PieceDrive => {
      const clock = state.assembleClock;
      const o = out.current;

      if (clock < 0 || state.uiOpacity <= 0.001) {
        o.visible = false;
        return o;
      }

      const local = clock - def.delay;
      if (local < 0) {
        o.visible = false;
        return o;
      }

      o.enter = clamp01(local / ENTER_DUR);
      o.solid = clamp01((local - SOLID_LAG) / SOLID_DUR);

      /* Pieces fracture in the same order they were built — the dissolve
         reads as the build running backwards, not as a uniform blast. */
      const shatterDelay = def.delay * 0.22;
      o.shatter = clamp01((state.pieceShatter - shatterDelay) / (1 - shatterDelay));

      o.visible = true;

      material.uniforms.uTime.value = state.time;
      material.uniforms.uEnter.value = o.enter;
      material.uniforms.uSolid.value = o.solid;
      material.uniforms.uShatter.value = o.shatter;
      material.uniforms.uOpacity.value = state.uiOpacity;

      return o;
    };
  }, [def.delay, state, material]);
}
