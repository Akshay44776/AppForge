export type RuleCategory =
  | "Eligibility & Entry"
  | "Format & Fair Play"
  | "Integrity & Conduct"
  | "Judging & Authority";

export interface Rule {
  id: number;
  category: RuleCategory;
  title: string; // card label
  body: string; // full rule text (panel + screen readers)
  facts?: [label: string, value: string][]; // panel table rows, max 5
}

export const rules: Rule[] = [
  {
    id: 1,
    category: "Eligibility & Entry",
    title: "Who can enter",
    body: "Open only to B.E./B.Tech students. Valid college ID required at check-in.",
    facts: [
      ["Open to", "B.E./B.Tech students"],
      ["At check-in", "Valid college ID required"],
    ],
  },
  {
    id: 2,
    category: "Eligibility & Entry",
    title: "Team size",
    body: "2 to 4 members. Cross-college teams are permitted. Team composition is locked at check-in.",
    facts: [
      ["Members", "2 to 4"],
      ["Cross-college teams", "Permitted"],
      ["Team composition", "Locked at check-in"],
    ],
  },
  {
    id: 3,
    category: "Eligibility & Entry",
    title: "Entry fee",
    body: "₹400 per team, payable via the QR code on the event poster at registration. Non-refundable.",
    facts: [
      ["Fee", "₹400 per team"],
      ["Payment", "QR code on the event poster, at registration"],
      ["Refund", "Non-refundable"],
    ],
  },
  {
    id: 4,
    category: "Format & Fair Play",
    title: "Choosing your problem",
    body: "Teams may choose any of the 9 problem statements from any of the 3 tracks; all are judged on equal footing. Statement/track changes after Checkpoint 1 are not permitted.",
    facts: [
      ["Choice", "Any of the 9 problem statements, from any of the 3 tracks"],
      ["Judging", "All on equal footing"],
      ["Changes", "Not permitted after Checkpoint 1"],
    ],
  },
  {
    id: 5,
    category: "Format & Fair Play",
    title: "No elimination",
    body: "Every team's progress is reviewed at each checkpoint against that round's fixed checklist, verified by mentors. There is no elimination at any checkpoint — all teams continue to the next round, and checkpoint performance is factored into the final judging.",
    facts: [
      ["Review", "Each checkpoint, against that round's fixed checklist"],
      ["Verified by", "Mentors"],
      ["Elimination", "None — all teams continue"],
      ["Counts toward", "Final judging"],
    ],
  },
  {
    id: 6,
    category: "Format & Fair Play",
    title: "The twist is mandatory",
    body: "The twist is released simultaneously to all teams during Round 2 (Hr 3:00). Integrating it is mandatory and is the primary basis for the Adaptability/Pivot Handling score. No extensions.",
    facts: [
      ["Released", "Round 2 (Hr 3:00), to all teams simultaneously"],
      ["Integration", "Mandatory"],
      ["Scored under", "Adaptability/Pivot Handling"],
      ["Extensions", "None"],
    ],
  },
  {
    id: 7,
    category: "Integrity & Conduct",
    title: "Build it on the day",
    body: "Projects must be built during the event — pre-built or previously submitted projects are not allowed and will be disqualified on detection.",
    facts: [
      ["Build window", "During the event"],
      ["Pre-built / previously submitted", "Not allowed"],
      ["If detected", "Disqualification"],
    ],
  },
  {
    id: 8,
    category: "Integrity & Conduct",
    title: "AI tools & libraries",
    body: "Use of AI coding assistants and open-source libraries is permitted but must be disclosed to mentors on request; core logic and integration must be the team's own work.",
    facts: [
      ["AI assistants & open-source libraries", "Permitted"],
      ["Disclosure", "To mentors, on request"],
      ["Core logic & integration", "Team's own work"],
    ],
  },
  {
    id: 9,
    category: "Integrity & Conduct",
    title: "Respectful conduct",
    body: "Participants must behave respectfully toward mentors, judges, organizers and fellow teams. Harassment, sabotage, or disruptive behaviour results in immediate disqualification.",
    facts: [
      ["Toward", "Mentors, judges, organizers, fellow teams"],
      ["Harassment, sabotage, disruption", "Immediate disqualification"],
    ],
  },
  {
    id: 10,
    category: "Judging & Authority",
    title: "How scoring breaks down",
    body: "Technical Execution 30% · Innovation & Problem Fit 25% · Pitch & Demo Quality 25% · Adaptability/Pivot Handling 20%. Judges' scoring is final.",
    facts: [
      ["Technical Execution", "30%"],
      ["Innovation & Problem Fit", "25%"],
      ["Pitch & Demo Quality", "25%"],
      ["Adaptability/Pivot Handling", "20%"],
      ["Judges' scoring", "Final"],
    ],
  },
  {
    id: 11,
    category: "Judging & Authority",
    title: "Disqualification grounds",
    body: "Plagiarism, use of a pre-built project, or code-of-conduct violations are grounds for immediate disqualification at the organizers' discretion.",
    facts: [
      ["Grounds", "Plagiarism · Pre-built project · Code-of-conduct violations"],
      ["Outcome", "Immediate disqualification"],
      ["Decided", "At the organizers' discretion"],
    ],
  },
  {
    id: 12,
    category: "Judging & Authority",
    title: "Organizers have final say",
    body: "Organizers reserve the right to amend schedule, rules, or the twist challenge for unforeseen circumstances. All organizer decisions are final and binding.",
    facts: [
      ["Organizers may amend", "Schedule, rules, or the twist challenge"],
      ["Reason", "Unforeseen circumstances"],
      ["Decisions", "Final and binding"],
    ],
  },
];

/** Zero-padded card number: 01 … 12 */
export const pad2 = (n: number) => String(n).padStart(2, "0");

export const rulesByCategory = (c: RuleCategory) =>
  rules.filter((r) => r.category === c);
