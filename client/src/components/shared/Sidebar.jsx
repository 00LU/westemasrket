import { useRef } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { BarChart3, CalendarDays, ClipboardList, LayoutDashboard, LogOut, Menu, PlusCircle, Recycle, Repeat, ShieldCheck, UserRound, Users, Wallet } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { ROLE_LABELS } from '../../services/labels';

const ICONS = [
  ['/profile', UserRound],
  ['/new-request', PlusCircle],
  ['/recurring-orders', Repeat],
  ['/requests', ClipboardList],
  ['/agenda', CalendarDays],
  ['/earnings', Wallet],
  ['/admin/users', Users],
  ['/admin/analytics', BarChart3],
  ['/admin/compliance', ShieldCheck],
];

const iconFor = (path) => ICONS.find(([suffix]) => path.endsWith(suffix))?.[1] || LayoutDashboard;

export default function Sidebar({ links }) {
  const menu = useRef(null);
  const { user, logout } = useAuth();
  const profileName = user?.companyName || user?.email || 'Profilo';

  const profile = (
    <div className="flex flex-col items-center text-center">
      <p className="mb-5 flex items-center gap-2 font-display text-xl font-bold text-brand-900">
        <Recycle size={22} aria-hidden="true" /> WasteMarket
      </p>
      <Link to="/profile" title="Apri il profilo" aria-label={`Apri il profilo di ${profileName}`} className="group flex max-w-full flex-col items-center rounded-2xl p-2 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500">
        <span className="relative">
          <span className="flex h-20 w-20 items-center justify-center rounded-full bg-brand-100 font-display text-3xl font-bold text-brand-900 transition group-hover:bg-brand-200">
            {profileName.charAt(0).toUpperCase()}
          </span>
          <span className="absolute bottom-1 right-1 h-3.5 w-3.5 rounded-full border-2 border-white bg-emerald-500" aria-hidden="true" />
        </span>
        <span className="mt-3 max-w-full truncate font-display text-base font-semibold text-slate-900 group-hover:underline">{profileName}</span>
        <span className="max-w-full truncate text-xs text-slate-500">{user?.email}</span>
      </Link>
      <p className="mt-2 rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-600">
        {ROLE_LABELS[user?.role] || 'Amministratore'}
      </p>
    </div>
  );

  const navigation = (
    <nav aria-label="Navigazione del ruolo" className="space-y-1.5">
      {links.map((link) => {
        const Icon = iconFor(link.to);
        return (
          <NavLink key={link.to} to={link.to} end onClick={() => { if (menu.current) menu.current.open = false; }}
            className={({ isActive }) => `flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold transition ${isActive ? 'bg-brand-900 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'}`}>
            <Icon size={18} aria-hidden="true" />
            {link.label}
          </NavLink>
        );
      })}
    </nav>
  );

  const logoutButton = (
    <button type="button" onClick={logout} className="flex w-full items-center gap-3 rounded-btn border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">
      <LogOut size={18} aria-hidden="true" /> Esci dall’account
    </button>
  );

  const content = (
    <>
      {profile}
      <div className="mt-6 flex-1">{navigation}</div>
      <div className="mt-6">{logoutButton}</div>
    </>
  );

  return (
    <aside className="rounded-2xl bg-white p-4 shadow-soft lg:sticky lg:top-6 lg:flex lg:h-[calc(100vh-5rem)] lg:flex-col lg:self-start lg:overflow-y-auto lg:p-5">
      <details ref={menu} className="lg:hidden">
        <summary className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-brand-900">
          <Menu size={18} aria-hidden="true" /> Menu di navigazione
        </summary>
        <div className="mt-4 flex flex-col">{content}</div>
      </details>
      <div className="hidden min-h-full flex-col lg:flex">{content}</div>
    </aside>
  );
}
