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
  loading: () => <div className="reg-countdown-placeholder" />,
});

const IconTeam = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
    <circle cx="9" cy="7" r="4"></circle>
    <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
    <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
  </svg>
);

const IconBadge = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="16" rx="2"></rect>
    <circle cx="9" cy="12" r="2.5"></circle>
    <path d="M14 10h4M14 14h4"></path>
  </svg>
);

const IconRupee = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 4h12M6 9h12M6 4c0 2.8 2.7 5 6 5s6-2.2 6-5"/>
    <path d="M12 9v11M6 14l6 0"/>
  </svg>
);

const IconCalendar = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2"></rect>
    <path d="M16 2v4M8 2v4M3 10h18"></path>
  </svg>
);

export default function Register() {
  return (
    <section id="register" className="reg-root">

      {/* Cinematic canvas — full bleed background */}
      <div className="reg-scene-wrap" aria-hidden="true">
        <RegisterScene />
        <div className="reg-godray" aria-hidden="true" />
      </div>

      {/* §8 — static four-point sparkle accent, fixed bottom-right */}
      <svg className="reg-sparkle" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M12 0c.6 5.6 1.8 9 4 11.2 2.2 2.2 5.6 3.4 8 4-2.4.6-5.8 1.8-8 4-2.2 2.2-3.4 5.6-4 11.2-.6-5.6-1.8-9-4-11.2-2.2-2.2-5.6-3.4-8-4 2.4-.6 5.8-1.8 8-4C10.2 9 11.4 5.6 12 0z" />
      </svg>

      <div className="reg-content wrap">

        {/* LEFT: Tall registration card */}
        <div className="reg-card">
          <p className="kicker mb-3">Registration</p>
          <h2 className="reg-heading font-display">Register your team</h2>
          <p className="reg-body mt-5">
            Teams of 2 to 4, open to all B.E. / B.Tech students. Scan the event QR code
            or write in to{" "}
            <a href="mailto:appforge.cse@gmail.com" className="reg-link">
              appforge.cse@gmail.com
            </a>{" "}
            to reserve your slot before Oct 30. Bring your laptop, your team, and your
            best instincts — the brief will do the rest.
          </p>
          <p className="reg-price mt-4">₹400 per team, paid via event QR at check-in.</p>
          <div className="mt-10">
            <MagneticButton />
          </div>
        </div>

        {/* CENTER: chevron info tags */}
        <div className="reg-tags-col" aria-label="Event details">
          <InfoTag icon={<IconTeam />}     label="Team size"   value="2–4 members"          delay={100} />
          <InfoTag icon={<IconBadge />}    label="Eligibility" value="B.E. / B.Tech students" delay={250} />
          <InfoTag icon={<IconRupee />}    label="Entry fee"   value="₹400 · at check-in"    delay={400} />
          <InfoTag icon={<IconCalendar />} label="Reserve by"  value="Oct 30, 2026"           delay={550} />
        </div>

        {/* RIGHT: countdown */}
        <div className="reg-countdown-col">
          <RegisterCountdown />
        </div>

      </div>

    </section>
  );
}
