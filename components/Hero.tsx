export default function Hero() {
  return (
    <section id="hero" className="relative min-h-screen flex items-center overflow-hidden">
      <div
        className="absolute inset-0 network-fallback opacity-60"
        aria-hidden
      />
      <div className="wrap relative py-24">
        <p className="kicker mb-4">SJB Institute of Technology · Dept. of CSE</p>
        <h1 className="font-display text-6xl sm:text-8xl lg:text-9xl leading-none text-paper">
          App<span className="text-gold">Forge</span>
        </h1>
        <p className="mt-6 max-w-xl text-lg text-muted">
          A single-day app development challenge where the brief changes while you build.
          Three sealed tracks. Two rounds of twists. One day to ship.
        </p>
        <div className="mt-10 flex flex-wrap items-center gap-4">
          <a
            href="#register"
            className="bg-gold text-ink font-medium px-6 py-3 rounded hover:bg-goldbright transition-colors"
          >
            Register your team
          </a>
          <span className="text-muted text-sm">Oct 30, 2026 · On campus</span>
        </div>
      </div>
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 text-muted text-xs tracking-widest uppercase"
           aria-hidden>
        Scroll
      </div>
    </section>
  );
}
