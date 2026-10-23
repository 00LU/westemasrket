import { useState } from 'react';
import { Bell } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useNotifications } from '../../hooks/useNotifications';
import { errorMessage, formatDateTime } from '../../services/labels';
import { notificationPickupPath } from '../../services/pickupGuidance';

export default function NotificationBell() {
  const { items, unread, markRead, markAllRead, isLoading, error, retry, isMarking } = useNotifications();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        className="relative rounded-lg border border-slate-300 p-2 text-slate-600 hover:bg-slate-100"
        type="button"
        aria-label={`Notifiche${unread ? `: ${unread} non lette` : ''}`}
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <Bell size={16} />
        {unread > 0 && (
          <span className="absolute -right-1 -top-1 inline-flex min-h-5 min-w-5 items-center justify-center rounded-full bg-brand-900 px-1 text-[10px] font-bold text-white">
            {unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-40 mt-2 w-80 rounded-2xl border border-slate-200 bg-white p-3 shadow-xl">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-semibold text-slate-800">Notifiche</p>
            {unread > 0 && (
              <button type="button" disabled={isMarking} className="text-xs font-semibold text-brand-900" onClick={() => markAllRead()}>
                Segna tutte come lette
              </button>
            )}
          </div>
          <div className="max-h-96 space-y-2 overflow-y-auto">
            {isLoading && <p role="status" className="text-sm text-slate-500">Caricamento notifiche...</p>}
            {error && (
              <div role="alert" className="text-sm text-red-700">
                <p>{errorMessage(error, 'Impossibile aggiornare le notifiche.')}</p>
                <button type="button" onClick={retry} className="underline">Riprova</button>
              </div>
            )}
            {!isLoading && !error && items.length === 0 && <p className="text-sm text-slate-500">Nessuna notifica.</p>}
            {items.map((item) => {
              const path = notificationPickupPath(user?.role, item.payload?.pickupRequestId);
              return (
              <div
                key={item.id}
                className={`block w-full rounded-xl border px-3 py-2 text-left text-sm ${
                  item.read ? 'border-slate-200 bg-white text-slate-600' : 'border-brand-100 bg-brand-50 text-slate-900'
                }`}
              >
                <span className="block">{item.payload?.message || item.type}</span>
                <span className="block text-xs text-slate-500">{formatDateTime(item.createdAt)}</span>
                {path ? (
                  <Link to={path} onClick={() => { if (!item.read) markRead(item.id); setOpen(false); }} className="mt-1 inline-block font-semibold text-brand-900 underline">
                    Apri richiesta
                  </Link>
                ) : !item.read && (
                  <button type="button" disabled={isMarking} onClick={() => markRead(item.id)} className="mt-1 underline">Segna come letta</button>
                )}
              </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
