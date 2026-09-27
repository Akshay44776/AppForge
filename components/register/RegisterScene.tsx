"use client";

import { useEffect, useRef } from "react";

// ---- Icosphere geometry ----
function buildIcosphere(): number[][] {
  const t = (1 + Math.sqrt(5)) / 2;
  const verts: number[][] = [
    [-1, t, 0], [1, t, 0], [-1, -t, 0], [1, -t, 0],
    [0, -1, t], [0, 1, t], [0, -1, -t], [0, 1, -t],
    [t, 0, -1], [t, 0, 1], [-t, 0, -1], [-t, 0, 1],
  ];
  const norm = verts.map(([x, y, z]) => {
    const l = Math.sqrt(x * x + y * y + z * z);
    return [x / l, y / l, z / l];
  });
  const faces = [
    [0,11,5],[0,5,1],[0,1,7],[0,7,10],[0,10,11],
    [1,5,9],[5,11,4],[11,10,2],[10,7,6],[7,1,8],
    [3,9,4],[3,4,2],[3,2,6],[3,6,8],[3,8,9],
    [4,9,5],[2,4,11],[6,2,10],[8,6,7],[9,8,1],
  ];
  return faces.map(([a, b, c]) => [...norm[a], ...norm[b], ...norm[c]]);
}

const ICO = buildIcosphere();

function rotY(x: number, y: number, z: number, a: number) {
  return { x: x * Math.cos(a) + z * Math.sin(a), y, z: -x * Math.sin(a) + z * Math.cos(a) };
}
function rotX(x: number, y: number, z: number, a: number) {
  return { x, y: y * Math.cos(a) - z * Math.sin(a), z: y * Math.sin(a) + z * Math.cos(a) };
}

function easeOutCubic(t: number) { return 1 - Math.pow(1 - t, 3); }
function easeInOut(t: number) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; }
function clamp(t: number, a = 0, b = 1) { return t < a ? a : t > b ? b : t; }
function lerp(a: number, b: number, t: number) { return a + (b - a) * t; }

export default function RegisterScene() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef({
    angle: 0,
    tiltX: 0.22,
    pulsePhase: 0,
    mouseX: 0,
    mouseY: 0,
    introStart: -1,
    reduced: false,
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let raf = 0;
    let alive = true;
    let prevTime = 0;

    const s = stateRef.current;
    s.reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // Shard field
    interface Shard {
      x: number; y: number;
      vx: number; vy: number;
      rot: number; rv: number;
      size: number; alpha: number;
      layer: 0 | 1;
      startX: number; startY: number;
      tx: number; ty: number; // target on sphere surface
    }
    let shards: Shard[] = [];

    function initShards(W: number, H: number, sphereX: number, sphereY: number, R: number) {
      shards = [];
      // Build target positions: vertices on projected sphere
      const targets: { x: number; y: number }[] = ICO.map((f) => {
        const ry = rotY(f[0], f[1], f[2], 0.6);
        const rx = rotX(ry.x, ry.y, ry.z, 0.3);
        const sc = 600 / (600 + rx.z * R);
        return { x: sphereX + rx.x * R * sc, y: sphereY + rx.y * R * sc };
      });

      const count = s.reduced ? 12 : 38;
      for (let i = 0; i < count; i++) {
        const layer: 0 | 1 = i < count * 0.7 ? 0 : 1;
        const angle = Math.random() * Math.PI * 2;
        const dist = W * 0.35 + Math.random() * W * 0.25;
        const tx = targets[i % targets.length]?.x ?? sphereX;
        const ty = targets[i % targets.length]?.y ?? sphereY;
        shards.push({
          x: sphereX + Math.cos(angle) * dist,
          y: sphereY + Math.sin(angle) * dist,
          startX: sphereX + Math.cos(angle) * dist,
          startY: sphereY + Math.sin(angle) * dist,
          vx: (Math.random() - 0.5) * (layer === 0 ? 0.18 : 0.3),
          vy: (Math.random() - 0.5) * (layer === 0 ? 0.12 : 0.22),
          rot: Math.random() * Math.PI * 2,
          rv: (Math.random() - 0.5) * 0.004,
          size: layer === 0 ? 10 + Math.random() * 28 : 28 + Math.random() * 55,
          alpha: layer === 0 ? 0.07 + Math.random() * 0.12 : 0.04 + Math.random() * 0.06,
          layer,
          tx, ty,
        });
      }
    }

    function resize() {
      const parent = canvas!.parentElement!;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas!.width = Math.round(parent.clientWidth * dpr);
      canvas!.height = Math.round(parent.clientHeight * dpr);
      canvas!.style.width = parent.clientWidth + "px";
      canvas!.style.height = parent.clientHeight + "px";
      const W = canvas!.width, H = canvas!.height;
      const sphereX = W * 0.50;
      const sphereY = H * 0.50;
      const R = Math.min(W, H) * 0.26;
      initShards(W, H, sphereX, sphereY, R);
    }
    resize();
    window.addEventListener("resize", resize);

    const onMouse = (e: MouseEvent) => {
      const r = canvas!.getBoundingClientRect();
      s.mouseX = ((e.clientX - r.left) / r.width - 0.5);
      s.mouseY = ((e.clientY - r.top) / r.height - 0.5);
    };
    window.addEventListener("mousemove", onMouse);

    // Trigger intro when section enters view
    const io = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && s.introStart < 0) {
        s.introStart = performance.now();
        if (!raf) raf = requestAnimationFrame(draw);
      } else if (!entry.isIntersecting) {
        cancelAnimationFrame(raf);
        raf = 0;
      }
    }, { threshold: 0.05 });
    io.observe(canvas!.parentElement!);

    // Start immediately if already visible
    s.introStart = performance.now();
    raf = requestAnimationFrame(draw);

    function drawShard(ctx: CanvasRenderingContext2D, x: number, y: number, rot: number, size: number, alpha: number) {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(rot);
      ctx.globalAlpha = alpha;
      ctx.beginPath();
      ctx.moveTo(0, -size);
      ctx.lineTo(size * 0.58, size * 0.55);
      ctx.lineTo(-size * 0.58, size * 0.55);
      ctx.closePath();
      ctx.fillStyle = "rgba(8,9,14,0.88)";
      ctx.fill();
      ctx.strokeStyle = "rgba(217,169,74,0.22)";
      ctx.lineWidth = 0.8;
      ctx.stroke();
      ctx.restore();
    }

    function drawSphere(ctx: CanvasRenderingContext2D, cx: number, cy: number, R: number, angleY: number, tiltX: number, emissive: number) {
      const FOV = 600;

      const projected = ICO.map((f) => {
        const r0 = rotY(f[0], f[1], f[2], angleY);
        const v0 = rotX(r0.x, r0.y, r0.z, tiltX);
        const r1 = rotY(f[3], f[4], f[5], angleY);
        const v1 = rotX(r1.x, r1.y, r1.z, tiltX);
        const r2 = rotY(f[6], f[7], f[8], angleY);
        const v2 = rotX(r2.x, r2.y, r2.z, tiltX);

        const avgZ = (v0.z + v1.z + v2.z) / 3;
        const sc0 = FOV / (FOV + v0.z * R); const p0 = { x: cx + v0.x * R * sc0, y: cy + v0.y * R * sc0 };
        const sc1 = FOV / (FOV + v1.z * R); const p1 = { x: cx + v1.x * R * sc1, y: cy + v1.y * R * sc1 };
        const sc2 = FOV / (FOV + v2.z * R); const p2 = { x: cx + v2.x * R * sc2, y: cy + v2.y * R * sc2 };

        // Lighting normal
        const ax = v1.x - v0.x, ay = v1.y - v0.y, az = v1.z - v0.z;
        const bx = v2.x - v0.x, by = v2.y - v0.y, bz = v2.z - v0.z;
        const nx = ay * bz - az * by, ny = az * bx - ax * bz, nz = ax * by - ay * bx;
        const nl = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;
        const dot = Math.max(0, (nx / nl * 0.4 + ny / nl * -0.3 + nz / nl * 0.86));
        return { p0, p1, p2, avgZ, dot };
      });

      // Painter's sort
      projected.sort((a, b) => b.avgZ - a.avgZ);

      for (const { p0, p1, p2, avgZ, dot } of projected) {
        // Only draw front-facing (avgZ < 0 means facing camera in our coordinate space)
        if (avgZ > 0.35) continue;

        ctx.save();
        ctx.beginPath();
        ctx.moveTo(p0.x, p0.y);
        ctx.lineTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.closePath();

        // Facet fill: dark obsidian
        const darkness = 0.12 + dot * 0.15;
        ctx.fillStyle = `rgba(${Math.round(8 + darkness * 30)},${Math.round(9 + darkness * 25)},${Math.round(14 + darkness * 30)},0.94)`;
        ctx.fill();

        // Emissive gold bleed through facets
        if (emissive > 0.04) {
          ctx.globalCompositeOperation = "lighter";
          ctx.fillStyle = `rgba(217,140,40,${emissive * dot * 0.4})`;
          ctx.fill();
          ctx.globalCompositeOperation = "source-over";
        }

        // Edge seams — gold
        ctx.strokeStyle = `rgba(217,169,74,${0.25 + emissive * 0.55 + dot * 0.12})`;
        ctx.lineWidth = 0.9;
        ctx.lineJoin = "round";
        ctx.stroke();
        ctx.restore();
      }

      // Inner core glow
      if (emissive > 0.02) {
        const grd = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * 0.75);
        grd.addColorStop(0, `rgba(244,200,98,${emissive * 0.6})`);
        grd.addColorStop(0.4, `rgba(217,140,50,${emissive * 0.25})`);
        grd.addColorStop(1, "transparent");
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        ctx.beginPath();
        ctx.arc(cx, cy, R * 0.75, 0, Math.PI * 2);
        ctx.fillStyle = grd;
        ctx.fill();
        ctx.restore();
      }

      // Outer ambient glow halo
      const halo = ctx.createRadialGradient(cx, cy, R * 0.6, cx, cy, R * 1.4);
      halo.addColorStop(0, `rgba(217,169,74,${0.04 + emissive * 0.08})`);
      halo.addColorStop(1, "transparent");
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      ctx.beginPath();
      ctx.arc(cx, cy, R * 1.4, 0, Math.PI * 2);
      ctx.fillStyle = halo;
      ctx.fill();
      ctx.restore();
    }

    const dustParticles = Array.from({ length: s.reduced ? 0 : 35 }, () => ({
      x: Math.random(), y: Math.random(),
      spd: 0.00015 + Math.random() * 0.00025,
      alpha: 0.08 + Math.random() * 0.18,
    }));

    function draw(now: number) {
      if (!alive) return;
      const dt = Math.min((now - (prevTime || now)) / 1000, 0.05);
      prevTime = now;

      const W = canvas!.width, H = canvas!.height;
      const ctx = canvas!.getContext("2d")!;

      ctx.clearRect(0, 0, W, H);

      // Dark bg gradient
      const bg = ctx.createLinearGradient(0, 0, 0, H);
      bg.addColorStop(0, "#060809");
      bg.addColorStop(1, "#08090f");
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, H);

      const elapsed = now - (s.introStart > 0 ? s.introStart : now);
      const INTRO_DUR = 5000;
      const introP = s.reduced ? 1 : clamp(elapsed / INTRO_DUR);

      // Emissive curve: peaks at ~50-65% of intro, settles to ambient pulse
      let emissive: number;
      if (introP < 0.5) emissive = easeOutCubic(introP / 0.5) * 0.45;
      else if (introP < 0.72) emissive = 0.45 + easeInOut((introP - 0.5) / 0.22) * 0.55;
      else emissive = 1.0 - easeOutCubic((introP - 0.72) / 0.28) * 0.82;
      if (introP >= 1) {
        s.pulsePhase += dt * (Math.PI * 2 / 5);
        emissive = 0.16 + Math.sin(s.pulsePhase) * 0.06;
      }

      s.angle += dt * 0.042;
      const sphereX = W * 0.50 + s.mouseX * W * -0.012;
      const sphereY = H * 0.50 + s.mouseY * H * -0.009;
      const R = Math.min(W, H) * 0.26;

      // God ray from top-right
      const rayAlpha = clamp(elapsed / 8000) * 0.18;
      const grd = ctx.createLinearGradient(W, 0, W * 0.1, H * 0.8);
      grd.addColorStop(0, `rgba(244,200,98,${rayAlpha})`);
      grd.addColorStop(0.35, `rgba(217,140,50,${rayAlpha * 0.45})`);
      grd.addColorStop(1, "transparent");
      ctx.fillStyle = grd;
      ctx.fillRect(0, 0, W, H);

      // Background shards — converge during intro
      const convP = easeOutCubic(clamp(introP / 0.65));
      for (const sh of shards) {
        if (sh.layer !== 0) continue;
        let sx: number, sy: number;
        if (introP < 1 && !s.reduced) {
          sx = lerp(sh.startX, sh.tx, convP);
          sy = lerp(sh.startY, sh.ty, convP);
        } else {
          sh.x += sh.vx + s.mouseX * -0.25;
          sh.y += sh.vy;
          sh.rot += sh.rv;
          if (sh.x < -100) sh.x = W + 50; if (sh.x > W + 100) sh.x = -50;
          if (sh.y < -100) sh.y = H + 50; if (sh.y > H + 100) sh.y = -50;
          sx = sh.x; sy = sh.y;
        }
        drawShard(ctx, sx, sy, sh.rot, sh.size, sh.alpha);
      }

      // Guide lines
      if (introP < 0.8 && !s.reduced) {
        const gAlpha = Math.max(0, (1 - introP / 0.8)) * 0.35 * convP;
        for (const sh of shards) {
          if (sh.layer !== 0) continue;
          const sx = lerp(sh.startX, sh.tx, convP);
          const sy = lerp(sh.startY, sh.ty, convP);
          ctx.save();
          ctx.globalAlpha = gAlpha;
          ctx.strokeStyle = "rgba(217,169,74,0.8)";
          ctx.lineWidth = 0.5;
          ctx.setLineDash([2, 10]);
          ctx.beginPath();
          ctx.moveTo(sx, sy);
          ctx.lineTo(sphereX, sphereY);
          ctx.stroke();
          ctx.setLineDash([]);
          ctx.restore();
        }
      }

      // Floor reflection
      const floorY = H * 0.78;
      const floorGrd = ctx.createLinearGradient(0, floorY, 0, H);
      floorGrd.addColorStop(0, "rgba(6,8,9,0)");
      floorGrd.addColorStop(0.25, "rgba(6,8,9,0.7)");
      floorGrd.addColorStop(1, "rgba(5,7,8,0.98)");
      ctx.fillStyle = floorGrd;
      ctx.fillRect(0, floorY, W, H - floorY);

      // Mirror sphere
      if (introP > 0.5) {
        ctx.save();
        ctx.globalAlpha = Math.min(0.1, (introP - 0.5) * 0.2);
        ctx.scale(1, -0.2);
        ctx.translate(0, -(floorY) * 2 / 0.2 - 0);
        ctx.filter = "blur(2px)";
        drawSphere(ctx, sphereX, floorY, R, s.angle, s.tiltX, emissive * 0.4);
        ctx.filter = "none";
        ctx.restore();
      }

      // === SPHERE ===
      drawSphere(ctx, sphereX, sphereY, R, s.angle, s.tiltX, emissive);

      // Foreground shards
      for (const sh of shards) {
        if (sh.layer !== 1) continue;
        if (introP < 0.75 && !s.reduced) continue;
        sh.x += sh.vx + s.mouseX * 0.55;
        sh.y += sh.vy;
        sh.rot += sh.rv;
        if (sh.x < -160) sh.x = W + 80; if (sh.x > W + 160) sh.x = -80;
        if (sh.y < -160) sh.y = H + 80; if (sh.y > H + 160) sh.y = -80;
        drawShard(ctx, sh.x, sh.y, sh.rot, sh.size, sh.alpha * 0.6);
      }

      // Gold dust
      for (const p of dustParticles) {
        p.y -= p.spd;
        if (p.y < 0) { p.y = 1; p.x = Math.random(); }
        ctx.save();
        ctx.globalAlpha = p.alpha * clamp(introP * 2);
        ctx.fillStyle = "#d9a94a";
        ctx.beginPath();
        ctx.arc(p.x * W, p.y * H, 0.9, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // Sparkle
      const sparkA = clamp((introP - 0.85) / 0.15);
      if (sparkA > 0.01) {
        const sx = W - W * 0.08, sy = H - H * 0.12;
        ctx.save();
        ctx.globalAlpha = sparkA * (0.55 + 0.45 * Math.sin(now / 900));
        ctx.strokeStyle = "#d9a94a";
        ctx.lineWidth = 1.5;
        ctx.lineCap = "round";
        for (let a = 0; a < 4; a++) {
          const ang = (a / 4) * Math.PI;
          ctx.beginPath();
          ctx.moveTo(sx + Math.cos(ang) * 13, sy + Math.sin(ang) * 13);
          ctx.lineTo(sx + Math.cos(ang) * 4, sy + Math.sin(ang) * 4);
          ctx.stroke();
        }
        ctx.restore();
      }

      raf = requestAnimationFrame(draw);
    }

    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.removeEventListener("mousemove", onMouse);
      io.disconnect();
    };
  }, []);

  return <canvas ref={canvasRef} className="reg-scene-canvas" aria-hidden="true" />;
}
