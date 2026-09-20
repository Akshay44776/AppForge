/* eslint-disable @next/next/no-img-element */
import NetworkField from "./NetworkField";

const FEATURES = [
  {
    title: "Pick a track, not a plan",
    body: "Three domains, one revealed problem statement — no pre-built projects.",
  },
  {
    title: "Two rounds of twists",
    body: "A light card early in the build, a heavier card later in the day.",
  },
  {
    title: "Judged on adaptability",
    body: "Not just what you built — how well it bent without breaking.",
  },
];

export default function About() {
  return (
    <section id="about" className="relative section-pad overflow-hidden">
      <div className="absolute inset-0 opacity-40"><NetworkField /></div>
      <div className="wrap relative">
        <div className="grid lg:grid-cols-[1.4fr_1fr] gap-12 items-center">
          <div>
            <p className="kicker mb-3">About the challenge</p>
            <h2 className="font-display text-3xl sm:text-5xl leading-tight max-w-[16ch]">
              Build what the brief needs, not what you brought from home
            </h2>
            <p className="mt-6 text-muted leading-relaxed" style={{ maxWidth: "65ch" }}>
              AppForge is a single-day app development challenge built around one idea: real
              products change shape mid-build. Teams don&apos;t get a fixed problem statement and
              eight hours to execute a plan made last night. They get a track, a base problem,
              and two rounds of unannounced twists that reshape what &apos;done&apos; means. Every
              team starts on equal footing — what separates the top three is how well a
              team&apos;s app survives contact with a changing brief, the same test any product
              team faces once real users show up.
            </p>
          </div>
          <img
            src="/textures/about-graphic.png"
            alt=""
            className="hidden lg:block w-full opacity-70"
            loading="lazy"
          />
        </div>
        <div className="mt-16 grid sm:grid-cols-3 gap-8">
          {FEATURES.map((f) => (
            <div key={f.title} className="border-t border-line pt-5">
              <h3 className="font-display text-lg text-paper">{f.title}</h3>
              <p className="mt-2 text-sm text-muted leading-relaxed">{f.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
