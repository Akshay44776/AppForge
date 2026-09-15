# AppForge — event site

Single-page Next.js 14 (App Router) site for the AppForge app development challenge,
built to the Antigravity playbook (phases 0–11). Stack: Tailwind CSS, Framer Motion,
GSAP (installed for later use), React Three Fiber (Three.js).

## Run

```bash
npm install
npm run dev
```

Open http://localhost:3000

## Before launch — replace these

1. **`lib/site.ts` → `REGISTRATION_URL`** — paste the real Google Form / portal link
   (currently `https://forms.gle/REPLACE-ME`).
2. **`lib/site.ts` → `TECHFEST_URL`** or env `NEXT_PUBLIC_TECHFEST_URL` — the "← Back to
   TechFest" nav link target.
3. **`public/frames/`** — the 300 JPGs shipped here are *programmatic placeholders*
   (branded gradient + constellation). Replace with your real 960px-wide frames extracted
   from the event video, named `frame_001.jpg … frame_300.jpg`. No code changes needed.
4. **`app/icon.png`, `public/og.png`, `public/textures/*`** — placeholder artwork
   generated to the design tokens; regenerate with the Nano Banana prompts in the
   playbook for production quality.
5. **`components/Tracks.tsx`** — after the reveal on event day, flip each `<Dossier />`
   to `sealed={false}` and pass `title` / `body` for the real problem statements. The
   unlock animation triggers automatically on that prop change (no auto-timer).

## Deploy (Phase 13)

Deploys as a standalone route, e.g. `https://<domain>/events/app-development-challenge`
or a subdomain like `appforge.<domain>` — paste that final URL into the TechFest
homepage's "App Development Challenge" card href.

## Performance notes

- Scroll-scrub frames lazy-load only when the section approaches the viewport
  (IntersectionObserver, 200% rootMargin); loader appears until ~30% are decoded.
- `NetworkField` is code-split (`ssr: false`) and never instantiates Three.js on
  low-end devices, reduced-motion users, or no-WebGL browsers — those get a static
  CSS gradient fallback. Rendering pauses off-screen and on hidden tabs.
- Twist-deck 3D flip degrades to a crossfade on touch devices and reduced-motion.
