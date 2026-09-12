import { LogOut } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import NotificationBell from './NotificationBell';

export default function Navbar({ title }) {
  const { user, logout } = useAuth();
  const profileName = user?.companyName || user?.email || 'Profilo';
  const profileInitial = profileName.charAt(0).toUpperCase();

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
        <div>
          <p className="font-display text-xl font-bold text-brand-900">WasteMarket</p>
          <p className="text-xs text-slate-500">{title}</p>
        </div>
        <div className="flex items-center gap-3">
          <NotificationBell />
          <Link className="flex items-center gap-2 rounded-xl px-2 py-1.5 hover:bg-slate-100" to="/profile" title="Apri il profilo">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-900 text-sm font-bold text-white">
              {profileInitial}
            </span>
            <span className="hidden text-right sm:block">
              <span className="block text-sm font-semibold text-slate-800">{profileName}</span>
              <span className="block text-xs uppercase tracking-wide text-slate-500">{user?.role}</span>
            </span>
          </Link>
          <button className="rounded-lg border border-slate-300 p-2 text-slate-600 hover:bg-slate-100" onClick={logout}>
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </header>
  );
}
