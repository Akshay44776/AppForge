import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "var(--ink)",
        surface: "var(--surface)",
        surface2: "var(--surface-2)",
        line: "var(--line)",
        gold: "var(--gold)",
        goldbright: "var(--gold-bright)",
        paper: "var(--paper)",
        muted: "var(--muted)",
        periwinkle: "var(--periwinkle)",
      },
      fontFamily: {
        display: ["var(--font-grotesk)", "sans-serif"],
        body: ["var(--font-inter)", "sans-serif"],
      },
    },
  },
  plugins: [],
};
export default config;
