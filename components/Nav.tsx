"use client";

import { useEffect, useState } from "react";
import { TECHFEST_URL } from "@/lib/site";

const LINKS = [
  { href: "#about", label: "About" },
  { href: "#tracks", label: "Tracks" },
  { href: "#twistdeck", label: "Twist Deck" },
  { href: "#evaluation", label: "Evaluation" },
  { href: "#prizes", label: "Prizes" },
  { href: "#rules", label: "Rules" },
  { href: "#people", label: "People" },
  { href: "#register", label: "Register" },
];

export default function Nav() {
  const [solid, setSolid] = useState(false);

  useEffect(() => {
    const onScroll = () => setSolid(window.scrollY > window.innerHeight * 0.85);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-colors duration-300 ${
        solid ? "bg-surface/95 backdrop-blur border-b border-line" : "bg-transparent"
      }`}
    >
      <nav className="wrap flex h-14 items-center justify-between gap-4">
        <a href={TECHFEST_URL} className="text-sm text-muted hover:text-gold transition-colors shrink-0"
           aria-label="Back to TechFest homepage">
          ← Back to TechFest
        </a>
        <ul className="hidden lg:flex items-center gap-6">
          {LINKS.map((l) => (
            <li key={l.href}>
              <a href={l.href} className="text-sm text-paper/80 hover:text-gold transition-colors">
                {l.label}
              </a>
            </li>
          ))}
        </ul>
        <a
          href="#register"
          className="lg:hidden text-sm font-medium text-gold border border-gold/40 rounded px-3 py-1.5 hover:bg-gold/10 transition-colors"
        >
          Register
        </a>
      </nav>
    </header>
  );
}
