"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const FRAME_COUNT = 300;

const BEATS = [
  "Every build starts scattered — an idea on one screen, a sketch on another.",
  "Teams wire the pieces together — design, front end and back end start talking to each other.",
  "What ships by demo time takes shape before your eyes.",
  "This is AppForge. Build something that wins.",
];

function beatOpacity(i: number, p: number) {
  const q = i / 4;
  const fade = 0.06;
  const inO = Math.min(1, Math.max(0, (p - q) / fade));
  const outO = Math.min(1, Math.max(0, (q + 0.25 - p) / fade));
  return Math.min(inO, outO);
}

export default function ScrollScrubHero() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const framesRef = useRef<HTMLImageElement[]>([]);
  const progressRef = useRef(0);
  const [loaded, setLoaded] = useState(0);
  const [ready, setReady] = useState(false);
  const [progress, setProgress] = useState(0);
  const [reduced, setReduced] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const mm = window.matchMedia("(max-width: 640px)");
    setReduced(mq.matches);
    setIsMobile(mm.matches);
    const onMq = () => setReduced(mq.matches);
    const onMm = () => setMmMobile(mm.matches);
    function setMmMobile(v: boolean) { setIsMobile(v); }
    mq.addEventListener("change", onMq);
    mm.addEventListener("change", onMm);
    return () => { mq.removeEventListener("change", onMq); mm.removeEventListener("change", onMm); };
  }, []);

  const draw = useCallback((idx: number) => {
    const canvas = canvasRef.current;
    const img = framesRef.current[idx];
    if (!canvas || !img || !img.complete || !img.naturalWidth) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const s = Math.min(w / img.naturalWidth, h / img.naturalHeight);
    const dw = img.naturalWidth * s * dpr;
    const dh = img.naturalHeight * s * dpr;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, (canvas.width - dw) / 2, (canvas.height - dh) / 2, dw, dh);
  }, []);

  // Preload frames, gated by IntersectionObserver (rootMargin 200%)
  useEffect(() => {
    if (reduced) return;
    const wrap = wrapRef.current;
    if (!wrap) return;
    let started = false;
    const start = () => {
      if (started) return;
      started = true;
      const frames: HTMLImageElement[] = new Array(FRAME_COUNT);
      let count = 0;
      for (let i = 0; i < FRAME_COUNT; i++) {
        const img = new Image();
        frames[i] = img;
        img.onload = img.onerror = () => {
          count += 1;
          setLoaded(count);
          if (count >= 90) setReady(true); // ~30%
        };
        img.src = `/frames/frame_${String(i + 1).padStart(3, "0")}.jpg`;
      }
      framesRef.current = frames;
    };
    const io = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) { start(); io.disconnect(); }
    }, { rootMargin: "200% 0px" });
    io.observe(wrap);
    return () => io.disconnect();
  }, [reduced]);

  // rAF scroll loop with passive scroll semantics (progress from wrapper rect)
  useEffect(() => {
    if (reduced || !ready) return;
    let raf = 0;
    const loop = () => {
      const wrap = wrapRef.current;
      if (wrap) {
        const rect = wrap.getBoundingClientRect();
        const total = rect.height - window.innerHeight;
        const p = Math.min(1, Math.max(0, -rect.top / Math.max(total, 1)));
        if (p !== progressRef.current) {
          progressRef.current = p;
          setProgress(p);
          draw(Math.min(FRAME_COUNT - 1, Math.floor(p * (FRAME_COUNT - 1))));
        }
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    const onResize = () => draw(Math.floor(progressRef.current * (FRAME_COUNT - 1)));
    window.addEventListener("resize", onResize);
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", onResize); };
  }, [reduced, ready, draw]);

  // Static fallback for reduced motion
  if (reduced) {
    return (
      <section id="teaser" className="relative">
        <img
          src="/frames/frame_225.jpg"
          alt="AppForge brand animation still"
          className="w-full h-[70vh] object-cover"
        />
        <div className="wrap py-16">
          <p className="font-display text-xl sm:text-2xl text-paper max-w-2xl">{BEATS[3]}</p>
        </div>
      </section>
    );
  }

  return (
    <section id="teaser" ref={wrapRef} style={{ height: "560vh" }}
             className="relative">
      <div className="sticky top-0 h-[100dvh] overflow-hidden bg-ink">
        <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" aria-hidden />
        {!ready && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-ink">
            <div className="w-56 h-[3px] bg-surface2 rounded overflow-hidden">
              <div className="h-full bg-gold transition-all" style={{ width: `${(loaded / FRAME_COUNT) * 100}%` }} />
            </div>
            <p className="text-xs text-muted tracking-widest uppercase">
              Loading frames {loaded}/{FRAME_COUNT}
            </p>
          </div>
        )}
        {BEATS.map((text, i) => (
          <p
            key={i}
            className="absolute inset-x-0 top-1/2 -translate-y-1/2 px-6 text-center font-display text-xl sm:text-3xl text-paper max-w-3xl mx-auto pointer-events-none"
            style={{ opacity: beatOpacity(i, progress), transition: "opacity 150ms linear" }}
            aria-hidden={beatOpacity(i, progress) < 0.05}
          >
            <span className="text-gold mr-3">0{i + 1}</span>
            {text}
          </p>
        ))}
      </div>
    </section>
  );
}
