const CRITERIA = [
  ["Problem understanding", "How well the build addresses the track's base problem and its real-world relevance."],
  ["Technical execution", "Code quality, functionality, and how much of the build actually works end to end."],
  ["Adaptability", "How cleanly both twist cards were absorbed into the product, not bolted on."],
  ["UI / UX", "Usability and design quality of the final build."],
  ["Impact & scalability", "Whether the idea could hold up beyond the hackathon table."],
  ["Presentation", "Clarity of the live demo and how well the team explains their own build."],
] as const;

export default function Evaluation() {
  return (
    <section id="evaluation" className="section-pad">
      <div className="wrap">
        <p className="kicker mb-3">Judging</p>
        <h2 className="font-display text-3xl sm:text-5xl leading-tight">How teams are judged</h2>
        <div className="mt-12 grid sm:grid-cols-2 gap-x-14 gap-y-8 max-w-4xl">
          {CRITERIA.map(([title, body]) => (
            <div key={title} className="flex gap-4">
              <span className="text-gold mt-1" aria-hidden>◆</span>
              <div>
                <h3 className="font-display text-lg text-paper">{title}</h3>
                <p className="mt-1 text-sm text-muted leading-relaxed">{body}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
