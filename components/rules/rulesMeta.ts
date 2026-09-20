/* ═══════════════════════════════════════════════════════════════════════════
   rulesMeta.ts — Canonical rule data with metadata for the 3D scene
   ═══════════════════════════════════════════════════════════════════════════ */

export interface RuleMeta {
  number: string;       // "01"–"12"
  shortTitle: string;
  category: string;
  text: string;
  isHeat: boolean;      // disqualification rules get ember-red edge
}

export const RULES_META: RuleMeta[] = [
  {
    number: "01",
    shortTitle: "Eligibility",
    category: "Entry",
    text: "Open only to B.E./B.Tech students. Valid college ID required at check-in.",
    isHeat: false,
  },
  {
    number: "02",
    shortTitle: "Team size",
    category: "Entry",
    text: "Team size: 2 to 4 members. Cross-college teams are permitted. Team composition is locked at check-in.",
    isHeat: false,
  },
  {
    number: "03",
    shortTitle: "Entry fee",
    category: "Entry",
    text: "Entry fee is ₹400 per team, payable via the QR code on the event poster at registration. Non-refundable.",
    isHeat: false,
  },
  {
    number: "04",
    shortTitle: "Tracks & statements",
    category: "Format",
    text: "Teams may choose any of the 9 problem statements from any of the 3 tracks; all are judged on equal footing. Statement/track changes after Checkpoint 1 are not permitted.",
    isHeat: false,
  },
  {
    number: "05",
    shortTitle: "Checkpoints",
    category: "Format",
    text: "Every team's progress is reviewed at each checkpoint against that round's fixed checklist, verified by mentors. There is no elimination at any checkpoint — all teams continue to the next round, and checkpoint performance is factored into the final judging.",
    isHeat: false,
  },
  {
    number: "06",
    shortTitle: "The twist",
    category: "Format",
    text: "The twist is released simultaneously to all teams during Round 2 (Hr 3:00). Integrating it is mandatory and is the primary basis for the Adaptability/Pivot Handling score. No extensions.",
    isHeat: false,
  },
  {
    number: "07",
    shortTitle: "Built on the day",
    category: "Integrity",
    text: "Projects must be built during the event — pre-built or previously submitted projects are not allowed and will be disqualified on detection.",
    isHeat: true,
  },
  {
    number: "08",
    shortTitle: "AI & open source",
    category: "Integrity",
    text: "Use of AI coding assistants and open-source libraries is permitted but must be disclosed to mentors on request; core logic and integration must be the team's own work.",
    isHeat: false,
  },
  {
    number: "09",
    shortTitle: "Conduct",
    category: "Conduct",
    text: "Participants must behave respectfully toward mentors, judges, organizers and fellow teams. Harassment, sabotage, or disruptive behaviour results in immediate disqualification.",
    isHeat: true,
  },
  {
    number: "10",
    shortTitle: "Judging weights",
    category: "Scoring",
    text: "Judging: Technical Execution 30% · Innovation & Problem Fit 25% · Pitch & Demo Quality 25% · Adaptability/Pivot Handling 20%. Judges' scoring is final.",
    isHeat: false,
  },
  {
    number: "11",
    shortTitle: "Integrity",
    category: "Integrity",
    text: "Plagiarism, use of a pre-built project, or code-of-conduct violations are grounds for immediate disqualification at the organizers' discretion.",
    isHeat: true,
  },
  {
    number: "12",
    shortTitle: "Final say",
    category: "Governance",
    text: "Organizers reserve the right to amend schedule, rules, or the twist challenge for unforeseen circumstances. All organizer decisions are final and binding.",
    isHeat: false,
  },
];

export const CATEGORY_COLORS: Record<string, string> = {
  Entry: "#d9a94a",
  Format: "#7C9CF0",
  Integrity: "#FF5B3A",
  Conduct: "#FF5B3A",
  Scoring: "#4AE0B5",
  Governance: "#B485E0",
};
