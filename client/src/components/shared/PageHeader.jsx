import { CalendarDays, ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import NotificationBell from './NotificationBell';

export default function PageHeader({ title }) {
  const { user } = useAuth();
  const today = new Date();
  const home = user?.role === 'admin' ? '/admin/users' : `/${user?.role}`;
  const agenda = user?.role && user.role !== 'admin' ? `/${user.role}/agenda` : null;
  const weekday = today.toLocaleDateString('it-IT', { weekday: 'short' });
  const month = today.toLocaleDateString('it-IT', { month: 'long' });

  return (
    <header className="flex flex-wrap items-start justify-between gap-4 px-1 pt-1">
      <div className="min-w-0">
        <h1 className="font-display text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">{title}</h1>
        <nav aria-label="Percorso" className="mt-2 flex items-center gap-1 text-sm text-slate-500">
          <Link to={home} className="hover:text-slate-900">Home</Link>
          <ChevronRight size={14} aria-hidden="true" />
          <span className="font-medium text-slate-600">{title}</span>
        </nav>
      </div>
      <div className="flex items-center gap-3">
        <div className="hidden items-center gap-3 rounded-full bg-white py-1.5 pl-5 pr-1.5 shadow-soft sm:flex">
          <span className="font-display text-2xl font-bold leading-none text-slate-900">{today.getDate()}</span>
          <span className="text-xs font-medium capitalize leading-tight text-slate-600">{weekday},<br />{month}</span>
          {agenda ? (
            <Link to={agenda} aria-label="Apri l’agenda" className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 text-slate-700 hover:bg-slate-50">
              <CalendarDays size={16} aria-hidden="true" />
            </Link>
          ) : (
            <span className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 text-slate-700">
              <CalendarDays size={16} aria-hidden="true" />
            </span>
          )}
        </div>
        <NotificationBell />
      </div>
    </header>
  );
}
