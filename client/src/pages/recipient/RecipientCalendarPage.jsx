import { useMemo, useState } from 'react';
import RoleLayout from '../../components/shared/RoleLayout';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import { useQuery } from '@tanstack/react-query';
import { fetchIncomingShipments } from '../../services/recipientApi';

const links = [{ to: '/recipient', label: 'Dashboard' }, { to: '/recipient/opportunities', label: 'Ordini compatibili' }, { to: '/recipient/calendar', label: 'Calendario conferimenti' }, { to: '/recipient/incoming', label: 'Arrivi e conferimenti' }, { to: '/recipient/capacity', label: 'Disponibilita e capacita' }, { to: '/recipient/facilities', label: 'Impianti e autorizzazioni' }, { to: '/recipient/earnings', label: 'Corrispettivi' }, { to: '/profile', label: 'Profilo' }];
const dateKey = (value) => { if (!value) return ''; const date = new Date(value); return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`; };

export default function RecipientCalendarPage() {
  const [month, setMonth] = useState(() => new Date());
  const { data = [], isLoading } = useQuery({ queryKey: ['recipient', 'calendar'], queryFn: fetchIncomingShipments });
  const byDate = useMemo(() => data.reduce((map, item) => ({ ...map, [dateKey(item.deadline)]: [...(map[dateKey(item.deadline)] || []), item] }), {}), [data]);
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const offset = (first.getDay() + 6) % 7;
  const total = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const days = Array.from({ length: Math.ceil((offset + total) / 7) * 7 }, (_, index) => { const day = index - offset + 1; return day > 0 && day <= total ? new Date(month.getFullYear(), month.getMonth(), day) : null; });
  return <RoleLayout title="Calendario conferimenti" links={links}><Card title="Conferimenti pianificati"><div className="mb-4 flex items-center justify-between"><Button type="button" variant="secondary" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}>Precedente</Button><strong className="capitalize">{month.toLocaleDateString('it-IT', { month: 'long', year: 'numeric' })}</strong><Button type="button" variant="secondary" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}>Successivo</Button></div>{isLoading ? <p className="text-sm text-slate-600">Caricamento calendario...</p> : <><div className="grid grid-cols-7 gap-1 text-center text-xs font-semibold text-slate-500">{['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'].map((day) => <span key={day}>{day}</span>)}</div><div className="mt-1 grid grid-cols-7 gap-1">{days.map((day, index) => <div key={day?.toISOString() || `empty-${index}`} className={`min-h-20 rounded-lg border p-2 ${day ? 'border-slate-200 bg-white' : 'border-transparent bg-slate-50'}`}>{day && <><p className="text-xs font-semibold">{day.getDate()}</p>{(byDate[dateKey(day)] || []).map((item) => <div key={item.id} className="mt-1 truncate rounded bg-brand-900 px-1 text-[10px] text-white">CER {item.cerCode}</div>)}</>}</div>)}</div></>}</Card></RoleLayout>;
}
