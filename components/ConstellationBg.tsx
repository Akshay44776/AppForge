"use client";

import { useEffect, useRef, useImperativeHandle, forwardRef } from "react";

type Node = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;      // radius
  baseAlpha: number;
  glow: number;   // 0..1, decays each frame, pushed up by bursts
};

type Edge = {
  a: number; // index into nodes
  b: number;
  glow: number; // 0..1, decays each frame, pushed up by bursts
};

export type ConstellationBgHandle = {
  triggerBurst: (clientX: number, clientY: number) => void;
};

const ACCENT = "217, 169, 84"; // #D9A954 as r,g,b for rgba() strings

const ConstellationBg = forwardRef<ConstellationBgHandle>((_props, ref) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const nodesRef = useRef<Node[]>([]);
  const edgesRef = useRef<Edge[]>([]);
  const rafRef = useRef<number | null>(null);
  const reducedMotionRef = useRef(false);
  const inViewRef = useRef(true);
  const dprRef = useRef(1);
  const pendingBurstRef = useRef<{ x: number; y: number } | null>(null);

  useImperativeHandle(ref, () => ({
    triggerBurst(clientX: number, clientY: number) {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      // convert viewport coords -> canvas-local coords
      const localX = clientX - rect.left;
      const localY = clientY - rect.top;
      pendingBurstRef.current = { x: localX, y: localY };
    },
  }));

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    reducedMotionRef.current = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    const isMobile = () => window.innerWidth < 640;

    function buildNodes() {
      const rect = container!.getBoundingClientRect();
      const count = isMobile() ? 36 : 90;
      const nodes: Node[] = [];
      for (let i = 0; i < count; i++) {
        nodes.push({
          x: Math.random() * rect.width,
          y: Math.random() * rect.height,
          vx: (Math.random() - 0.5) * 0.15,
          vy: (Math.random() - 0.5) * 0.15,
          r: Math.random() * 1.6 + 0.6,
          baseAlpha: Math.random() * 0.5 + 0.25,
          glow: 0,
        });
      }
      nodesRef.current = nodes;

      // build edges: connect each node to its nearest few neighbors within a threshold
      const edges: Edge[] = [];
      const threshold = isMobile() ? 90 : 130;
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = nodes[i].x - nodes[j].x;
          const dy = nodes[i].y - nodes[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < threshold) {
            edges.push({ a: i, b: j, glow: 0 });
          }
        }
      }
      edgesRef.current = edges;
    }

    function resize() {
      const rect = container!.getBoundingClientRect();
      dprRef.current = Math.min(window.devicePixelRatio || 1, 2);
      canvas!.width = rect.width * dprRef.current;
      canvas!.height = rect.height * dprRef.current;
      canvas!.style.width = `${rect.width}px`;
      canvas!.style.height = `${rect.height}px`;
      ctx!.setTransform(dprRef.current, 0, 0, dprRef.current, 0, 0);
      buildNodes();
    }

    resize();
    window.addEventListener("resize", resize);

    const io = new IntersectionObserver(
      (entries) => {
        inViewRef.current = entries[0]?.isIntersecting ?? true;
      },
      { threshold: 0.05 }
    );
    io.observe(container);

    function applyBurst() {
      const burst = pendingBurstRef.current;
      if (!burst) return;
      pendingBurstRef.current = null;

      const nodes = nodesRef.current;
      const edges = edgesRef.current;

      // find nodes within a radius of the burst origin, light them + their edges
      const burstRadius = isMobile() ? 160 : 220;
      const litNodeIdx = new Set<number>();
      nodes.forEach((n, idx) => {
        const dx = n.x - burst.x;
        const dy = n.y - burst.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < burstRadius) {
          const falloff = 1 - dist / burstRadius;
          n.glow = Math.max(n.glow, falloff);
          litNodeIdx.add(idx);
        }
      });
      edges.forEach((e) => {
        if (litNodeIdx.has(e.a) || litNodeIdx.has(e.b)) {
          e.glow = Math.max(e.glow, 0.9);
        }
      });
    }

    function step() {
      const rect = container!.getBoundingClientRect();
      const nodes = nodesRef.current;
      const edges = edgesRef.current;

      ctx!.clearRect(0, 0, rect.width, rect.height);

      if (!reducedMotionRef.current && inViewRef.current) {
        // drift
        nodes.forEach((n) => {
          n.x += n.vx;
          n.y += n.vy;
          if (n.x < 0 || n.x > rect.width) n.vx *= -1;
          if (n.y < 0 || n.y > rect.height) n.vy *= -1;
          n.x = Math.max(0, Math.min(rect.width, n.x));
          n.y = Math.max(0, Math.min(rect.height, n.y));
          n.glow *= 0.965; // decay
        });
        edges.forEach((e) => {
          e.glow *= 0.94; // decay a bit faster than nodes
        });

        applyBurst();

        // occasional ambient pulse even with no click, matching the reference's idle behavior
        if (Math.random() < 0.01 && edges.length) {
          const e = edges[Math.floor(Math.random() * edges.length)];
          e.glow = Math.max(e.glow, 0.6);
        }
      }

      // draw edges
      edges.forEach((e) => {
        const na = nodes[e.a];
        const nb = nodes[e.b];
        if (!na || !nb) return;
        const dx = na.x - nb.x;
        const dy = na.y - nb.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const threshold = isMobile() ? 90 : 130;
        const baseOpacity = Math.max(0, 0.22 * (1 - dist / threshold));
        const opacity = Math.min(1, baseOpacity + e.glow * 0.8);
        if (opacity <= 0.003) return;
        ctx!.strokeStyle = `rgba(${ACCENT}, ${opacity})`;
        ctx!.lineWidth = 1;
        ctx!.beginPath();
        ctx!.moveTo(na.x, na.y);
        ctx!.lineTo(nb.x, nb.y);
        ctx!.stroke();
      });

      // draw nodes
      nodes.forEach((n) => {
        const alpha = Math.min(1, n.baseAlpha + n.glow * 0.9);
        const radius = n.r + n.glow * 1.8;
        ctx!.beginPath();
        ctx!.fillStyle = `rgba(${ACCENT}, ${alpha})`;
        ctx!.arc(n.x, n.y, radius, 0, Math.PI * 2);
        ctx!.fill();

        if (n.glow > 0.05) {
          // soft glow halo for lit nodes
          const grad = ctx!.createRadialGradient(
            n.x,
            n.y,
            0,
            n.x,
            n.y,
            radius * 5
          );
          grad.addColorStop(0, `rgba(${ACCENT}, ${n.glow * 0.35})`);
          grad.addColorStop(1, `rgba(${ACCENT}, 0)`);
          ctx!.beginPath();
          ctx!.fillStyle = grad;
          ctx!.arc(n.x, n.y, radius * 5, 0, Math.PI * 2);
          ctx!.fill();
        }
      });

      rafRef.current = requestAnimationFrame(step);
    }

    if (reducedMotionRef.current) {
      // static single frame, no RAF loop, burst is skipped entirely
      const rect = container.getBoundingClientRect();
      ctx.clearRect(0, 0, rect.width, rect.height);
      edgesRef.current.forEach((e) => {
        const na = nodesRef.current[e.a];
        const nb = nodesRef.current[e.b];
        ctx!.strokeStyle = `rgba(${ACCENT}, 0.15)`;
        ctx!.lineWidth = 1;
        ctx!.beginPath();
        ctx!.moveTo(na.x, na.y);
        ctx!.lineTo(nb.x, nb.y);
        ctx!.stroke();
      });
      nodesRef.current.forEach((n) => {
        ctx!.beginPath();
        ctx!.fillStyle = `rgba(${ACCENT}, ${n.baseAlpha})`;
        ctx!.arc(n.x, n.y, n.r, 0, Math.PI * 2);
        ctx!.fill();
      });
    } else {
      rafRef.current = requestAnimationFrame(step);
    }

    return () => {
      window.removeEventListener("resize", resize);
      io.disconnect();
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return (
    <div
      ref={containerRef}
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 0,
        pointerEvents: "none",
        overflow: "hidden",
      }}
      aria-hidden="true"
    >
      <canvas ref={canvasRef} />
    </div>
  );
});

ConstellationBg.displayName = "ConstellationBg";

export default ConstellationBg;
