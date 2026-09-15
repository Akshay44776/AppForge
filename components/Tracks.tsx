"use client";

import { useEffect, useState } from "react";
import Countdown from "./Countdown";
import BlueprintBackground from "./BlueprintBackground";
import { EVENT_DATE } from "@/lib/site";

function Dossier({
  index,
  sealed = true,
  title = "",
  body = "",
}: {
  index: number;
  sealed?: boolean;
  title?: string;
  body?: string;
}) {
  const [phase, setPhase] = useState<"locked" | "unsealing" | "open">("locked");

  useEffect(() => {
    if (!sealed && phase === "locked") {
      setPhase("unsealing");
      const t = setTimeout(() => setPhase("open"), 900);
      return () => clearTimeout(t);
    }
    if (sealed && phase !== "locked") setPhase("locked");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sealed]);

  return (
    <div
      className={`relative overflow-hidden border border-line bg-surface min-h-[22rem] flex flex-col p-6 panel-${phase}`}
    >
      <div
        className="absolute inset-0 opacity-25 pointer-events-none"
        style={{
          backgroundImage: "url(/textures/sealed-panel.png)",
          backgroundSize: "cover",
        }}
        aria-hidden
      />
      <div className="scanline" aria-hidden />
      <p className="relative font-display text-sm tracking-widest text-muted">
        PS · 0{index}
      </p>

      <div className="locked-content relative flex-1 flex flex-col items-center justify-center gap-3 text-center mt-4">
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#d9a94a" strokeWidth="1.5" aria-hidden>
          <rect x="4" y="10" width="16" height="10" rx="1.5" />
          <path d="M8 10V7a4 4 0 0 1 8 0v3" />
        </svg>
        <p className="text-sm tracking-widest uppercase text-gold">Sealed until launch</p>
      </div>

      <div className="open-content relative flex-1 mt-4">
        <h3 className="font-display text-xl text-paper">{title}</h3>
        <p className="mt-3 text-sm text-muted leading-relaxed">{body}</p>
      </div>
    </div>
  );
}

export default function Tracks() {
  return (
    <section id="tracks" className="relative section-pad overflow-hidden">
      <BlueprintBackground />
      <div className="wrap relative z-10">
        <p className="kicker mb-3">Kept under wraps</p>
        <h2 className="font-display text-3xl sm:text-5xl leading-tight">Three problem statements</h2>
        <p className="mt-5 text-muted leading-relaxed" style={{ maxWidth: "65ch" }}>
          Three original problem statements, revealed together at the start of the challenge —
          not a moment before. Each comes with a set of general expectations to build against.
          What you add on top of that is entirely up to you.
        </p>

        <div className="mt-10 flex flex-wrap items-center gap-6">
          <p className="text-sm text-muted">Statements unlock in</p>
          <Countdown to={EVENT_DATE} />
        </div>

        <div className="mt-8 grid md:grid-cols-3 gap-4">
          <Dossier index={1} />
          <Dossier index={2} />
          <Dossier index={3} />
        </div>

        <ul className="mt-10 space-y-2 text-sm text-muted" style={{ maxWidth: "70ch" }}>
          <li>• A working core build that meets the general expectations announced at the start of the challenge.</li>
          <li>• One original feature or approach that&apos;s entirely your own — this is what sets your build apart from everyone else on the same statement.</li>
        </ul>
      </div>
    </section>
  );
}
