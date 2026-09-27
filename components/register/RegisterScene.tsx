"use client";

import { useEffect, useRef, useMemo, useCallback } from "react";

interface Shard {
  x: number; y: number; z: number;
  vx: number; vy: number;
  rot: number; rotV: number;
  size: number;
  alpha: number;
  layer: 0 | 1; // 0 = background, 1 = foreground
  // For assembly animation: final position on sphere surface
  targetX: number; targetY: number;
  assembled: boolean;
}

interface SphereFacet {
  // Triangle 2D projected vertices
  v0x: number; v0y: number;
  v1x: number; v1y: number;
  v2x: number; v2y: number;
  brightness: number;
}

// ---- low-poly icosphere geometry (1 subdivision) ----
function buildIcosphere(radius: number): number[][] {
  const t = (1 + Math.sqrt(5)) / 2;
  const verts: [number, number, number][] = [
    [-1, t, 0], [1, t, 0], [-1, -t, 0], [1, -t, 0],
    [0, -1, t], [0, 1, t], [0, -1, -t], [0, 1, -t],
    [t, 0, -1], [t, 0, 1], [-t, 0, -1], [-t, 0, 1],
  ];
  // Normalize
  const norm = verts.map(([x, y, z]) => {
    const l = Math.sqrt(x * x + y * y + z * z);
    return [x / l * radius, y / l * radius, z / l * radius];
  });
  const faces = [
    [0,11,5],[0,5,1],[0,1,7],[0,7,10],[0,10,11],
    [1,5,9],[5,11,4],[11,10,2],[10,7,6],[7,1,8],
    [3,9,4],[3,4,2],[3,2,6],[3,6,8],[3,8,9],
    [4,9,5],[2,4,11],[6,2,10],[8,6,7],[9,8,1],
  ];
  return faces.map(([a, b, c]) => [
    ...norm[a], ...norm[b], ...norm[c]
  ]);
}

// Project 3D point to 2D with simple perspective
function project(x: number, y: number, z: number, fov: number, cx: number, cy: number) {
  const scale = fov / (fov + z);
  return { sx: cx + x * scale, sy: cy + y * scale, scale };
}

// Rotate point around Y axis
function rotY(x: number, y: number, z: number, a: number) {
  return { x: x * Math.cos(a) + z * Math.sin(a), y, z: -x * Math.sin(a) + z * Math.cos(a) };
}
// Rotate around X axis
function rotX(x: number, y: number, z: number, a: number) {
  return { x, y: y * Math.cos(a) - z * Math.sin(a), z: y * Math.sin(a) + z * Math.cos(a) };
}

function lerp(a: number, b: number, t: number) { return a + (b - a) * t; }
function clamp01(t: number) { return t < 0 ? 0 : t > 1 ? 1 : t; }
function easeOutCubic(t: number) { return 1 - Math.pow(1 - t, 3); }
function easeInOutQuad(t: number) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; }

const INTRO_DURATION = 5000; // ms
const SHARD_COUNT_BG = 28;
const SHARD_COUNT_FG = 10;

export default function RegisterScene() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef({
    introStart: 0,
    introPlayed: false,
    animating: false,
    angle: 0,
    pulsePhase: 0,
    mouseX: 0,
    mouseY: 0,
    reduced: false,
  });

  const shardsRef = useRef<Shard[]>([]);
  const assembledShardPositions = useRef<{ x: number; y: number }[]>([]);

  const init = useCallback((canvas: HTMLCanvasElement) => {
    const W = canvas.width;
    const H = canvas.height;
    const s = stateRef.current;
    s.reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // Sphere shard destination positions (on surface of projected sphere)
    const facets = buildIcosphere(1);
    const positions: { x: number; y: number }[] = facets.map(([x, y, z]) => {
      const cx = facets[0][0];
      const cy = facets[0][1];
      const r = rotY(x, y, z, Math.PI * 0.2);
      const r2 = rotX(r.x, r.y, r.z, 0.3);
      const proj = project(r2.x * 130, r2.y * 130, r2.z * 130, 500, W * 0.54, H * 0.5);
      return { x: proj.sx, y: proj.sy };
    });
    assembledShardPositions.current = positions;

    const shards: Shard[] = [];
    for (let i = 0; i < SHARD_COUNT_BG + SHARD_COUNT_FG; i++) {
      const layer: 0 | 1 = i < SHARD_COUNT_BG ? 0 : 1;
      const pos = i < positions.length ? positions[i % positions.length] : {
        x: Math.random() * W, y: Math.random() * H
      };
      shards.push({
        x: s.reduced ? (W * 0.3 + Math.random() * W * 0.5) : (Math.random() * W),
        y: s.reduced ? (H * 0.2 + Math.random() * H * 0.6) : (Math.random() * H),
        z: 0,
        vx: (Math.random() - 0.5) * 0.25 * (layer + 0.5),
        vy: (Math.random() - 0.5) * 0.18 * (layer + 0.5),
        rot: Math.random() * Math.PI * 2,
        rotV: (Math.random() - 0.5) * 0.005 * (layer + 0.5),
        size: layer === 0 ? (10 + Math.random() * 30) : (30 + Math.random() * 70),
        alpha: layer === 0 ? (0.06 + Math.random() * 0.1) : (0.04 + Math.random() * 0.07),
        layer,
        targetX: pos.x,
        targetY: pos.y,
        assembled: false,
      });
    }
    shardsRef.current = shards;
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let raf = 0;
    let alive = true;

    const resize = () => {
      const parent = canvas.parentElement!;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = parent.clientWidth * dpr;
      canvas.height = parent.clientHeight * dpr;
      canvas.style.width = parent.clientWidth + "px";
      canvas.style.height = parent.clientHeight + "px";
      init(canvas);
    };
    resize();
    window.addEventListener("resize", resize);

    // Parallax on mouse
    const onMouse = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      stateRef.current.mouseX = (e.clientX - rect.left) / rect.width - 0.5;
      stateRef.current.mouseY = (e.clientY - rect.top) / rect.height - 0.5;
    };
    window.addEventListener("mousemove", onMouse);

    // Start intro when scrolled into view
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !stateRef.current.animating) {
        stateRef.current.animating = true;
        if (!stateRef.current.introPlayed) {
          stateRef.current.introStart = performance.now();
        }
        if (!raf) raf = requestAnimationFrame(draw);
      } else if (!entry.isIntersecting) {
        cancelAnimationFrame(raf);
        raf = 0;
        stateRef.current.animating = false;
      }
    }, { threshold: 0.1 });
    observer.observe(canvas.parentElement!);

    const GOLD = "#d9a94a";
    const GOLD_BRIGHT = "#f4c862";
    const GOLD_DIM = "#8A6A2E";
    const OBSIDIAN = "rgba(8,9,14,0.88)";

    function drawSphere(
      ctx: CanvasRenderingContext2D,
      cx: number,
      cy: number,
      angleY: number,
      angleX: number,
      emissive: number
    ) {
      const facets = buildIcosphere(1);
      const RADIUS = Math.min(canvas!.width, canvas!.height) * 0.22;
      const FOV = 500;

      // Sort by Z (painter's algorithm)
      const projected = facets.map((f) => {
        const r0 = rotY(f[0], f[1], f[2], angleY);
        const r1 = rotY(f[3], f[4], f[5], angleY);
        const r2 = rotY(f[6], f[7], f[8], angleY);
        const verts = [
          rotX(r0.x, r0.y, r0.z, angleX),
          rotX(r1.x, r1.y, r1.z, angleX),
          rotX(r2.x, r2.y, r2.z, angleX),
        ];
        const avgZ = (verts[0].z + verts[1].z + verts[2].z) / 3;

        const p = [
          project(verts[0].x * RADIUS, verts[0].y * RADIUS, verts[0].z * RADIUS, FOV, cx, cy),
          project(verts[1].x * RADIUS, verts[1].y * RADIUS, verts[1].z * RADIUS, FOV, cx, cy),
          project(verts[2].x * RADIUS, verts[2].y * RADIUS, verts[2].z * RADIUS, FOV, cx, cy),
        ];

        // Normal for lighting
        const ax = verts[1].x - verts[0].x;
        const ay = verts[1].y - verts[0].y;
        const az = verts[1].z - verts[0].z;
        const bx = verts[2].x - verts[0].x;
        const by = verts[2].y - verts[0].y;
        const bz = verts[2].z - verts[0].z;
        const nx = ay * bz - az * by;
        const ny = az * bx - ax * bz;
        const nz = ax * by - ay * bx;
        const nl = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;
        const dot = Math.max(0, (nx / nl * 0.5 + ny / nl * 0.3 + nz / nl * 0.8));

        return { p, avgZ, dot, front: avgZ < 0 };
      });

      projected.sort((a, b) => b.avgZ - a.avgZ);

      for (const { p, dot, front } of projected) {
        if (!front) continue;
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(p[0].sx, p[0].sy);
        ctx.lineTo(p[1].sx, p[1].sy);
        ctx.lineTo(p[2].sx, p[2].sy);
        ctx.closePath();

        // Dark obsidian facet with gold rim glow via emissive
        const baseDark = `rgba(8, 9, 16, ${0.85 + dot * 0.1})`;
        const emissiveColor = `rgba(217,169,74,${emissive * dot * 0.55})`;
        ctx.fillStyle = baseDark;
        ctx.fill();

        // Emissive inner glow blending
        if (emissive > 0.05) {
          ctx.globalCompositeOperation = "lighter";
          ctx.fillStyle = emissiveColor;
          ctx.fill();
          ctx.globalCompositeOperation = "source-over";
        }

        // Gold edge seams
        ctx.strokeStyle = `rgba(217,169,74,${0.18 + emissive * 0.45 + dot * 0.1})`;
        ctx.lineWidth = 0.7;
        ctx.stroke();
        ctx.restore();
      }

      // Inner glow core
      if (emissive > 0.05) {
        const grd = ctx.createRadialGradient(cx, cy, 0, cx, cy, RADIUS * 0.6);
        grd.addColorStop(0, `rgba(244,200,98,${emissive * 0.55})`);
        grd.addColorStop(0.5, `rgba(217,169,74,${emissive * 0.18})`);
        grd.addColorStop(1, "transparent");
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        ctx.beginPath();
        ctx.arc(cx, cy, RADIUS * 0.65, 0, Math.PI * 2);
        ctx.fillStyle = grd;
        ctx.fill();
        ctx.restore();
      }
    }

    function drawShard(
      ctx: CanvasRenderingContext2D,
      x: number, y: number, rot: number, size: number, alpha: number, emissive: number
    ) {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(rot);
      ctx.globalAlpha = alpha;
      // Triangle shard
      ctx.beginPath();
      ctx.moveTo(0, -size);
      ctx.lineTo(size * 0.6, size * 0.5);
      ctx.lineTo(-size * 0.6, size * 0.5);
      ctx.closePath();
      ctx.fillStyle = "rgba(8,9,14,0.82)";
      ctx.fill();
      // Gold rim on one edge
      ctx.strokeStyle = `rgba(217,169,74,${0.15 + emissive * 0.3})`;
      ctx.lineWidth = 0.8;
      ctx.stroke();
      ctx.restore();
    }

    function drawFloor(ctx: CanvasRenderingContext2D, W: number, H: number) {
      const floorTop = H * 0.78;
      const grd = ctx.createLinearGradient(0, floorTop, 0, H);
      grd.addColorStop(0, "rgba(10,10,16,0.0)");
      grd.addColorStop(0.2, "rgba(8,9,14,0.6)");
      grd.addColorStop(1, "rgba(6,7,10,0.96)");
      ctx.fillStyle = grd;
      ctx.fillRect(0, floorTop, W, H - floorTop);

      // Reflective sheen
      const sheen = ctx.createLinearGradient(0, floorTop, W, floorTop + 30);
      sheen.addColorStop(0, "transparent");
      sheen.addColorStop(0.45, "rgba(217,169,74,0.04)");
      sheen.addColorStop(0.55, "rgba(217,169,74,0.07)");
      sheen.addColorStop(1, "transparent");
      ctx.fillStyle = sheen;
      ctx.fillRect(0, floorTop, W, 30);
    }

    function drawGodRay(ctx: CanvasRenderingContext2D, W: number, H: number, progress: number) {
      ctx.save();
      const grd = ctx.createLinearGradient(W, 0, W * 0.3, H * 0.7);
      grd.addColorStop(0, `rgba(244,200,98,${0.06 * progress})`);
      grd.addColorStop(0.4, `rgba(217,169,74,${0.03 * progress})`);
      grd.addColorStop(1, "transparent");
      ctx.fillStyle = grd;
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
    }

    function drawDustParticle(
      ctx: CanvasRenderingContext2D,
      x: number, y: number, alpha: number
    ) {
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = "#d9a94a";
      ctx.beginPath();
      ctx.arc(x, y, 1, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    const dustParticles = Array.from({ length: 40 }, () => ({
      x: Math.random(), y: Math.random(),
      speed: 0.0002 + Math.random() * 0.0003,
      alpha: 0.1 + Math.random() * 0.2,
    }));

    let prevTime = 0;

    function draw(now: number) {
      if (!alive) return;
      const s = stateRef.current;
      const dt = Math.min((now - prevTime) / 1000, 0.05);
      prevTime = now;

      const ctx = canvas!.getContext("2d");
      if (!ctx) return;
      const W = canvas!.width;
      const H = canvas!.height;

      ctx.clearRect(0, 0, W, H);

      // Background gradient
      const bg = ctx.createLinearGradient(0, 0, 0, H);
      bg.addColorStop(0, "#06080b");
      bg.addColorStop(1, "#08090e");
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, H);

      // Intro timeline
      const elapsed = now - s.introStart;
      const introP = s.reduced ? 1 : clamp01(elapsed / INTRO_DURATION);

      // Emissive peaks at t=2.0-3.5s (p=0.4-0.7) then eases to 0.15
      let emissive = 0;
      if (introP < 0.4) {
        emissive = easeOutCubic(introP / 0.4) * 0.3;
      } else if (introP < 0.7) {
        emissive = 0.3 + easeInOutQuad((introP - 0.4) / 0.3) * 0.7;
      } else {
        emissive = 1.0 - easeOutCubic((introP - 0.7) / 0.3) * 0.8;
      }
      // Idle pulse after intro
      if (introP >= 1) {
        s.pulsePhase += dt * (Math.PI * 2 / 5); // 5s cycle
        emissive = 0.15 + Math.sin(s.pulsePhase) * 0.07;
      }

      // Sphere rotation
      s.angle += dt * 0.045; // ~2.6°/s

      const SPHERE_X = W * 0.54 + stateRef.current.mouseX * W * -0.015;
      const SPHERE_Y = H * 0.50 + stateRef.current.mouseY * H * -0.012;

      // God ray (ramps in 0→7s)
      drawGodRay(ctx, W, H, Math.min(1, elapsed / 7000));

      // Background shards
      const shards = shardsRef.current;
      for (const sh of shards) {
        if (sh.layer !== 0) continue;

        if (introP < 0.6 && !s.reduced) {
          // Convergence phase
          const convP = easeOutCubic(clamp01(introP / 0.6));
          const px = lerp(sh.x, sh.targetX, convP);
          const py = lerp(sh.y, sh.targetY, convP);
          drawShard(ctx, px, py, sh.rot, sh.size * lerp(1, 0.3, convP), sh.alpha, emissive);
        } else {
          // Drift phase
          sh.x += sh.vx + stateRef.current.mouseX * -0.3;
          sh.y += sh.vy;
          sh.rot += sh.rotV;
          if (sh.x < -120) sh.x = W + 60;
          if (sh.x > W + 120) sh.x = -60;
          if (sh.y < -120) sh.y = H + 60;
          if (sh.y > H + 120) sh.y = -60;
          drawShard(ctx, sh.x, sh.y, sh.rot, sh.size, sh.alpha, 0);
        }
      }

      // Guide lines during convergence
      if (introP < 0.75 && !s.reduced) {
        const guideAlpha = Math.max(0, 1 - introP / 0.75);
        for (const sh of shards) {
          if (sh.layer !== 0) continue;
          const convP = easeOutCubic(clamp01(introP / 0.6));
          const px = lerp(sh.x, sh.targetX, convP);
          const py = lerp(sh.y, sh.targetY, convP);
          ctx.save();
          ctx.globalAlpha = guideAlpha * 0.3 * convP;
          ctx.strokeStyle = `rgba(217,169,74,1)`;
          ctx.lineWidth = 0.5;
          ctx.setLineDash([3, 8]);
          ctx.beginPath();
          ctx.moveTo(px, py);
          ctx.lineTo(SPHERE_X, SPHERE_Y);
          ctx.stroke();
          ctx.setLineDash([]);
          ctx.restore();
        }
      }

      // Floor
      drawFloor(ctx, W, H);

      // Floor reflection of sphere
      if (introP > 0.5) {
        ctx.save();
        ctx.globalAlpha = Math.min(0.12, (introP - 0.5) * 0.24);
        ctx.scale(1, -0.25);
        ctx.translate(0, -H * 0.78 * 4 - H * 0.22 * 4);
        // Mirror sphere below floor
        ctx.filter = "blur(3px)";
        drawSphere(ctx, SPHERE_X, H * 0.78, s.angle, 0.18, emissive * 0.3);
        ctx.filter = "none";
        ctx.restore();
      }

      // Sphere (appears after intro begins converging)
      const sphereAlpha = s.reduced ? 1 : clamp01((introP - 0.35) / 0.25);
      if (sphereAlpha > 0.01) {
        ctx.save();
        ctx.globalAlpha = sphereAlpha;
        drawSphere(ctx, SPHERE_X, SPHERE_Y, s.angle, 0.22, emissive);
        ctx.restore();
      }

      // Foreground shards
      for (const sh of shards) {
        if (sh.layer !== 1) continue;
        if (introP < 0.8 && !s.reduced) continue; // wait for intro to mostly settle
        sh.x += sh.vx + stateRef.current.mouseX * 0.6;
        sh.y += sh.vy;
        sh.rot += sh.rotV;
        if (sh.x < -160) sh.x = W + 80;
        if (sh.x > W + 160) sh.x = -80;
        if (sh.y < -160) sh.y = H + 80;
        if (sh.y > H + 160) sh.y = -80;
        drawShard(ctx, sh.x, sh.y, sh.rot, sh.size, sh.alpha * 0.65, 0);
      }

      // Ambient gold dust
      if (!s.reduced) {
        for (const p of dustParticles) {
          p.y -= p.speed;
          if (p.y < 0) { p.y = 1; p.x = Math.random(); }
          drawDustParticle(ctx, p.x * W, p.y * H, p.alpha * sphereAlpha);
        }
      }

      // Sparkle decoration (bottom-right)
      const sparkAlpha = clamp01((introP - 0.8) / 0.2);
      if (sparkAlpha > 0.01) {
        const sx = W - 48;
        const sy = H - 48;
        ctx.save();
        ctx.globalAlpha = sparkAlpha * (0.6 + 0.4 * Math.sin(now / 800));
        ctx.strokeStyle = GOLD;
        ctx.lineWidth = 1.5;
        for (let a = 0; a < 4; a++) {
          const angle = (a / 4) * Math.PI;
          ctx.beginPath();
          ctx.moveTo(sx + Math.cos(angle) * 12, sy + Math.sin(angle) * 12);
          ctx.lineTo(sx + Math.cos(angle) * 3, sy + Math.sin(angle) * 3);
          ctx.stroke();
        }
        ctx.restore();
      }

      if (!s.introPlayed && introP >= 1) s.introPlayed = true;

      raf = requestAnimationFrame(draw);
    }

    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.removeEventListener("mousemove", onMouse);
      observer.disconnect();
    };
  }, [init]);

  return (
    <canvas
      ref={canvasRef}
      className="reg-scene-canvas"
      aria-hidden="true"
    />
  );
}
