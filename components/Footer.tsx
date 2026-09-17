export default function Footer() {
  return (
    <footer className="border-t border-line py-12">
      <div className="wrap">
        <p className="text-center text-xs tracking-[0.35em] text-gold mb-10">
          SMALL STEPS / BIG SOLUTIONS / A SMARTER TOMORROW
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-sm text-muted">
          <p>Dept. of CSE · SJB Institute of Technology · AppForge </p>
          <a href="mailto:appforge.cse@gmail.com" className="hover:text-gold transition-colors">
            appforge.cse@gmail.com
          </a>
        </div>
      </div>
    </footer>
  );
}
