"use client";

import { useEffect, useRef, useState } from "react";

const GLYPHS = "!@#$%^&*<>?/|abcdefABCDEF0123456789";

function scramble(
  target: string,
  progress: number // 0..1
): string {
  return target
    .split("")
    .map((ch, i) => {
      if (ch === " ") return " ";
      const charThreshold = (i + 1) / target.length;
      if (progress >= charThreshold) return ch;
      return GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
    })
    .join("");
}

interface InfoTagProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  delay?: number; // ms
}

export default function InfoTag({ icon, label, value, delay = 0 }: InfoTagProps) {
  const [displayLabel, setDisplayLabel] = useState("        ");
  const [displayValue, setDisplayValue] = useState("        ");
  const [visible, setVisible] = useState(false);
  const rafRef = useRef<number>(0);
  const startRef = useRef<number>(0);
  const DURATION = 600;

  const tagRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = tagRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          io.disconnect();
          setTimeout(() => {
            setVisible(true);
            startRef.current = performance.now();
            const animate = (now: number) => {
              const elapsed = now - startRef.current;
              const p = Math.min(1, elapsed / DURATION);
              setDisplayLabel(scramble(label, p));
              setDisplayValue(scramble(value, p));
              if (p < 1) {
                rafRef.current = requestAnimationFrame(animate);
              } else {
                setDisplayLabel(label);
                setDisplayValue(value);
              }
            };
            rafRef.current = requestAnimationFrame(animate);
          }, delay);
        }
      },
      { rootMargin: "0px 0px -10% 0px" }
    );
    io.observe(el);
    return () => {
      io.disconnect();
      cancelAnimationFrame(rafRef.current);
    };
  }, [label, value, delay]);

  return (
    <div
      ref={tagRef}
      className={`reg-info-tag ${visible ? "reg-info-tag--visible" : ""}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {/* Pentagon/shield clip-path shape via CSS */}
      <div className="reg-info-tag-inner">
        <div className="reg-info-tag-icon">{icon}</div>
        <div className="reg-info-tag-content">
          <span className="reg-info-tag-label">{displayLabel}</span>
          <span className="reg-info-tag-value">{displayValue}</span>
        </div>
      </div>
      {/* leader line connecting tag to sphere area */}
      <div className="reg-info-tag-line" aria-hidden="true" />
    </div>
  );
}
