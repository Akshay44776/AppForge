import type { Metadata, Viewport } from "next";
import { Space_Grotesk, Inter } from "next/font/google";
import "./globals.css";

const grotesk = Space_Grotesk({ subsets: ["latin"], variable: "--font-grotesk" });
const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  metadataBase: new URL("http://localhost:3000"),
  title: "AppForge — SJB Institute of Technology",
  description:
    "AppForge is a single-day app development challenge: three sealed problem statements, two rounds of unannounced twists, one day to build. Oct 30, 2026 · SJB Institute of Technology, Dept. of CSE.",
  openGraph: {
    title: "AppForge — Build something that wins",
    description: "Single-day app development challenge · Oct 30, 2026 · SJB Institute of Technology",
    images: ["/og.png"],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${grotesk.variable} ${inter.variable}`}>
      <body>{children}</body>
    </html>
  );
}
