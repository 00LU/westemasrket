import { Check } from 'lucide-react';

// Vertical progress tracker shared by every role's request detail page.
export default function ProgressTimeline({ steps, current, cancelled = false, label = 'Avanzamento della richiesta' }) {
  const circle = {
    done: 'bg-brand-900 text-white',
    current: 'bg-accent-500 text-white ring-4 ring-accent-100',
    idle: 'bg-slate-100 text-slate-400',
  };

  return (
    <ol aria-label={label}>
      {steps.map(([key, text], index) => {
        const state = cancelled ? 'idle' : index < current ? 'done' : index === current ? 'current' : 'idle';
        const last = index === steps.length - 1;
        return (
          <li key={key} className="flex gap-3" aria-current={state === 'current' ? 'step' : undefined}>
            <div className="flex flex-col items-center">
              <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${circle[state]}`}>
                {state === 'done' ? <Check size={14} aria-hidden="true" /> : index + 1}
              </span>
              {!last && <span className={`my-1 min-h-4 w-0.5 flex-1 rounded-full ${state === 'done' ? 'bg-brand-900' : 'bg-slate-200'}`} aria-hidden="true" />}
            </div>
            <p className={`pt-1 text-sm ${last ? '' : 'pb-4'} ${state === 'current' ? 'font-bold text-slate-900' : state === 'done' ? 'font-semibold text-slate-700' : 'text-slate-400'}`}>
              {text}
              {state === 'done' && <span className="sr-only"> (completato)</span>}
              {state === 'current' && <span className="sr-only"> (passaggio attuale)</span>}
            </p>
          </li>
        );
      })}
    </ol>
  );
}
