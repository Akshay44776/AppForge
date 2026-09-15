const STATS = [
  ["₹50,000", "Prize pool"],
  ["1 day", "Format"],
  ["2–4", "Team size"],
  ["₹400", "Entry fee per team"],
] as const;

export default function Prizes() {
  return (
    <section id="prizes" className="section-pad bg-surface/40 border-y border-line">
      <div className="wrap">
        <p className="kicker mb-3">Prizes</p>
        <h2 className="font-display text-3xl sm:text-5xl leading-tight">Win big at AppForge</h2>
        <p className="mt-8 font-display text-6xl sm:text-8xl text-gold">₹50,000</p>
        <p className="mt-3 text-muted">Awarded across winning teams at the closing ceremony.</p>
        <p className="mt-6 text-xs text-muted max-w-2xl leading-relaxed">
          Rewards are structured based on the final number of registered teams. If the number
          of participating teams is lower than expected, the reward structure will be tailored
          accordingly by the organizing committee, while the total prize pool value remains
          the benchmark.
        </p>

        <div className="mt-16 grid grid-cols-2 md:grid-cols-4 border-t border-line">
          {STATS.map(([v, l], i) => (
            <div key={l} className={`py-8 pr-6 ${i !== 0 ? "border-l border-line pl-6" : ""} ${i === 2 ? "border-l-0 md:border-l pl-0 md:pl-6" : ""}`}>
              <p className="font-display text-3xl text-paper">{v}</p>
              <p className="mt-1 text-sm text-muted">{l}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
