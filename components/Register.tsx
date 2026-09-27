"use client";

import dynamic from "next/dynamic";
import InfoTag from "./register/InfoTag";
import MagneticButton from "./register/MagneticButton";
import "./register/register.css";

const RegisterScene = dynamic(() => import("./register/RegisterScene"), {
  ssr: false,
  loading: () => null,
});
const RegisterCountdown = dynamic(() => import("./register/RegisterCountdown"), {
  ssr: false,
  loading: () => (
    <div className="reg-countdown-placeholder" aria-hidden="true" />
  ),
});

// SVG icons for info tags
const IconTeam = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="9" cy="7" r="2.5" />
    <path d="M3 19c0-3.3 2.7-6 6-6" />
    <circle cx="17" cy="7" r="2.5" />
    <path d="M21 19c0-3.3-2.7-6-6-6" />
    <path d="M9 13c3.3 0 6 2.7 6 6H3c0-3.3 2.7-6 6-6z" />
  </svg>
);

const IconBadge = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="14" rx="2" />
    <circle cx="9" cy="11" r="2" />
    <path d="M13 9h4M13 13h4" />
  </svg>
);

const IconRupee = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 4h12M6 9h12M12 9v11M6 14l6 0" />
    <path d="M6 4c0 2.8 2.7 5 6 5s6-2.2 6-5" />
  </svg>
);

const IconCalendar = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="5" width="18" height="16" rx="2" />
    <path d="M16 3v4M8 3v4M3 9h18" />
    <path d="M8 13h2M14 13h2M8 17h2M14 17h2" />
  </svg>
);

export default function Register() {
  return (
    <section id="register" className="reg-root">
      {/* ── Cinematic 2D canvas scene ── */}
      <div className="reg-scene-wrap" aria-hidden="true">
        <RegisterScene />
      </div>

      {/* ── Content layer (real DOM, accessible) ── */}
      <div className="reg-content wrap">
        {/* Left: registration card */}
        <div className="reg-card glass-reveal" data-card="main">
          <p className="kicker mb-3">Registration</p>
          <h2 className="reg-heading font-display">Register your team</h2>
          <p className="reg-body mt-5">
            Teams of 2 to 4, open to all B.E. / B.Tech students. Scan the event QR code or write
            in to{" "}
            <a href="mailto:appforge.cse@gmail.com" className="reg-link">
              appforge.cse@gmail.com
            </a>{" "}
            to reserve your slot before Oct 30. Bring your laptop, your team, and your best
            instincts — the brief will do the rest.
          </p>
          <p className="reg-price mt-4">₹400 per team, paid via event QR at check-in.</p>
          <div className="mt-8">
            <MagneticButton />
          </div>
        </div>

        {/* Center-right: floating info tags */}
        <div className="reg-tags-col" aria-label="Event details">
          <InfoTag
            icon={<IconTeam />}
            label="Team size"
            value="2–4 members"
            delay={200}
          />
          <InfoTag
            icon={<IconBadge />}
            label="Eligibility"
            value="B.E. / B.Tech students"
            delay={380}
          />
          <InfoTag
            icon={<IconRupee />}
            label="Entry fee"
            value="₹400 · at check-in"
            delay={560}
          />
          <InfoTag
            icon={<IconCalendar />}
            label="Reserve by"
            value="Oct 30, 2026"
            delay={740}
          />
        </div>

        {/* Right: countdown */}
        <div className="reg-countdown-col">
          <RegisterCountdown />
        </div>
      </div>
    </section>
  );
}
