"use client";

import { useEffect, useRef } from "react";

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

export default function RegisterScene() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef({
    angle: 0,
    mouseX: 0,
    mouseY: 0,
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let raf = 0;
    let alive = true;
    let prevTime = 0;

    interface Dust {
      x: number; y: number;
      s: number; a: number;
    }
    const dusts: Dust[] = Array.from({ length: 120 }).map(() => ({
      x: Math.random(),
      y: Math.random(),
      s: 0.1 + Math.random() * 0.2,
      a: Math.random(),
    }));

    const bgTriangles = Array.from({ length: 20 }).map(() => ({
      x: Math.random(),
      y: Math.random(),
      size: 4 + Math.random() * 12,
      rot: Math.random() * Math.PI * 2,
      rv: (Math.random() - 0.5) * 0.01,
      speed: (Math.random() - 0.5) * 0.15,
    }));

    function resize() {
      const parent = canvas!.parentElement!;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas!.width = Math.round(parent.clientWidth * dpr);
      canvas!.height = Math.round(parent.clientHeight * dpr);
      canvas!.style.width = parent.clientWidth + "px";
      canvas!.style.height = parent.clientHeight + "px";
    }
    resize();
    window.addEventListener("resize", resize);

    const onMouse = (e: MouseEvent) => {
      const r = canvas!.getBoundingClientRect();
      stateRef.current.mouseX = ((e.clientX - r.left) / r.width - 0.5);
      stateRef.current.mouseY = ((e.clientY - r.top) / r.height - 0.5);
    };
    window.addEventListener("mousemove", onMouse);

    function drawSphereWireframe(ctx: CanvasRenderingContext2D, cx: number, cy: number, R: number, angle: number) {
      const FOV = 600;

      // Draw connective lines from tags (center column) to sphere
      const W = canvas!.width;
      const tagsX = W * 0.5; // Roughly where tags end
      
      ctx.save();
      ctx.strokeStyle = "rgba(217, 169, 74, 0.2)";
      ctx.lineWidth = 1;
      
      const targetNodes = [
        { x: cx - R*0.5, y: cy - R*0.5 },
        { x: cx - R*0.2, y: cy - R*0.1 },
        { x: cx - R*0.6, y: cy + R*0.3 },
        { x: cx - R*0.3, y: cy + R*0.6 },
      ];
      
      [0, 1, 2, 3].forEach(i => {
        const ty = cy - 130 + i * 85;
        ctx.beginPath();
        ctx.moveTo(tagsX, ty);
        ctx.lineTo(targetNodes[i].x, targetNodes[i].y);
        ctx.stroke();
      });
      ctx.restore();

      const projected = ICO.map((f) => {
        const r0 = rotY(f[0], f[1], f[2], angle * 0.5);
        const v0 = rotX(r0.x, r0.y, r0.z, 0.2 + angle * 0.2);
        const r1 = rotY(f[3], f[4], f[5], angle * 0.5);
        const v1 = rotX(r1.x, r1.y, r1.z, 0.2 + angle * 0.2);
        const r2 = rotY(f[6], f[7], f[8], angle * 0.5);
        const v2 = rotX(r2.x, r2.y, r2.z, 0.2 + angle * 0.2);

        const avgZ = (v0.z + v1.z + v2.z) / 3;
        const sc0 = FOV / (FOV + v0.z * R); const p0 = { x: cx + v0.x * R * sc0, y: cy + v0.y * R * sc0 };
        const sc1 = FOV / (FOV + v1.z * R); const p1 = { x: cx + v1.x * R * sc1, y: cy + v1.y * R * sc1 };
        const sc2 = FOV / (FOV + v2.z * R); const p2 = { x: cx + v2.x * R * sc2, y: cy + v2.y * R * sc2 };

        return { p0, p1, p2, avgZ };
      });

      projected.sort((a, b) => b.avgZ - a.avgZ);

      ctx.strokeStyle = "rgba(217, 169, 74, 0.1)";
      ctx.lineWidth = 0.5;
      for (const { p0, p1, p2 } of projected) {
        ctx.beginPath();
        ctx.moveTo(p0.x, p0.y);
        ctx.lineTo(cx, cy);
        ctx.stroke();
      }

      for (const { p0, p1, p2, avgZ } of projected) {
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(p0.x, p0.y);
        ctx.lineTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.closePath();

        if (avgZ < 0.2) {
          ctx.strokeStyle = "rgba(217, 169, 74, 0.3)";
          ctx.lineWidth = 1;
        } else {
          ctx.strokeStyle = "rgba(217, 169, 74, 0.05)";
          ctx.lineWidth = 0.5;
        }
        ctx.stroke();
        ctx.restore();
      }
    }

    function draw(now: number) {
      if (!alive) return;
      const dt = Math.min((now - (prevTime || now)) / 1000, 0.05);
      prevTime = now;

      const W = canvas!.width, H = canvas!.height;
      const ctx = canvas!.getContext("2d")!;

      ctx.clearRect(0, 0, W, H);

      const bg = ctx.createLinearGradient(0, 0, 0, H);
      bg.addColorStop(0, "#080a0f");
      bg.addColorStop(1, "#0a0c12");
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, H);

      stateRef.current.angle += dt * 0.1;
      const s = stateRef.current;
      const cx = W * 0.55 + s.mouseX * W * -0.02; // Offset slightly right to balance layout
      const cy = H * 0.50 + s.mouseY * H * -0.02;
      const R = Math.min(W, H) * 0.35;

      ctx.fillStyle = "rgba(217, 169, 74, 0.5)";
      for (const d of dusts) {
        d.x -= (d.s * 0.005) + (s.mouseX * 0.001);
        if (d.x < 0) d.x = 1;
        if (d.x > 1) d.x = 0;
        
        ctx.globalAlpha = 0.1 + Math.sin(now * 0.001 + d.a * 10) * 0.1;
        ctx.beginPath();
        ctx.arc(d.x * W, d.y * H, 0.8, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      ctx.strokeStyle = "rgba(217, 169, 74, 0.15)";
      ctx.lineWidth = 1;
      for (const tri of bgTriangles) {
        tri.x -= (tri.speed) + (s.mouseX * 0.5);
        tri.rot += tri.rv;
        if (tri.x < -0.1) tri.x = 1.1;
        if (tri.x > 1.1) tri.x = -0.1;
        
        ctx.save();
        ctx.translate(tri.x * W, tri.y * H);
        ctx.rotate(tri.rot);
        ctx.beginPath();
        ctx.moveTo(0, -tri.size);
        ctx.lineTo(tri.size * 0.8, tri.size * 0.5);
        ctx.lineTo(-tri.size * 0.8, tri.size * 0.5);
        ctx.closePath();
        ctx.stroke();
        ctx.restore();
      }

      drawSphereWireframe(ctx, cx, cy, R, s.angle);

      const halo = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * 1.5);
      halo.addColorStop(0, `rgba(217,169,74,0.08)`);
      halo.addColorStop(1, "transparent");
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      ctx.beginPath();
      ctx.arc(cx, cy, R * 1.5, 0, Math.PI * 2);
      ctx.fillStyle = halo;
      ctx.fill();
      ctx.restore();

      const floorY = H * 0.85;
      const floorGrd = ctx.createLinearGradient(0, floorY, 0, H);
      floorGrd.addColorStop(0, "rgba(217,169,74,0.0)");
      floorGrd.addColorStop(0.1, "rgba(217,169,74,0.15)");
      floorGrd.addColorStop(1, "rgba(0,0,0,0.8)");
      ctx.fillStyle = floorGrd;
      ctx.fillRect(0, floorY, W, H - floorY);

      raf = requestAnimationFrame(draw);
    }

    raf = requestAnimationFrame(draw);

    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.removeEventListener("mousemove", onMouse);
    };
  }, []);

  return <canvas ref={canvasRef} className="reg-scene-canvas" aria-hidden="true" />;
}
