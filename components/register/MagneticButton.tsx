"use client";

import { useEffect, useRef } from "react";
import { REGISTRATION_URL } from "@/lib/site";

export default function MagneticButton() {
  const btnRef = useRef<HTMLAnchorElement>(null);
  const rafRef = useRef<number>(0);
  const targetRef = useRef({ x: 0, y: 0 });
  const currentRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const btn = btnRef.current;
    if (!btn) return;

    // §9 of the brief — reduced motion keeps the CTA fully functional and its
    // hover/focus glow (plain CSS, no continuous loop), just drops the pull.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const RADIUS = 56;
    const STRENGTH = 0.38;

    const onMove = (e: MouseEvent) => {
      const rect = btn.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dx = e.clientX - cx;
      const dy = e.clientY - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < RADIUS) {
        targetRef.current = { x: dx * STRENGTH, y: dy * STRENGTH };
      } else {
        targetRef.current = { x: 0, y: 0 };
      }
    };

    const onLeave = () => {
      targetRef.current = { x: 0, y: 0 };
    };

    const loop = () => {
      const { x: tx, y: ty } = targetRef.current;
      const { x: cx, y: cy } = currentRef.current;
      const nx = cx + (tx - cx) * 0.12;
      const ny = cy + (ty - cy) * 0.12;
      currentRef.current = { x: nx, y: ny };
      if (btn) btn.style.transform = `translate(${nx.toFixed(2)}px, ${ny.toFixed(2)}px)`;
      rafRef.current = requestAnimationFrame(loop);
    };

    document.addEventListener("mousemove", onMove);
    btn.addEventListener("mouseleave", onLeave);
    rafRef.current = requestAnimationFrame(loop);

    return () => {
      document.removeEventListener("mousemove", onMove);
      btn.removeEventListener("mouseleave", onLeave);
      cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return (
    <a
      ref={btnRef}
      href={REGISTRATION_URL}
      target="_blank"
      rel="noopener noreferrer"
      className="reg-cta-btn"
    >
      <span className="reg-cta-text">Register your team</span>
      <span className="reg-cta-arrow" aria-hidden="true">→</span>
    </a>
  );
}
