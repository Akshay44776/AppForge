import Nav from "@/components/Nav";
import ScrollScrubHero from "@/components/ScrollScrubHero";
import About from "@/components/About";
import Tracks from "@/components/Tracks";
import TwistDeck from "@/components/TwistDeck";
import JudgingSimulation from "@/components/judging/JudgingSimulation";
import Prizes from "@/components/Prizes";
import dynamic from "next/dynamic";

const RulesSection = dynamic(() => import("@/components/rules/RulesSection"), {
  ssr: false,
  loading: () => (
    <section id="rules" style={{ background: "#07090d", minHeight: "100vh", padding: "clamp(4rem,10vw,8rem) 0" }}>
      <div className="wrap">
        <p className="kicker mb-3">Rulebook</p>
        <h2 className="font-display text-3xl sm:text-5xl leading-tight">The Twelve Gates</h2>
      </div>
    </section>
  ),
});
import People from "@/components/People";
import Register from "@/components/Register";
import Footer from "@/components/Footer";

export default function Page() {
  return (
    <>
      <Nav />
      <main>
        <ScrollScrubHero />
        <About />
        <Tracks />
        <TwistDeck />
        <JudgingSimulation />
        <Prizes />
        <RulesSection />
        <People />
        <Register />
      </main>
      <Footer />
    </>
  );
}
