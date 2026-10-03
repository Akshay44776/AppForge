"use client";

import * as React from "react";
import { useMobileStore, mobileStore } from "./useMobileStore";
import { rules, pad2 } from "../rulebook/rules.data";

export default function MobileRuleSheet() {
  const openRuleId = useMobileStore((s) => s.openRuleId);
  const isOpen = openRuleId !== null;
  const rule = rules.find(r => r.id === openRuleId);

  React.useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
      window.history.pushState({ sheetOpen: true }, "");
      
      const onPopState = () => {
        mobileStore.setOpenRule(null);
      };
      window.addEventListener("popstate", onPopState);
      return () => {
        document.body.style.overflow = "";
        window.removeEventListener("popstate", onPopState);
      };
    } else {
      document.body.style.overflow = "";
    }
  }, [isOpen]);

  const handleClose = () => {
    if (isOpen) {
       window.history.back(); // Triggers popstate which sets openRuleId to null
    }
  };

  const [touchStart, setTouchStart] = React.useState(0);
  const [touchEnd, setTouchEnd] = React.useState(0);

  const onTouchStart = (e: React.TouchEvent) => {
    setTouchStart(e.targetTouches[0].clientY);
  };
  
  const onTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientY);
  };

  const onTouchEnd = () => {
    if (touchEnd === 0) return;
    const distance = touchEnd - touchStart;
    if (distance > 100) {
       handleClose();
    }
    setTouchStart(0);
    setTouchEnd(0);
  };

  return (
    <>
      <div 
        className="rb-sheet-backdrop" 
        data-open={isOpen} 
        onClick={handleClose}
      />
      <div 
        className="rb-sheet" 
        data-open={isOpen}
      >
        <div 
          style={{ padding: "10px", cursor: "pointer" }}
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
        >
          <div className="rb-sheet-handle" />
        </div>
        
        {rule && (
          <div className="rb-sheet-content">
            <div style={{ display: "flex", gap: "12px", alignItems: "baseline", marginBottom: "16px" }}>
              <span className="font-display" style={{ fontSize: "2.5rem", fontWeight: "bold", color: "#F2B632" }}>
                {pad2(rule.id)}
              </span>
              <h2 className="font-display" style={{ fontSize: "1.6rem", margin: 0, color: "white" }}>
                {rule.title}
              </h2>
            </div>
            
            <div style={{ fontSize: "0.8rem", letterSpacing: "0.1em", textTransform: "uppercase", color: "#1a1206", background: "linear-gradient(90deg, #F2B632, rgba(147,113,47,0.85))", padding: "6px 12px", display: "inline-block", clipPath: "polygon(8px 0, 100% 0, 100% 100%, 0 100%)", marginBottom: "20px" }}>
              {rule.category}
            </div>

            <div style={{ fontSize: "1.05rem", color: "#ece8de", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>
              {rule.body}
            </div>
            
            {rule.facts && (
              <table style={{ width: "100%", marginTop: "24px", borderCollapse: "collapse", fontSize: "0.9rem" }}>
                <tbody>
                  {rule.facts.map(([label, val], idx) => (
                    <tr key={idx} style={{ background: idx % 2 === 0 ? "rgba(255,255,255,0.035)" : "transparent" }}>
                      <th style={{ textAlign: "left", padding: "8px 12px", color: "#828a97", fontWeight: "normal", width: "45%" }}>
                        {label}
                      </th>
                      <td style={{ padding: "8px 12px", color: "#ece8de" }}>
                        {val}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            
            {/* Prev/Next Navigation */}
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: "40px", borderTop: "1px solid rgba(242,182,50,0.2)", paddingTop: "20px" }}>
               {rule.id > 1 ? (
                  <button onClick={() => mobileStore.setOpenRule(rule.id - 1)} style={{ color: "#F2B632", display: "flex", alignItems: "center", gap: "8px" }}>
                     <span>‹</span> Gate {pad2(rule.id - 1)}
                  </button>
               ) : <div />}
               
               {rule.id < 12 ? (
                  <button onClick={() => mobileStore.setOpenRule(rule.id + 1)} style={{ color: "#F2B632", display: "flex", alignItems: "center", gap: "8px" }}>
                     Gate {pad2(rule.id + 1)} <span>›</span>
                  </button>
               ) : <div />}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
