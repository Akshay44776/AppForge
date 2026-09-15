"use client";

import { useEffect, useState } from "react";

export default function Countdown({
  to,
  withSeconds = false,
  className = "",
}: {
  to: string;
  withSeconds?: boolean;
  className?: string;
}) {
  const target = new Date(to).getTime();
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

  const cell = (v: number, label: string) => (
    <div className="flex flex-col items-center">
      <span className="font-display text-2xl sm:text-3xl text-paper tabular-nums" suppressHydrationWarning>
        {String(v).padStart(2, "0")}
      </span>
      <span className="text-[11px] uppercase tracking-widest text-muted">{label}</span>
    </div>
  );

  return (
    <div className={`flex items-start gap-5 sm:gap-7 ${className}`} role="timer" aria-live="off">
      {cell(d, "days")}
      <span className="font-display text-2xl text-gold" aria-hidden>:</span>
      {cell(h, "hours")}
      <span className="font-display text-2xl text-gold" aria-hidden>:</span>
      {cell(m, "min")}
      {withSeconds && (
        <>
          <span className="font-display text-2xl text-gold" aria-hidden>:</span>
          {cell(s, "sec")}
        </>
      )}
    </div>
  );
}
