"use client";

import * as React from "react";
import "./mobile.css";
import { mobileProgressRef } from "./useMobileStore";
import { RB_CONFIG } from "./mobile.config";
import { rules, pad2 } from "../rulebook/rules.data";
import MobileScene from "./MobileScene";
import MobileCard from "./MobileCard";
import MobileRuleSheet from "./MobileRuleSheet";
import { OrreryBadgesDOM } from "./MobileOrrery";
import { mobileStore } from "./useMobileStore";
import { mapProgress } from "./mobile.config";

// Clamp helper
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

export default function RulebookMobileSection() {
  const trackRef = React.useRef<HTMLDivElement>(null);
  const cardRefs = React.useRef<(HTMLDivElement | null)[]>([]);
  
  // Damped spring inside the render loop smooths it
  React.useEffect(() => {
    let alive = true;
    let target = 0;
    let current = 0;
    let rafId: number;

    const onScroll = () => {
      if (!trackRef.current) return;
      const rect = trackRef.current.getBoundingClientRect();
      // rect.top is 0 when the top of the track hits the top of the viewport
      // rect.height is the total height.
      // we want progress 0..1 based on how far we scrolled through the track.
      // The track is scrollable for (rect.height - window.innerHeight) pixels.
      const scrollableDistance = rect.height - window.innerHeight;
      if (scrollableDistance > 0) {
        target = clamp01(-rect.top / scrollableDistance);
      }
    };

    const loop = () => {
      if (!alive) return;
      current += (target - current) * 0.15; // Damped spring
      if (Math.abs(target - current) < 0.0001) current = target;
      
      mobileProgressRef.current = current;
      
      // Update DOM
      const { gate, orreryP } = mapProgress(current);

      // HUD counter
      const hudEl = document.querySelector('.rb-hud') as HTMLElement;
      if (hudEl) {
         hudEl.style.opacity = `${1 - orreryP * 2}`;
      }

      const counterEl = document.getElementById('rb-hud-counter');
      if (counterEl) {
         // Gate ranges 0..11, so +1
         const currentGate = Math.min(Math.max(Math.round(gate + 1), 1), 12);
         counterEl.innerText = pad2(currentGate);
      }
      
      // Update cards
      cardRefs.current.forEach((el, idx) => {
        if (!el) return;
        
        // dist: how far is the current scroll (gate) from this card's index
        const dist = gate - idx;
        
        // Active card: dist is near 0
        if (dist >= -3 && dist <= 1) {
          el.style.display = 'block';
          
          let cardOpacity = 0;
          
          if (dist > 0) {
            // Exiting (pushed up and away)
            const exitP = clamp01(dist / 0.55); // fully exited by 0.55
            el.style.transform = `translateY(${-14 * exitP}vh) translateZ(${-160 * exitP}px) rotateX(${-12 * exitP}deg)`;
            cardOpacity = 1 - exitP;
            el.style.filter = `blur(${8 * exitP}px)`;
          } else if (dist > -1) {
            // Entering (coming up from bottom)
            const enterP = clamp01((dist + 1) / 0.4); // starts at dist=-1, fully entered by dist=-0.6
            el.style.transform = `translateY(${18 * (1 - enterP)}vh) rotateX(${14 * (1 - enterP)}deg)`;
            cardOpacity = enterP;
            el.style.filter = `blur(${8 * (1 - enterP)}px)`;
          } else if (dist > -2) {
            // Stack peek 1
            el.style.transform = `translateY(${10}px) scale(0.94)`;
            cardOpacity = 0.5;
            el.style.filter = `blur(0px)`;
          } else {
            // Stack peek 2
            el.style.transform = `translateY(${20}px) scale(0.88)`;
            cardOpacity = 0.25;
            el.style.filter = `blur(0px)`;
          }
          
          // Apply orrery fade
          el.style.opacity = `${cardOpacity * (1 - orreryP * 2)}`;
        } else {
          el.style.display = 'none';
        }
      });
      
      rafId = requestAnimationFrame(loop);
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    // Initial measurement
    onScroll();
    loop();

    return () => {
      alive = false;
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(rafId);
    };
  }, []);

  return (
    <section className="rb-root">
      <div className="rb-track" ref={trackRef}>
        <div className="rb-stage">
          {/* HUD Zone */}
          <div className="rb-hud">
            <div style={{ letterSpacing: "0.15em", textTransform: "uppercase", fontSize: "0.8rem", color: "#F2B632" }}>
              Rulebook
            </div>
            <div className="rb-hud-gate" style={{ fontSize: "0.85rem", fontWeight: "bold", color: "white" }}>
              GATE <span id="rb-hud-counter">01</span> / 12
            </div>
            {/* Mini-key progress goes here */}
            <div style={{ width: "24px", height: "24px", border: "1px solid #F2B632", borderRadius: "50%" }}></div>
          </div>

          <MobileScene />
          
          {/* Card Zone */}
          <div className="rb-card-zone">
            {rules.map((r, i) => (
              <MobileCard
                key={r.id}
                rule={r}
                index={i}
                registerRef={(idx, el) => {
                  cardRefs.current[idx] = el;
                }}
                onTap={(id) => mobileStore.setOpenRule(id)}
              />
            ))}
          </div>
          
          <OrreryBadgesDOM />
          <MobileRuleSheet />
        </div>
      </div>
    </section>
  );
}
