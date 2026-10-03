"use client";

import * as React from "react";
import { rules, pad2 } from "../rulebook/rules.data";
import MobileRuleSheet from "./MobileRuleSheet";
import { mobileStore } from "./useMobileStore";
import { RuleIcon } from "../rulebook/RuleIcons";

export default function FallbackRulebookMobile() {
  return (
    <section style={{ background: "#07080D", minHeight: "100vh", padding: "4rem 0" }}>
      <div className="wrap">
         <p style={{ color: "#F2B632", letterSpacing: "0.15em", textTransform: "uppercase", fontSize: "0.8rem", marginBottom: "1rem" }}>
            Rulebook
         </p>
         <h2 className="font-display text-4xl" style={{ color: "#ece8de", marginBottom: "2rem" }}>
            The Twelve Gates
         </h2>
         
         <div style={{ display: "flex", overflowX: "auto", gap: "1rem", paddingBottom: "2rem", scrollSnapType: "x mandatory", WebkitOverflowScrolling: "touch" }}>
            {rules.map((rule) => (
               <div
                  key={rule.id}
                  onClick={() => mobileStore.setOpenRule(rule.id)}
                  style={{
                     flex: "0 0 80vw",
                     scrollSnapAlign: "center",
                     background: "linear-gradient(170deg, rgba(12,16,23,0.88), rgba(10,12,18,0.94))",
                     borderRadius: "14px",
                     padding: "1.5rem",
                     border: "1px solid rgba(236,232,222,0.1)",
                     color: "white",
                     cursor: "pointer",
                  }}
               >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1rem" }}>
                     <div style={{ width: "40px", height: "40px" }}>
                        <RuleIcon id={rule.id} />
                     </div>
                     <div style={{ fontSize: "0.7rem", letterSpacing: "0.1em", textTransform: "uppercase", color: "#F2B632", background: "rgba(242,182,50,0.1)", padding: "4px 8px", borderRadius: "12px" }}>
                        {rule.category}
                     </div>
                  </div>
                  
                  <div style={{ display: "flex", alignItems: "baseline", gap: "12px", marginBottom: "12px" }}>
                     <span className="font-display" style={{ fontSize: "2.5rem", fontWeight: "bold", color: "#F2B632" }}>
                        {pad2(rule.id)}
                     </span>
                     <h3 className="font-display" style={{ fontSize: "1.4rem", margin: 0 }}>
                        {rule.title}
                     </h3>
                  </div>
                  
                  <p style={{ fontSize: "0.9rem", color: "#828a97", lineHeight: 1.5, margin: 0, display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                     {rule.body}
                  </p>
               </div>
            ))}
         </div>
      </div>
      
      <MobileRuleSheet />
    </section>
  );
}
