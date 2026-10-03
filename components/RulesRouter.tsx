"use client";

import * as React from "react";
import dynamic from "next/dynamic";

const DesktopRulebook = dynamic(() => import("@/components/rulebook/RulebookSection"), {
  ssr: false,
});

const MobileRulebook = dynamic(() => import("@/components/RulebookMobile/RulebookMobileSection"), {
  ssr: false,
});

const FallbackRulebookMobile = dynamic(() => import("@/components/RulebookMobile/FallbackRulebookMobile"), {
  ssr: false,
});

export default function RulesRouter() {
  const [isMobile, setIsMobile] = React.useState<boolean | null>(null);
  const [isReduced, setIsReduced] = React.useState<boolean | null>(null);

  React.useEffect(() => {
    const mqMobile = window.matchMedia("(max-width: 820px) and (pointer: coarse)");
    setIsMobile(mqMobile.matches);

    const onChangeMobile = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mqMobile.addEventListener("change", onChangeMobile);
    
    const mqReduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    setIsReduced(mqReduced.matches);
    
    const onChangeReduced = (e: MediaQueryListEvent) => setIsReduced(e.matches);
    mqReduced.addEventListener("change", onChangeReduced);

    return () => {
      mqMobile.removeEventListener("change", onChangeMobile);
      mqReduced.removeEventListener("change", onChangeReduced);
    };
  }, []);

  if (isMobile === null || isReduced === null) {
    // Placeholder while measuring
    return (
      <section id="rules" style={{ background: "#07090d", minHeight: "100vh", padding: "clamp(4rem,10vw,8rem) 0" }}>
        <div className="wrap">
          <p className="kicker mb-3" style={{ letterSpacing: "0.15em" }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: "8px" }}>
              Rulebook
              <span
                aria-hidden="true"
                style={{
                  display: "inline-block",
                  width: "32px",
                  height: "1px",
                  background: "var(--gold, #d9a94a)",
                  opacity: 0.5,
                }}
              />
            </span>
          </p>
          <h2 className="font-display text-3xl sm:text-5xl leading-tight" style={{ color: "var(--paper, #ece8de)", margin: 0 }}>
            The Twelve Gates
          </h2>
        </div>
      </section>
    );
  }

  if (isMobile) {
    return isReduced ? <FallbackRulebookMobile /> : <MobileRulebook />;
  }

  return <DesktopRulebook />;
}
