"use client";

import DriftingRuleBackground from "./DriftingRuleBackground";

const RULES = [
  "Open only to B.E./B.Tech students. Valid college ID required at check-in.",
  "Team size: 2 to 4 members. Cross-college teams are  permitted. Team composition is locked at check-in.",
  "Entry fee is ₹400 per team, payable via the QR code on the event poster at registration. Non-refundable.",
  "Teams may choose any of the 9 problem statements from any of the 3 tracks; all are judged on equal footing. Statement/track changes after Checkpoint 1 are not permitted.",
  "Every team's progress is reviewed at each checkpoint against that round's fixed checklist, verified by mentors. There is no elimination at any checkpoint — all teams continue to the next round, and checkpoint performance is factored into the final judging.",
  "The twist is released simultaneously to all teams during Round 2 (Hr 3:00). Integrating it is mandatory and is the primary basis for the Adaptability/Pivot Handling score. No extensions.",
  "Projects must be built during the event — pre-built or previously submitted projects are not allowed and will be disqualified on detection.",
  "Use of AI coding assistants and open-source libraries is permitted but must be disclosed to mentors on request; core logic and integration must be the team's own work.",
  "Participants must behave respectfully toward mentors, judges, organizers and fellow teams. Harassment, sabotage, or disruptive behaviour results in immediate disqualification.",
  "Judging: Technical Execution 30% · Innovation & Problem Fit 25% · Pitch & Demo Quality 25% · Adaptability/Pivot Handling 20%. Judges' scoring is final.",
  "Plagiarism, use of a pre-built project, or code-of-conduct violations are grounds for immediate disqualification at the organizers' discretion.",
  "Organizers reserve the right to amend schedule, rules, or the twist challenge for unforeseen circumstances. All organizer decisions are final and binding.",
];

export default function Rules() {
  return (
    <section id="rules" className="relative section-pad overflow-hidden">
      <DriftingRuleBackground />
      <div className="wrap relative z-10">
        <p className="kicker mb-3">Rulebook</p>
        <h2 className="font-display text-3xl sm:text-5xl leading-tight">The Rules</h2>
        <ol className="mt-12 max-w-4xl space-y-4">
          {RULES.map((r, i) => (
            <li
              key={i}
              className={`flex gap-5 text-sm leading-relaxed ${i === 3 || i === 9 ? "mt-12" : ""}`}
            >
              <span className="font-display text-gold tabular-nums w-8 shrink-0">
                {String(i + 1).padStart(2, "0")}
              </span>
              <span className="text-paper/90">{r}</span>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
