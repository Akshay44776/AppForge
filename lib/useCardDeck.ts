"use client";

import { useState, useCallback, useRef } from "react";

export interface UseCardDeckOptions {
  count: number;
  /** Whether transitions are disabled (reduced-motion) */
  reducedMotion?: boolean;
}

export function useCardDeck({ count, reducedMotion = false }: UseCardDeckOptions) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const animationDuration = reducedMotion ? 0 : 700;

  const next = useCallback(() => {
    if (isAnimating) return;
    setIsAnimating(true);
    setActiveIndex((prev) => (prev + 1) % count);
    timeoutRef.current = setTimeout(() => setIsAnimating(false), animationDuration);
  }, [isAnimating, count, animationDuration]);

  const prev = useCallback(() => {
    if (isAnimating) return;
    setIsAnimating(true);
    setActiveIndex((prev) => (prev - 1 + count) % count);
    timeoutRef.current = setTimeout(() => setIsAnimating(false), animationDuration);
  }, [isAnimating, count, animationDuration]);

  const goTo = useCallback(
    (index: number) => {
      if (isAnimating || index === activeIndex) return;
      setIsAnimating(true);
      setActiveIndex(index);
      timeoutRef.current = setTimeout(() => setIsAnimating(false), animationDuration);
    },
    [isAnimating, activeIndex, animationDuration]
  );

  /** Compute the stack index: 0 = front, 1 = second from front, etc. */
  function getStackIndex(cardIndex: number): number {
    return (cardIndex - activeIndex + count) % count;
  }

  return { activeIndex, isAnimating, next, prev, goTo, getStackIndex };
}
