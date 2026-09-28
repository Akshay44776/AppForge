"use client";

import { useEffect, useRef, useState } from "react";

interface Props {
  value: string; // exactly 1 character (0-9)
}

export default function FlipDigit({ value }: Props) {
  const [current, setCurrent] = useState(value);
  const [next, setNext] = useState(value);
  const [flipping, setFlipping] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (value === current) return;
    setNext(value);
    setFlipping(true);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      setCurrent(value);
      setFlipping(false);
    }, 340);
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [value, current]);

  return (
    <span className="reg-flip-digit" aria-hidden="true">
      {/* Static top half showing next (revealed as flap falls) */}
      <span className="reg-flip-top">{next}</span>
      {/* Static bottom half showing current */}
      <span className="reg-flip-bottom">{current}</span>
      {/* Animating flap — top half of current flipping down */}
      <span className={`reg-flip-flap ${flipping ? "reg-flip-flap--go" : ""}`}>{current}</span>
    </span>
  );
}
