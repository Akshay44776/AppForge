/* eslint-disable @next/next/no-img-element */
"use client";

import React from "react";

type StudentProfileCardProps = {
  name: string;
  role: string;
  tel?: string;
  linkedin?: string;
  imgUrl?: string;
  /** -1 = left periphery, 0 = center focused, 1 = right periphery */
  signedFocusRatio?: number;
  /** Position label for screen readers, e.g. "3 of 6" */
  positionLabel?: string;
  onClick?: () => void;
  onMouseEnter?: () => void;
};

export default function StudentProfileCard({
  name,
  role,
  tel,
  linkedin,
  imgUrl,
  signedFocusRatio = 0,
  positionLabel,
  onClick,
  onMouseEnter,
}: StudentProfileCardProps) {
  const linkedInHref = linkedin || "https://linkedin.com/in/PLACEHOLDER";

  // Clamp the signed ratio to [-1, 1]
  const r = Math.max(-1, Math.min(1, signedFocusRatio));
  const absR = Math.abs(r);

  // 3D Coverflow Visual Treatments
  const rotateY = r * -25;              // Left cards (-1) rotate +25deg inward, Right (+1) rotate -25deg
  const translateZ = (1 - absR) * 60;   // Center lifts 60px forward
  const scale = 1 - absR * 0.15;        // Center 1.0, edges 0.85
  const blur = absR * 3;                // Center 0px, edges 3px
  const opacity = 1 - absR * 0.5;       // Center 1.0, edges 0.5
  const brightness = 1 - absR * 0.3;    // Center 1.0, edges 0.7
  
  const isFocused = absR < 0.15;

  return (
    <div
      className="student-reel-card relative h-[380px] w-full flex flex-col items-center text-center group deck-face"
      style={{
        transform: `rotateY(${rotateY}deg) translateZ(${translateZ}px) scale(${scale})`,
        filter: `blur(${blur}px) brightness(${brightness})`,
        opacity,
        transition: "transform 0.4s cubic-bezier(0.2, 0.8, 0.2, 1), filter 0.4s ease-out, opacity 0.4s ease-out",
        cursor: isFocused ? "default" : "pointer",
        willChange: "transform, filter, opacity",
      }}
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      role="group"
      aria-label={`${name}, ${role}${positionLabel ? `. ${positionLabel}` : ""}`}
    >
      {/* 
        Frosted Navy Glass Panel 
        Requires its own div to avoid conflicting with the 3D transforms above
      */}
      <div className="absolute inset-0 rounded-2xl bg-[#0a1018]/80 backdrop-blur-md border border-[rgba(217,169,74,0.2)] shadow-[inset_0_0_20px_rgba(217,169,74,0.05)] transition-colors duration-500" />

      {/* Top gold highlight line */}
      <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-[rgba(217,169,74,0.4)] to-transparent" />

      <div className="relative z-10 flex flex-col items-center h-full pt-8 pb-6 px-4">
        {/* Photo Container with Glow Halo */}
        <div className="relative mb-6">
          <div
            className={`rounded-full flex items-center justify-center relative transition-all duration-500 overflow-hidden
              ${isFocused ? "animate-ring-pulse border-[rgba(217,169,74,0.6)]" : "border-[rgba(217,169,74,0.15)]"}
            `}
            style={{
              width: "6rem",
              height: "6rem",
              borderWidth: "1px",
              borderStyle: "solid",
              boxShadow: isFocused ? "0 0 30px rgba(217, 169, 74, 0.25)" : "none",
            }}
          >
            {/* Inner glow on hover */}
            <div className="absolute inset-0 rounded-full bg-gradient-to-br from-[rgba(217,169,74,0.2)] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-10" />
            
            {imgUrl ? (
              <img src={imgUrl} alt={name} className="w-full h-full object-cover object-top rounded-full relative z-0" />
            ) : (
              <svg className={`w-8 h-8 transition-colors duration-300 relative z-0 ${isFocused ? 'text-gold' : 'text-muted/50'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            )}
          </div>
        </div>

        {/* Name and Role */}
        <h4 className="text-[19px] font-semibold text-white mb-2">{name}</h4>
        
        <div className="flex items-center gap-1 mb-6">
          <span className="text-[11px] font-bold tracking-widest uppercase text-gold">
            {role}
          </span>
          <span className="text-gold font-mono font-bold animate-cursor-blink">|</span>
        </div>

        {/* Contact Info */}
        <div className="mt-auto flex flex-col items-center gap-3 w-full">
          {tel && (
            <a
              href={`tel:+91${tel}`}
              className="flex items-center gap-2 text-gold/70 hover:text-gold transition-colors text-sm tabular-nums"
              onClick={(e) => e.stopPropagation()}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
              </svg>
              +91 {tel}
            </a>
          )}

          <div className="flex items-center gap-2 mt-1">
            <a
              href={linkedInHref}
              target="_blank"
              rel="noreferrer"
              aria-label="Connect on LinkedIn"
              className="w-10 h-10 rounded-full flex items-center justify-center bg-white/5 border border-[rgba(217,169,74,0.2)] text-gold/70 hover:text-white hover:bg-[rgba(217,169,74,0.1)] hover:border-gold/50 transition-all duration-300 hover:scale-110 hover:shadow-[0_0_12px_rgba(217,169,74,0.15)]"
              title="Connect on LinkedIn"
              onClick={(e) => e.stopPropagation()}
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z" />
              </svg>
            </a>
          </div>
        </div>
      </div>

      {/* 
        "Plugging in" Line 
        Animates downward from the card into the background when active 
      */}
      {isFocused && (
        <div className="absolute -bottom-24 left-1/2 -translate-x-1/2 w-px bg-gradient-to-b from-gold via-gold/50 to-transparent animate-plugin-line pointer-events-none" />
      )}
    </div>
  );
}
