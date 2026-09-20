"use client";

import * as React from "react";
import { pad2, type Rule } from "./rules.data";
import { RuleIcon } from "./RuleIcons";
import { forge, core, useForgeStore } from "./useForgeStore";

const MAX_TILT = 10; // §8.1 — ±10°
const ENERGY_DELAY = 400; // §8.1 — energy edge after ~0.4s

interface Props {
  rule: Rule;
  index: number; // 0-based order for the staggered landing + tablet delay
  lowPower: boolean;
  onOpen: (id: number, el: HTMLButtonElement) => void;
  registerRef: (id: number, el: HTMLButtonElement | null) => void;
}

export default function RuleCard({
  rule,
  index,
  lowPower,
  onOpen,
  registerRef,
}: Props) {
  const ref = React.useRef<HTMLButtonElement | null>(null);
  const raf = React.useRef<number | null>(null);
  const target = React.useRef({ x: 0, y: 0 });
  const current = React.useRef({ x: 0, y: 0 });
  const energyTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const [energy, setEnergy] = React.useState(false);

  const hovered = useForgeStore((s) => s.hovered === rule.id);
  const open = useForgeStore((s) => s.open === rule.id);
  const anyOpen = useForgeStore((s) => s.open !== null);
  const reduced = useForgeStore((s) => s.reducedMotion);
  const fine = useFinePointer();

  React.useEffect(() => {
    registerRef(rule.id, ref.current);
    return () => registerRef(rule.id, null);
  }, [registerRef, rule.id]);

  // smooth tilt follow, cancelled on unmount
  const tick = React.useCallback(() => {
    const el = ref.current;
    if (!el) return;
    current.current.x += (target.current.x - current.current.x) * 0.18;
    current.current.y += (target.current.y - current.current.y) * 0.18;
    el.style.setProperty("--tiltX", `${current.current.x.toFixed(2)}deg`);
    el.style.setProperty("--tiltY", `${current.current.y.toFixed(2)}deg`);
    const done =
      Math.abs(target.current.x - current.current.x) < 0.02 &&
      Math.abs(target.current.y - current.current.y) < 0.02;
    raf.current = done ? null : requestAnimationFrame(tick);
  }, []);

  const kick = React.useCallback(() => {
    if (raf.current == null) raf.current = requestAnimationFrame(tick);
  }, [tick]);

  React.useEffect(
    () => () => {
      if (raf.current != null) cancelAnimationFrame(raf.current);
      if (energyTimer.current) clearTimeout(energyTimer.current);
    },
    []
  );

  const activate = () => {
    forge.setHovered(rule.id); // also flips `energised` (§8.2)
    core.flare(); // §7 — debounced inside the scene
    if (!reduced && !lowPower) {
      energyTimer.current = setTimeout(() => setEnergy(true), ENERGY_DELAY);
    }
  };

  const deactivate = () => {
    if (energyTimer.current) clearTimeout(energyTimer.current);
    setEnergy(false);
    target.current = { x: 0, y: 0 };
    kick();
    if (forge.get().hovered === rule.id) forge.setHovered(null);
  };

  const onMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!fine || reduced) return;
    const r = e.currentTarget.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width - 0.5;
    const py = (e.clientY - r.top) / r.height - 0.5;
    target.current = { x: -py * 2 * MAX_TILT, y: px * 2 * MAX_TILT };
    kick();
  };

  const lift = hovered && !anyOpen && fine && !reduced;

  return (
    <button
      ref={ref}
      type="button"
      className="fc-card"
      style={
        {
          "--lift": lift ? "26px" : "0px",
          "--hover-scale": lift ? 1.12 : 1,
          "--fc-i": index,
        } as React.CSSProperties
      }
      data-rule={rule.id}
      data-active={hovered && !anyOpen ? "true" : "false"}
      data-energy={energy && !anyOpen ? "true" : "false"}
      data-turbulence={lowPower || reduced ? "false" : "true"}
      data-ghost={open ? "true" : "false"}
      aria-expanded={open}
      aria-controls="fc-rule-panel"
      onPointerEnter={fine ? activate : undefined}
      onPointerLeave={fine ? deactivate : undefined}
      onPointerMove={onMove}
      onFocus={activate}
      onBlur={deactivate}
      onClick={(e) => onOpen(rule.id, e.currentTarget)}
    >
      <span className="fc-card-energy" aria-hidden="true" />
      <span className="fc-card-icon" aria-hidden="true">
        <RuleIcon id={rule.id} />
      </span>
      <span>
        <span className="fc-card-num" aria-hidden="true">
          {pad2(rule.id)}
        </span>
        <span className="fc-card-title">{rule.title}</span>
      </span>
      {/* §8.1 — full rule text is always in the a11y tree, panel or no panel */}
      <span className="fc-sr">
        Rule {pad2(rule.id)}. {rule.category}. {rule.title}. {rule.body}
      </span>
    </button>
  );
}

export function useFinePointer() {
  const [fine, setFine] = React.useState(false);
  React.useEffect(() => {
    const mq = window.matchMedia("(hover: hover) and (pointer: fine)");
    const apply = () => setFine(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);
  return fine;
}

/** SVG filter for the energy edge (§8.1). Mounted once by RulebookSection. */
export function EnergyTurbulenceDefs() {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      width="0"
      height="0"
      style={{ position: "absolute", width: 0, height: 0 }}
    >
      <filter id="fc-energy-turbulence">
        <feTurbulence
          type="fractalNoise"
          baseFrequency="0.9 0.04"
          numOctaves="2"
          seed="7"
          result="n"
        >
          <animate
            attributeName="seed"
            values="1;9;3;7"
            dur="0.7s"
            repeatCount="indefinite"
          />
        </feTurbulence>
        <feDisplacementMap
          in="SourceGraphic"
          in2="n"
          scale="2.2"
          xChannelSelector="R"
          yChannelSelector="G"
        />
      </filter>
    </svg>
  );
}
