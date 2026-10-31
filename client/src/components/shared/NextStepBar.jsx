import { ArrowDown, ArrowRight } from 'lucide-react';
import { scrollToSection } from '../../services/scrollToSection';

// Always-visible "next step" bar: it stays at the top while scrolling (from tablet up) and its
// button jumps to the section where the action takes place.
export default function NextStepBar({ children, target, action }) {
  return (
    <section aria-label="Prossimo passo" className="z-30 flex flex-wrap items-center gap-4 rounded-2xl bg-accent-500 px-5 py-4 text-white shadow-lg md:sticky md:top-3">
      <span className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/20 sm:flex">
        <ArrowRight size={18} aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1 basis-64">
        <p className="text-xs font-semibold uppercase tracking-wide text-white/80">Prossimo passo</p>
        <div role="status" className="font-semibold leading-snug">{children}</div>
      </div>
      {(target || action) && (
        <div className="flex flex-wrap gap-2">
          {action}
          {target && (
            <button
              type="button"
              onClick={() => scrollToSection(target.id)}
              className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-bold text-accent-700 shadow-sm transition hover:bg-white/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-accent-500"
            >
              {target.label}
              <ArrowDown size={16} aria-hidden="true" />
            </button>
          )}
        </div>
      )}
    </section>
  );
}
