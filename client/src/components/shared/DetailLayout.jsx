import { Children } from 'react';
import { ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

export function BackLink({ to, children }) {
  return (
    <Link to={to} className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-soft transition hover:bg-slate-50">
      <ArrowLeft size={16} aria-hidden="true" /> {children}
    </Link>
  );
}

// Keep the description first, then the current phase, even while waiting for other parties.
export function ActiveFirst({ activeId, secondaryId, children }) {
  const [first, ...rest] = Children.toArray(children);
  const active = rest.filter((child) => activeId && child.props?.id === activeId);
  const secondary = rest.filter((child) => secondaryId && child.props?.id === secondaryId && !active.includes(child));
  return <>{[first, ...active, ...secondary, ...rest.filter((child) => !active.includes(child) && !secondary.includes(child))]}</>;
}

// Next-step bar on top (sticky), main content on the left, status and history on the right.
export default function DetailLayout({ nextStep, aside, children }) {
  return (
    <div className="space-y-5">
      {nextStep}
      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr),360px]">
        <div className="min-w-0 space-y-5">{children}</div>
        <aside aria-label="Riepilogo e avanzamento" className="min-w-0 space-y-5">{aside}</aside>
      </div>
    </div>
  );
}
