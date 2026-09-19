/* ═══════════════════════════════════════════════════════════════════════════
   textures.ts — everything that is painted on a 2D canvas before the GPU
   sees it: the glass card faces, and the point cloud sampled from a
   criterion's icon that becomes the particle glyph.
   ═══════════════════════════════════════════════════════════════════════════ */

import type { Criterion } from "./criteria";
import { rgba } from "./criteria";

/** next/font generates a hashed family name; read it off the html element. */
export function fontStack(varName: string, fallback: string) {
  if (typeof window === "undefined") return fallback;
  const v = getComputedStyle(document.documentElement)
    .getPropertyValue(varName)
    .trim();
  return v ? `${v}, ${fallback}` : fallback;
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  ctx.beginPath();
  if (typeof (ctx as any).roundRect === "function") {
    (ctx as any).roundRect(x, y, w, h, r);
    return;
  }
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function strokeIcon(
  ctx: CanvasRenderingContext2D,
  paths: string[],
  x: number,
  y: number,
  size: number,
  color: string,
  width: number
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(size / 24, size / 24);
  ctx.strokeStyle = color;
  ctx.lineWidth = (width * 24) / size;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  for (const d of paths) ctx.stroke(new Path2D(d));
  ctx.restore();
}

/* ─────────────────────────────────────────────────────────────────────────
   The featured card face.

   Drawn with a transparent margin so the accent rim glow has room to bleed;
   the plane that carries this texture is sized to include that margin, which
   keeps the glow in the texture instead of costing a second draw call.
   ───────────────────────────────────────────────────────────────────────── */
export const CARD_TEX_W = 600;
export const CARD_TEX_H = 790;
const PAD = 44;

export function drawCardFace(
  canvas: HTMLCanvasElement,
  c: Criterion,
  featured: boolean
) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const W = CARD_TEX_W;
  const H = CARD_TEX_H;
  canvas.width = W;
  canvas.height = H;
  ctx.clearRect(0, 0, W, H);

  const x = PAD;
  const y = PAD;
  const w = W - PAD * 2;
  const h = H - PAD * 2;
  const r = 40;

  const display = fontStack("--font-grotesk", "system-ui, sans-serif");
  const mono = "ui-monospace, SFMono-Regular, Menlo, monospace";

  /* ── body ── */
  roundRect(ctx, x, y, w, h, r);
  ctx.save();
  ctx.clip();

  const base = ctx.createLinearGradient(x, y, x + w * 0.6, y + h);
  base.addColorStop(0, "rgba(22, 27, 35, 0.90)");
  base.addColorStop(0.55, "rgba(13, 17, 23, 0.88)");
  base.addColorStop(1, "rgba(9, 12, 17, 0.92)");
  ctx.fillStyle = base;
  ctx.fillRect(x, y, w, h);

  /* diagonal specular sheen across the upper-left */
  const sheen = ctx.createLinearGradient(x, y, x + w * 0.85, y + h * 0.7);
  sheen.addColorStop(0, "rgba(255,255,255,0.10)");
  sheen.addColorStop(0.35, "rgba(255,255,255,0.03)");
  sheen.addColorStop(0.62, "rgba(255,255,255,0.00)");
  ctx.fillStyle = sheen;
  ctx.fillRect(x, y, w, h);

  /* accent wash rising from the bottom edge */
  const wash = ctx.createLinearGradient(x, y + h, x, y + h * 0.45);
  wash.addColorStop(0, rgba(c.accent, featured ? 0.16 : 0.1));
  wash.addColorStop(1, rgba(c.accent, 0));
  ctx.fillStyle = wash;
  ctx.fillRect(x, y + h * 0.45, w, h * 0.55);
  ctx.restore();

  /* ── rim: a wide soft pass, then a crisp hairline ── */
  ctx.save();
  ctx.shadowColor = rgba(c.accent, featured ? 0.85 : 0.45);
  ctx.shadowBlur = featured ? 34 : 18;
  ctx.strokeStyle = rgba(c.accent, featured ? 0.95 : 0.5);
  ctx.lineWidth = featured ? 5 : 3.5;
  roundRect(ctx, x, y, w, h, r);
  ctx.stroke();
  ctx.stroke();
  ctx.restore();

  ctx.strokeStyle = rgba(c.accentHi, featured ? 0.9 : 0.55);
  ctx.lineWidth = 2;
  roundRect(ctx, x + 1, y + 1, w - 2, h - 2, r - 1);
  ctx.stroke();

  ctx.strokeStyle = "rgba(255,255,255,0.10)";
  ctx.lineWidth = 1.5;
  roundRect(ctx, x + 9, y + 9, w - 18, h - 18, r - 8);
  ctx.stroke();

  /* ── content ── */
  const padX = x + 52;
  strokeIcon(ctx, c.icon, padX, y + 74, 46, c.accent, 1.8);

  ctx.fillStyle = "#ece8de";
  ctx.textBaseline = "alphabetic";
  const titleSize = 56;
  ctx.font = `600 ${titleSize}px ${display}`;
  const lines = c.titleLines;
  const startY = y + h * 0.52 - (lines.length - 1) * titleSize * 0.62;
  lines.forEach((line, i) => {
    ctx.fillText(line, padX, startY + i * titleSize * 1.24);
  });

  ctx.font = `500 26px ${mono}`;
  ctx.fillStyle = rgba(c.accentHi, 0.95);
  const letter = 3.2;
  let tx = padX;
  const label = c.tagline;
  for (const ch of label) {
    ctx.fillText(ch, tx, y + h - 66);
    tx += ctx.measureText(ch).width + letter;
  }
}

/* ─────────────────────────────────────────────────────────────────────────
   The small orbiting card used before a criterion is picked.
   ───────────────────────────────────────────────────────────────────────── */
export const MINI_TEX_W = 260;
export const MINI_TEX_H = 344;

export function drawMiniFace(canvas: HTMLCanvasElement, c: Criterion) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const W = MINI_TEX_W;
  const H = MINI_TEX_H;
  canvas.width = W;
  canvas.height = H;
  ctx.clearRect(0, 0, W, H);

  const p = 16;
  const x = p;
  const y = p;
  const w = W - p * 2;
  const h = H - p * 2;
  const r = 18;

  roundRect(ctx, x, y, w, h, r);
  ctx.save();
  ctx.clip();
  const g = ctx.createLinearGradient(x, y, x + w, y + h);
  g.addColorStop(0, "rgba(24, 29, 37, 0.85)");
  g.addColorStop(1, "rgba(10, 13, 18, 0.88)");
  ctx.fillStyle = g;
  ctx.fillRect(x, y, w, h);
  const wash = ctx.createLinearGradient(x, y + h, x, y + h * 0.4);
  wash.addColorStop(0, rgba(c.accent, 0.14));
  wash.addColorStop(1, rgba(c.accent, 0));
  ctx.fillStyle = wash;
  ctx.fillRect(x, y, w, h);
  ctx.restore();

  ctx.save();
  ctx.shadowColor = rgba(c.accent, 0.5);
  ctx.shadowBlur = 14;
  ctx.strokeStyle = rgba(c.accent, 0.55);
  ctx.lineWidth = 2.5;
  roundRect(ctx, x, y, w, h, r);
  ctx.stroke();
  ctx.restore();

  strokeIcon(ctx, c.icon, x + 22, y + 26, 26, rgba(c.accent, 0.95), 1.8);

  const display = fontStack("--font-grotesk", "system-ui, sans-serif");
  ctx.fillStyle = "rgba(236, 232, 222, 0.92)";
  ctx.font = `600 24px ${display}`;
  const lines = c.titleLines;
  lines.forEach((line, i) => {
    ctx.fillText(line, x + 22, y + h * 0.62 + i * 28);
  });
}

/* ─────────────────────────────────────────────────────────────────────────
   Glyph sampling — rasterise the stroked icon large, then keep `count`
   random lit pixels as particle targets in a unit-height space centred on 0.
   ───────────────────────────────────────────────────────────────────────── */
export function sampleGlyph(paths: string[], count: number): Float32Array {
  const out = new Float32Array(count * 3);
  if (typeof document === "undefined") return out;

  const S = 320;
  const canvas = document.createElement("canvas");
  canvas.width = S;
  canvas.height = S;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return out;

  ctx.clearRect(0, 0, S, S);
  ctx.save();
  const inset = 26;
  ctx.translate(inset, inset);
  ctx.scale((S - inset * 2) / 24, (S - inset * 2) / 24);
  ctx.strokeStyle = "#fff";
  ctx.lineWidth = 1.9;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  for (const d of paths) ctx.stroke(new Path2D(d));
  ctx.restore();

  const data = ctx.getImageData(0, 0, S, S).data;

  /* collect lit pixels once, then pick from that pool — far cheaper and far
     more even than rejection-sampling into a sparse bitmap. */
  const pool: number[] = [];
  for (let i = 0; i < S * S; i++) {
    if (data[i * 4 + 3] > 90) pool.push(i);
  }
  if (pool.length === 0) return out;

  for (let i = 0; i < count; i++) {
    const idx = pool[(Math.random() * pool.length) | 0];
    const px = idx % S;
    const py = (idx / S) | 0;
    /* jitter inside the pixel so the cloud never looks like a grid */
    const jx = (px + Math.random()) / S - 0.5;
    const jy = 0.5 - (py + Math.random()) / S;
    out[i * 3] = jx;
    out[i * 3 + 1] = jy;
    out[i * 3 + 2] = (Math.random() - 0.5) * 0.06;
  }
  return out;
}
