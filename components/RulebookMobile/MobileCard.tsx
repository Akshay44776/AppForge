"use client";

import * as React from "react";
import { RuleIcon } from "../rulebook/RuleIcons";
import { Rule, pad2 } from "../rulebook/rules.data";

interface Props {
  rule: Rule;
  index: number;
  registerRef: (index: number, el: HTMLDivElement | null) => void;
  onTap: (id: number) => void;
}

export default function MobileCard({ rule, index, registerRef, onTap }: Props) {
  return (
    <div
      ref={(el) => registerRef(index, el)}
      className="rb-mobile-card"
      onClick={() => onTap(rule.id)}
      style={{
        position: "absolute",
        bottom: 0, // position handled by transform in rAF loop
        width: "min(88vw, 360px)",
        background: "linear-gradient(170deg, rgba(12,16,23,0.88), rgba(10,12,18,0.94))",
        borderRadius: "14px",
        padding: "1.2rem",
        border: "1px solid rgba(236,232,222,0.1)", // will be replaced with conic gradient sweep
        color: "white",
        backdropFilter: "blur(8px)",
        transformOrigin: "bottom center",
        willChange: "transform, opacity, filter",
        opacity: 0, // initially hidden
        pointerEvents: "auto",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1rem" }}>
        <div style={{ width: "36px", height: "36px" }}>
          <RuleIcon id={rule.id} />
        </div>
        <div style={{ fontSize: "0.7rem", letterSpacing: "0.1em", textTransform: "uppercase", color: "#F2B632", background: "rgba(242,182,50,0.1)", padding: "4px 8px", borderRadius: "12px" }}>
          {rule.category}
        </div>
      </div>
      
      <div style={{ display: "flex", alignItems: "baseline", gap: "12px", marginBottom: "6px" }}>
        <span className="font-display" style={{ fontSize: "2rem", fontWeight: "bold", color: "#F2B632" }}>
          {pad2(rule.id)}
        </span>
        <h3 className="font-display" style={{ fontSize: "1.2rem", margin: 0 }}>
          {rule.title}
        </h3>
      </div>
      
      <p style={{ fontSize: "0.85rem", color: "#828a97", lineHeight: 1.4, margin: 0, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
        {rule.body}
      </p>
      
      <div style={{ marginTop: "1.2rem", borderTop: "1px solid rgba(236,232,222,0.1)", paddingTop: "0.8rem", textAlign: "center", fontSize: "0.75rem", color: "#F2B632" }}>
        Tap to read the rule <span style={{ display: "inline-block", animation: "fc-bob 1.6s ease-in-out infinite" }}>⌄</span>
      </div>
    </div>
  );
}
