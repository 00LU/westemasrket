import { Bell } from 'lucide-react';
import { useNotifications } from '../../hooks/useNotifications';

export default function NotificationBell() {
  const notifications = useNotifications();

  return (
    <button className="relative rounded-lg border border-slate-300 p-2 text-slate-600 hover:bg-slate-100" type="button">
      <Bell size={16} />
      {notifications.length > 0 && (
        <span className="absolute -right-1 -top-1 inline-flex min-h-5 min-w-5 items-center justify-center rounded-full bg-brand-900 px-1 text-[10px] font-bold text-white">
          {notifications.length}
        </span>
      )}
    </button>
  );
}
