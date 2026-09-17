"use client";

import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";

import {
  PHONE,
  PROMPT_FRAGMENTS,
  TOKENS,
  clamp01,
  ease,
  remap,
  type SceneState,
} from "@/lib/genesisScene";

/* ═══════════════════════════════════════════════════════════════════════════
   PromptTypewriter — the floating prompt bar above the phone.

   Rendered as a CanvasTexture redrawn only when the visible character count
   (or caret/pulse state) actually changes — roughly a dozen uploads per cycle
   rather than 60 per second. This is deliberate:
     • no webfont is fetched at runtime — the monospace stack is whatever the
       user already has, so the bar can never pop in late or fail offline;
     • crisp text at any DPR without troika's SDF pipeline;
     • the caret, the frame, the corner ticks and the glow are one pass.

   THE TEXT IS AMBIENT FLAVOUR ONLY. Fragments come from PROMPT_FRAGMENTS in
   lib/genesisScene.ts and are intentionally generic — AppForge's real sealed
   problem statements appear nowhere in this scene.
   ═══════════════════════════════════════════════════════════════════════════ */

const TEX_W = 1024;
const TEX_H = 176;

/** world size of the bar */
const BAR_W = 1.28;
const BAR_H = (TEX_H / TEX_W) * BAR_W;

export interface PromptTypewriterProps {
  state: SceneState;
}

export default function PromptTypewriter({ state }: PromptTypewriterProps) {
  const groupRef = useRef<THREE.Group>(null);
  const matRef = useRef<THREE.MeshBasicMaterial>(null);

  /** quantised description of the last painted frame */
  const lastKey = useRef("");

  const { ctx, texture } = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = TEX_W;
    c.height = TEX_H;
    const x = c.getContext("2d")!;
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.generateMipmaps = false;
    return { ctx: x, texture: tex };
  }, []);

  useEffect(() => () => texture.dispose(), [texture]);

  /* ── Draw one frame of the bar into the 2D canvas ────────────────────── */
  const paint = useMemo(() => {
    return (text: string, caretOn: boolean, submitPulse: number) => {
      ctx.clearRect(0, 0, TEX_W, TEX_H);

      const padX = 26;
      const padY = 26;
      const bw = TEX_W - padX * 2;
      const bh = TEX_H - padY * 2;

      /* Bar plate — near-black, slightly translucent, as in the reference */
      ctx.save();
      roundRect(ctx, padX, padY, bw, bh, 6);
      ctx.fillStyle = "rgba(7,9,13,0.80)";
      ctx.fill();

      /* Border: --line normally, gold while the submit pulse fires */
      ctx.lineWidth = 2;
      ctx.strokeStyle =
        submitPulse > 0.01
          ? `rgba(244,200,98,${0.35 + submitPulse * 0.6})`
          : "rgba(236,232,222,0.22)";
      ctx.stroke();
      ctx.restore();

      /* Corner ticks — the little gold brackets framing the bar */
      const tick = 16;
      ctx.strokeStyle = `rgba(217,169,74,${0.55 + submitPulse * 0.45})`;
      ctx.lineWidth = 2.5;
      const corners: [number, number, number, number][] = [
        [padX, padY, 1, 1],
        [padX + bw, padY, -1, 1],
        [padX, padY + bh, 1, -1],
        [padX + bw, padY + bh, -1, -1],
      ];
      for (const [cx, cy, sx, sy] of corners) {
        ctx.beginPath();
        ctx.moveTo(cx + sx * tick, cy);
        ctx.lineTo(cx, cy);
        ctx.lineTo(cx, cy + sy * tick);
        ctx.stroke();
      }

      /* Text — monospace, gold, with a soft glow so it reads without needing
         to be blown out by the bloom pass. */
      const fontPx = 58;
      ctx.font = `500 ${fontPx}px ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace`;
      ctx.textBaseline = "middle";
      ctx.textAlign = "left";

      const tx = padX + 22;
      const ty = TEX_H / 2 + 2;

      ctx.save();
      ctx.shadowColor = "rgba(217,169,74,0.55)";
      ctx.shadowBlur = 18;
      ctx.fillStyle = TOKENS.goldBright;
      ctx.fillText(text, tx, ty);
      ctx.restore();

      /* Caret — a filled block, the way a terminal cursor sits */
      if (caretOn) {
        const w = ctx.measureText(text).width;
        ctx.save();
        ctx.shadowColor = "rgba(244,200,98,0.8)";
        ctx.shadowBlur = 22;
        ctx.fillStyle = TOKENS.goldBright;
        ctx.fillRect(tx + w + 6, ty - fontPx * 0.42, fontPx * 0.5, fontPx * 0.84);
        ctx.restore();
      }

      texture.needsUpdate = true;
    };
  }, [ctx, texture]);

  /* Paint an initial frame so the bar is never blank on first mount */
  useEffect(() => {
    paint("", true, 0);
  }, [paint]);

  useFrame((_, rawDelta) => {
    const dt = Math.min(rawDelta, 1 / 20);
    const g = groupRef.current;
    const mat = matRef.current;
    if (!g || !mat) return;

    /* ── Which fragment, and how much of it is typed ───────────────────── */
    const fragIdx = state.cycle % PROMPT_FRAGMENTS.length;
    const frag = PROMPT_FRAGMENTS[fragIdx];

    let visibleChars = frag.length;
    let caretOn = true;
    let submitPulse = 0;
    let targetOpacity = 0;

    if (state.phase === "idle-prompt") {
      /* Type across the first 78% of the phase, then hold the full string
         with a blinking caret — gives the line a beat to be read. */
      const typed = ease.outQuint(remap(state.t, 0.06, 0.78));
      visibleChars = Math.round(typed * frag.length);
      /* Caret blinks at ~1.8Hz once idle; solid while actively typing. */
      caretOn = typed >= 1 ? Math.floor(state.time * 1.8) % 2 === 0 : true;
      targetOpacity = ease.outCubic(remap(state.t, 0, 0.12));
    } else if (state.phase === "submitting") {
      visibleChars = frag.length;
      /* Caret goes solid and the frame pulses — the "enter" beat. */
      submitPulse = Math.sin(clamp01(state.t) * Math.PI) ** 2;
      caretOn = true;
      targetOpacity = 1;
    } else if (state.phase === "assembling") {
      visibleChars = frag.length;
      caretOn = false;
      /* Lingers over the build for a beat, then lifts away. */
      targetOpacity = 1 - ease.inOutCubic(remap(state.t, 0.05, 0.45));
    } else {
      targetOpacity = 0;
      caretOn = false;
    }

    /* ── Repaint only on a visible change ─────────────────────────────────
       Quantising the pulse means the gold border animates in ~6 steps rather
       than forcing a texture upload on every single frame. */
    const key = `${fragIdx}|${visibleChars}|${caretOn ? 1 : 0}|${Math.round(
      submitPulse * 6
    )}`;
    if (key !== lastKey.current) {
      paint(frag.slice(0, visibleChars), caretOn, submitPulse);
      lastKey.current = key;
    }

    /* ── Placement & motion ───────────────────────────────────────────────
       This group is mounted inside PhoneRig's screen-plane group, so z here
       is measured out from the screen surface. The bar rises slightly as it
       fades, reading as consumed by the phone rather than just vanishing. */
    const lift = (1 - targetOpacity) * 0.16;
    const bob =
      Math.sin(state.time * 0.9) * 0.012 + Math.sin(state.time * 1.7) * 0.005;

    g.position.set(0.16, PHONE.height * 0.3 + lift + bob, 0.32);
    g.rotation.set(0.14, -0.06, 0);

    mat.opacity += (targetOpacity - mat.opacity) * (1 - Math.exp(-7 * dt));
    g.visible = mat.opacity > 0.01;
  });

  return (
    <group ref={groupRef}>
      <mesh>
        <planeGeometry args={[BAR_W, BAR_H]} />
        <meshBasicMaterial
          ref={matRef}
          map={texture}
          transparent
          opacity={0}
          depthWrite={false}
          depthTest={false}
          toneMapped={false}
          side={THREE.DoubleSide}
        />
      </mesh>
    </group>
  );
}

/* ── rounded-rect path helper (Path2D-free for older Safari) ─────────────── */
function roundRect(
  c: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  c.beginPath();
  c.moveTo(x + r, y);
  c.lineTo(x + w - r, y);
  c.quadraticCurveTo(x + w, y, x + w, y + r);
  c.lineTo(x + w, y + h - r);
  c.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  c.lineTo(x + r, y + h);
  c.quadraticCurveTo(x, y + h, x, y + h - r);
  c.lineTo(x, y + r);
  c.quadraticCurveTo(x, y, x + r, y);
  c.closePath();
}
