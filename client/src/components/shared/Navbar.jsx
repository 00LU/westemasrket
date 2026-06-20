import { LogOut } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import NotificationBell from './NotificationBell';

export default function Navbar({ title }) {
  const { user, logout } = useAuth();

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
        <div>
          <p className="font-display text-xl font-bold text-brand-900">WasteMarket</p>
          <p className="text-xs text-slate-500">{title}</p>
        </div>
        <div className="flex items-center gap-3">
          <NotificationBell />
          <div className="hidden text-right sm:block">
            <p className="text-sm font-semibold text-slate-800">{user?.companyName}</p>
            <p className="text-xs uppercase tracking-wide text-slate-500">{user?.role}</p>
          </div>
          <button className="rounded-lg border border-slate-300 p-2 text-slate-600 hover:bg-slate-100" onClick={logout}>
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </header>
  );
}
