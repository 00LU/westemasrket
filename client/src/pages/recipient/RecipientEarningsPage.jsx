import RoleLayout from '../../components/shared/RoleLayout';
import Card from '../../components/ui/Card';
import { useQuery } from '@tanstack/react-query';
import { fetchIncomingShipments } from '../../services/recipientApi';

const links = [{ to: '/recipient', label: 'Dashboard' }, { to: '/recipient/opportunities', label: 'Ordini compatibili' }, { to: '/recipient/calendar', label: 'Calendario conferimenti' }, { to: '/recipient/incoming', label: 'Arrivi e conferimenti' }, { to: '/recipient/capacity', label: 'Disponibilita e capacita' }, { to: '/recipient/facilities', label: 'Impianti e autorizzazioni' }, { to: '/recipient/earnings', label: 'Corrispettivi' }, { to: '/profile', label: 'Profilo' }];

export default function RecipientEarningsPage() {
  const { data = [], isLoading } = useQuery({ queryKey: ['recipient', 'earnings'], queryFn: fetchIncomingShipments });
  const total = data.reduce((sum, item) => sum + Number(item.recipientPricePerTon || 0) * Number(item.quantityTon || 0), 0);
  return <RoleLayout title="Corrispettivi e fatturazione" links={links}><Card title="Riepilogo mensile"><div className="grid gap-3 text-sm sm:grid-cols-3"><div className="rounded-xl border border-slate-200 p-3"><p className="text-slate-500">Conferimenti</p><p className="text-2xl font-bold">{isLoading ? '-' : data.length}</p></div><div className="rounded-xl border border-slate-200 p-3"><p className="text-slate-500">Valore stimato</p><p className="text-2xl font-bold">EUR {total.toLocaleString()}</p></div><div className="rounded-xl border border-slate-200 p-3"><p className="text-slate-500">Stato fatturazione</p><p className="text-2xl font-bold">Da definire</p></div></div></Card><Card title="Storico economico"><p className="text-sm text-slate-600">Il riepilogo viene calcolato sui conferimenti e sulle offerte accettate.</p></Card></RoleLayout>;
}
