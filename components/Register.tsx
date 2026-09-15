import Countdown from "./Countdown";
import { EVENT_DATE, REGISTRATION_URL } from "@/lib/site";

export default function Register() {
  return (
    <section id="register" className="section-pad">
      <div className="wrap">
        <div className="grid lg:grid-cols-[1.5fr_1fr] gap-14">
          <div>
            <p className="kicker mb-3">Registration</p>
            <h2 className="font-display text-3xl sm:text-5xl leading-tight">Register your team</h2>
            <p className="mt-5 text-muted leading-relaxed" style={{ maxWidth: "60ch" }}>
              Teams of 2 to 4, open to all B.E. / B.Tech students. Scan the event QR code or
              write in to{" "}
              <a href="mailto:appforge.cse@gmail.com" className="text-gold hover:text-goldbright">
                appforge.cse@gmail.com
              </a>{" "}
              to reserve your slot before Oct 30. Bring your laptop, your team, and your best
              instincts — the brief will do the rest.
            </p>
            <p className="mt-4 text-sm text-muted">
              ₹400 per team, paid via event QR at check-in.
            </p>
            <a
              href={REGISTRATION_URL}
              className="inline-block mt-8 bg-gold text-ink font-medium px-7 py-3.5 rounded hover:bg-goldbright transition-colors"
            >
              Register your team
            </a>
          </div>
          <div className="border border-line bg-surface p-8 flex flex-col justify-center gap-3 self-start">
            <p className="text-xs uppercase tracking-widest text-muted">Build day in</p>
            <Countdown to={EVENT_DATE} withSeconds />
            <p className="mt-2 text-sm text-muted">Oct 30, 2026 · 09:00 IST · On campus</p>
          </div>
        </div>
      </div>
    </section>
  );
}
