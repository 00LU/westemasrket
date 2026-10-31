import RoleLayout from '../../components/shared/RoleLayout';
import { BellRing, CalendarClock, Truck } from 'lucide-react';
import Card from '../../components/ui/Card';
import StatCard from '../../components/ui/StatCard';
import StatusAlert from '../../components/ui/StatusAlert';
import { useQuery } from '@tanstack/react-query';
import { fetchRecipientPickups } from '../../services/recipientApi';
import { errorMessage, formatQuantity } from '../../services/labels';

const links = [
  { to: '/recipient', label: 'Dashboard' },
  { to: '/recipient/opportunities', label: 'Ordini compatibili' },
  { to: '/recipient/calendar', label: 'Calendario conferimenti' },
  { to: '/recipient/incoming', label: 'Arrivi e conferimenti' },
  { to: '/recipient/capacity', label: 'Disponibilita e capacita' },
  { to: '/recipient/facilities', label: 'Impianti e autorizzazioni' },
  { to: '/recipient/earnings', label: 'Corrispettivi' },
  { to: '/profile', label: 'Profilo' },
];

export default function RecipientDashboard() {
  const pickupsQuery = useQuery({
    queryKey: ['recipient', 'pickups'],
    queryFn: fetchRecipientPickups,
  });

  const pickups = pickupsQuery.data || [];
  const notifications = pickups.filter((item) => item.stage === 'to_respond');
  const incoming = pickups
    .filter((item) => ['in_agreement', 'confirmed'].includes(item.stage))
    .map((item) => ({ ...item, deadline: item.scheduledAt || item.deadline, destinationAddress: item.myResponse.destinationAddress }));
  const incomingQuantities = incoming.reduce((totals, item) => ({
    ...totals,
    [item.quantityUnit]: (totals[item.quantityUnit] || 0) + Number(item.quantity || 0),
  }), {});
  const incomingSummary = Object.entries(incomingQuantities)
    .map(([unit, quantity]) => formatQuantity(quantity, unit))
    .join(' · ');
  const hasError = pickupsQuery.isError;
  const ready = !pickupsQuery.isLoading && !hasError;

  return (
    <RoleLayout title="Dashboard Destinatario" links={links}>
      {pickupsQuery.isLoading && <p role="status">Caricamento richieste...</p>}
      {hasError && (
        <StatusAlert variant="error">
          {errorMessage(pickupsQuery.error, 'Impossibile caricare i dati del destinatario.')}
        </StatusAlert>
      )}
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard tone="dark" icon={BellRing} label="Nuove richieste" value={ready ? notifications.length : '—'} hint="Richieste a cui rispondere" />
        <StatCard tone="accent" icon={Truck} label="Ritiri in accordo o confermati" value={ready ? incoming.length : '—'} hint={ready ? incomingSummary || 'Nessuna quantità' : 'Caricamento dati'} />
        <StatCard icon={CalendarClock} label="Disponibilità da inviare" value={ready ? notifications.length : '—'} hint="Disponibilità ancora da inviare" />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Nuovi ordini compatibili" action={<a className="text-sm font-semibold text-brand-900" href="/recipient/opportunities">Vedi tutti</a>}>
          {notifications.slice(0, 4).map((item) => <div key={item.id} className="mb-2 flex items-center justify-between rounded-xl border border-slate-200 px-3 py-2 text-sm"><span>{item.requestCode || '—'} · CER {item.cerCode} · {formatQuantity(item.quantity, item.quantityUnit)}</span><span className="text-slate-500">{item.deadline ? new Date(item.deadline).toLocaleDateString('it-IT') : '-'}</span></div>)}
          {ready && notifications.length === 0 && <p className="text-sm text-slate-600">Nessuna nuova richiesta.</p>}
        </Card>
        <Card title="Calendario conferimenti" action={<a className="text-sm font-semibold text-brand-900" href="/recipient/calendar">Apri calendario</a>}>
          {incoming.slice(0, 4).map((item) => <div key={item.id} className="mb-2 flex items-center justify-between rounded-xl border border-slate-200 px-3 py-2 text-sm"><span>{item.destinationAddress || 'Impianto'}</span><strong>{item.stage === 'confirmed' && item.scheduledAt ? new Date(item.scheduledAt).toLocaleDateString('it-IT') : 'Data da concordare'}</strong></div>)}
          {ready && incoming.length === 0 && <p className="text-sm text-slate-600">Nessun conferimento pianificato.</p>}
        </Card>
        <Card title="Date da concordare">
          {ready && (incoming.filter((item) => item.stage === 'in_agreement').length === 0 ? <p className="text-sm text-slate-600">Nessuna data in attesa di accordo.</p> : <p className="text-sm text-slate-600">Accetta o proponi un'alternativa nella pagina Arrivi.</p>)}
          <a className="mt-3 inline-flex text-sm font-semibold text-brand-900" href="/recipient/incoming">Gestisci conferimenti</a>
        </Card>
        <Card title="Impianti, autorizzazioni e scadenze">
          <p className="text-sm text-slate-600">Gestisci impianti, CER/EER ammessi, operazioni R/D e documenti.</p>
          <a className="mt-3 inline-flex text-sm font-semibold text-brand-900" href="/recipient/facilities">Apri gestione impianti</a>
        </Card>
      </div>
    </RoleLayout>
  );
}
