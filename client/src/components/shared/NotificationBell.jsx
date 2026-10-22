import { useState } from 'react';
import { Bell } from 'lucide-react';
import { useNotifications } from '../../hooks/useNotifications';
import { formatDateTime } from '../../services/labels';

export default function NotificationBell() {
  const { items, unread, markRead, markAllRead } = useNotifications();
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        className="relative rounded-lg border border-slate-300 p-2 text-slate-600 hover:bg-slate-100"
        type="button"
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
              <button type="button" className="text-xs font-semibold text-brand-900" onClick={markAllRead}>
                Segna tutte come lette
              </button>
            )}
          </div>
          <div className="max-h-96 space-y-2 overflow-y-auto">
            {items.length === 0 && <p className="text-sm text-slate-500">Nessuna notifica.</p>}
            {items.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => markRead(item.id)}
                className={`block w-full rounded-xl border px-3 py-2 text-left text-sm ${
                  item.read ? 'border-slate-200 bg-white text-slate-600' : 'border-brand-100 bg-brand-50 text-slate-900'
                }`}
              >
                <span className="block">{item.payload?.message || item.type}</span>
                <span className="block text-xs text-slate-500">{formatDateTime(item.createdAt)}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
