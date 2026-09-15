"use client";

import React, { useRef, KeyboardEvent } from "react";

export interface JudgingCriterion {
  title: string;
  description: string;
  subtitle: string;
  icon: React.ReactNode;
  accent: string;
}

interface WallCardProps {
  criterion: JudgingCriterion;
  index: number;
  isFocused: boolean;
  onFocus: () => void;
  onBlur: () => void;
}

export default function WallCard({
  criterion,
  index,
  isFocused,
  onFocus,
  onBlur,
}: WallCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onFocus();
    }
  };

  return (
    <div
      ref={cardRef}
      className={`wall-card ${isFocused ? "is-focused" : ""}`}
      style={{
        "--card-idx": index,
        "--card-accent": criterion.accent,
      } as React.CSSProperties}
      tabIndex={0}
      role="button"
      aria-expanded={isFocused}
      aria-controls={`desc-${index}`}
      onClick={(e) => {
        e.stopPropagation(); // Prevent wall click-outside from firing immediately
        if (isFocused) {
          onBlur(); // Toggle off if already focused (tap-to-close)
        } else {
          onFocus();
        }
      }}
      onMouseEnter={onFocus}
      onFocus={onFocus}
      onKeyDown={handleKeyDown}
    >
      <div
        className="wall-card-inner glass-card"
        style={{
          borderColor: isFocused ? `${criterion.accent}80` : undefined,
          boxShadow: isFocused
            ? `0 20px 40px rgba(0,0,0,0.6), 0 0 30px ${criterion.accent}33`
            : undefined,
        }}
      >
        <div className="wall-card-icon" style={{ color: criterion.accent }}>
          {criterion.icon}
        </div>
        
        <h3 className="wall-card-title">{criterion.title}</h3>
        
        <p className="wall-card-subtitle" style={{ color: criterion.accent }}>
          {criterion.subtitle}
        </p>

        {/* Visually hidden when collapsed, but always in DOM for screen readers */}
        <div 
          id={`desc-${index}`}
          className="wall-card-desc-wrap"
          aria-hidden={!isFocused}
        >
          <p className="wall-card-desc">{criterion.description}</p>
        </div>
      </div>
    </div>
  );
}
