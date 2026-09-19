import Nav from "@/components/Nav";
import ScrollScrubHero from "@/components/ScrollScrubHero";
import About from "@/components/About";
import Tracks from "@/components/Tracks";
import TwistDeck from "@/components/TwistDeck";
import JudgingSimulation from "@/components/judging/JudgingSimulation";
import Prizes from "@/components/Prizes";
import Rules from "@/components/Rules";
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
        <Rules />
        <People />
        <Register />
      </main>
      <Footer />
    </>
  );
}
