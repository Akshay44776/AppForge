"use client";

import { useEffect, useState } from "react";
import FlipDigit from "./FlipDigit";
import { EVENT_DATE } from "@/lib/site";

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function FlipNumber({ value }: { value: string }) {
  return (
    <span className="reg-flip-number">
      {value.split("").map((ch, i) => (
        <FlipDigit key={i} value={ch} />
      ))}
    </span>
  );
}

export default function RegisterCountdown() {
  const target = new Date(EVENT_DATE).getTime();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const diff = Math.max(0, target - now);
  const d = Math.floor(diff / 86400000);
  const h = Math.floor((diff % 86400000) / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const s = Math.floor((diff % 60000) / 1000);

  return (
    <div className="reg-countdown-wrap">
      {/* Rotating gold ring */}
      <div className="reg-ring-outer" aria-hidden="true">
        <svg className="reg-ring-svg" viewBox="0 0 200 200">
          <circle className="reg-ring-track" cx="100" cy="100" r="92" />
          <circle className="reg-ring-comet" cx="100" cy="100" r="92" />
        </svg>
      </div>

      <div className="reg-countdown-card">
        <p className="reg-countdown-label">Build day in</p>
        <div
          className="reg-countdown-digits"
          role="timer"
          aria-live="off"
          suppressHydrationWarning
        >
          <div className="reg-digit-group">
            <FlipNumber value={pad(d)} />
            <span className="reg-digit-label">D</span>
          </div>
          <span className="reg-digit-sep">:</span>
          <div className="reg-digit-group">
            <FlipNumber value={pad(h)} />
            <span className="reg-digit-label">H</span>
          </div>
          <span className="reg-digit-sep">:</span>
          <div className="reg-digit-group">
            <FlipNumber value={pad(m)} />
            <span className="reg-digit-label">M</span>
          </div>
          <span className="reg-digit-sep">:</span>
          <div className="reg-digit-group">
            <FlipNumber value={pad(s)} />
            <span className="reg-digit-label">S</span>
          </div>
        </div>
        <p className="reg-countdown-date">Oct 30, 2026 · 09:00 IST · On campus</p>
      </div>
    </div>
  );
}
