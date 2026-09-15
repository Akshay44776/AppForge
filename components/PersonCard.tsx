import React from "react";

type PersonCardProps = {
  name: string;
  role?: string;
  tierLabel: string;
  delay?: number;
};

export default function PersonCard({ name, role, tierLabel, delay = 0 }: PersonCardProps) {
  // Extract initials for the avatar, ignoring titles like Dr. or Mrs.
  const nameParts = name.split(" ").filter((n) => n.length > 0 && !["DR.", "MRS.", "MR."].includes(n.toUpperCase()));
  const initials = nameParts
    .map((n) => n[0])
    .join("")
    .substring(0, 2)
    .toUpperCase();

  return (
    <div
      className="glass-card glass-reveal h-full relative overflow-hidden flex flex-col sm:flex-row items-start gap-5"
      style={{ animationDelay: `${delay}ms` }}
    >
      {/* Top highlight line */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />

      {/* Avatar */}
      <div className="shrink-0 w-12 h-12 rounded-full border border-[rgba(217,169,74,0.3)] flex items-center justify-center bg-gradient-to-br from-[rgba(217,169,74,0.1)] to-[rgba(124,156,240,0.1)] text-paper text-sm font-semibold tracking-wide shadow-inner">
        {initials}
      </div>

      <div className="flex-1 min-w-0">
        <span
          className="inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-widest text-gold mb-2"
          style={{ backgroundColor: "rgba(217, 169, 74, 0.1)" }}
        >
          {tierLabel}
        </span>
        <h4 className="text-[17px] sm:text-[18px] font-semibold text-paper leading-snug truncate">
          {name}
        </h4>
        {role && <p className="text-muted text-sm mt-1 leading-relaxed line-clamp-2">{role}</p>}
      </div>
    </div>
  );
}
