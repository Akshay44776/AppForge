"use client";

import React, { useEffect, useRef } from "react";
import PersonCard from "./PersonCard";
import StudentProfileCard from "./StudentProfileCard";

type Person = { name: string; role?: string; tel?: string; tierOverride?: string; linkedin?: string; imgUrl?: string };

const TIERS: { label: string; cols?: number; people: Person[] }[] = [
  {
    label: "Patron & Presides",
    cols: 3,
    people: [
      { name: "Dr. Puttaraju", role: "Academic Director, BGS & SJB Groups of Institutions", tierOverride: "Patron" },
      { name: "Dr. Mahendra Prashanth K V", role: "Principal, SJB Institute of Technology", tierOverride: "Presides" },
      { name: "Dr. Krishna A N", role: "Head of the Department, CSE", tierOverride: "Presides" },
    ],
  },
  {
    label: "Co-ordinated by",
    people: [{ name: "Dr. Prakruthi M K" }, { name: "Mrs. Vijayalakshmi B" }],
  },
  {
    label: "Event coordinators",
    people: [{ name: "Mrs. ShilpaShree S" }, { name: "Mrs. Vinutha K" }],
  },
];

const STUDENT_TEAM: Person[] = [
  { name: "Akshay K", role: "Main Student Co-ordinator", tel: "9740685444", linkedin: "https://www.linkedin.com/in/akshayk44776/", imgUrl: "/team/akshay_k.jpg" },
  { name: "Eshan H", role: "Main Student Co-ordinator", tel: "9380070210", linkedin: "https://www.linkedin.com/in/eshan-h/", imgUrl: "/team/eshan_h.jpg" },
  { name: "Divya D", role: "Lead — Tech & Platform", tel: "6360364399", linkedin: "https://www.linkedin.com/in/divyad03/", imgUrl: "/team/divya_d.jpg" },
  { name: "Abhilasha B Chakrasali", role: "Lead — Hospitality", tel: "9449476813", linkedin: "https://www.linkedin.com/in/abhilasha-chakrasali-16a7442b6/", imgUrl: "/team/abhilasha_b_c.jpg" },
  { name: "Laxmi Hooli", role: "Lead — Media & Documentation", tel: "7483397882", linkedin: "https://www.linkedin.com/in/laxmi-hooli/", imgUrl: "/team/laxmi_hooli.jpg" },
];

export default function People() {
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.1 }
    );

    const elements = sectionRef.current?.querySelectorAll(".glass-reveal");
    elements?.forEach((el) => observer.observe(el));

    return () => observer.disconnect();
  }, []);

  return (
    <section
      id="people"
      ref={sectionRef}
      className="section-pad relative border-y border-line overflow-hidden"
    >
      {/* Subtle radial gradient background */}
      <div className="absolute inset-0 pointer-events-none" style={{
        background: 'radial-gradient(circle at 10% 10%, rgba(217, 169, 74, 0.04) 0%, transparent 40%), radial-gradient(circle at 90% 90%, rgba(124, 156, 240, 0.04) 0%, transparent 40%)'
      }} />

      <div className="wrap relative z-10">
        <div className="text-center mb-16 sm:mb-24">
          <p className="kicker mb-3">People</p>
          <h2 className="font-display text-3xl sm:text-4xl md:text-5xl leading-tight">Behind AppForge</h2>
        </div>

        <div className="space-y-20 sm:space-y-32">
          {/* Leadership & Coordinators */}
          <div className="space-y-16">
            {TIERS.map((tier) => (
              <div key={tier.label}>
                <h3 className="text-[13px] uppercase tracking-[0.08em] text-gold font-bold mb-6">
                  {tier.label}
                </h3>
                <div className={`grid md:grid-cols-2 ${tier.cols === 3 ? 'lg:grid-cols-3' : ''} gap-6 sm:gap-8 items-stretch justify-center`}>
                  {tier.people.map((p, idx) => (
                    <div key={p.name} className={tier.people.length % 2 !== 0 && idx === tier.people.length - 1 && tier.cols !== 3 ? "md:col-span-2 max-w-[600px] mx-auto w-full" : ""}>
                      <PersonCard
                        name={p.name}
                        role={p.role}
                        tierLabel={p.tierOverride || tier.label}
                        delay={idx * 60}
                      />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Student Team */}
          <div>
            <div className="text-center mb-10">
              <h3 className="text-[13px] uppercase tracking-[0.08em] text-gold font-bold">Student Team</h3>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
              {STUDENT_TEAM.map((student, idx) => (
                <StudentProfileCard
                  key={student.name}
                  name={student.name}
                  role={student.role || ''}
                  tel={student.tel}
                  linkedin={student.linkedin}
                  imgUrl={student.imgUrl}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
