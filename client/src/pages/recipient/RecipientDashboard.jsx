import RoleLayout from '../../components/shared/RoleLayout';
import Card from '../../components/ui/Card';
import { useQuery } from '@tanstack/react-query';
import { fetchIncomingShipments, fetchRecipientNotifications } from '../../services/recipientApi';

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
  const notificationsQuery = useQuery({
    queryKey: ['recipient', 'notifications'],
    queryFn: fetchRecipientNotifications,
  });
  const incomingQuery = useQuery({
    queryKey: ['recipient', 'incoming'],
    queryFn: fetchIncomingShipments,
  });

  const notifications = notificationsQuery.data || [];
  const incoming = incomingQuery.data || [];
  const incomingTon = incoming.reduce((sum, item) => sum + Number(item.quantityTon || 0), 0);
  const hasError = notificationsQuery.isError || incomingQuery.isError;

  return (
    <RoleLayout title="Dashboard Destinatario" links={links}>
      {hasError && (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {notificationsQuery.error?.response?.status === 401 || incomingQuery.error?.response?.status === 401
            ? 'Unauthorized: please login again as recipient.'
            : 'Unable to load recipient metrics.'}
        </p>
      )}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card title="Nuovi ordini compatibili"><p className="text-3xl font-bold">{notifications.length}</p><p className="mt-1 text-sm text-slate-500">Ordini e dossier rifiuto</p></Card>
        <Card title="Conferimenti in arrivo"><p className="text-3xl font-bold">{incoming.length}</p><p className="mt-1 text-sm text-slate-500">{incomingTon.toLocaleString()} ton pianificate</p></Card>
        <Card title="Capacita da confermare"><p className="text-3xl font-bold">{notifications.filter((item) => !item.myOffer).length}</p><p className="mt-1 text-sm text-slate-500">Offerte ancora da inviare</p></Card>
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Nuovi ordini compatibili" action={<a className="text-sm font-semibold text-brand-900" href="/recipient/opportunities">Vedi tutti</a>}>
          {notifications.slice(0, 4).map((item) => <div key={item.id} className="mb-2 flex items-center justify-between rounded-xl border border-slate-200 px-3 py-2 text-sm"><span>CER {item.cerCode} · {item.quantityTon} ton</span><span className="text-slate-500">{item.deadline ? new Date(item.deadline).toLocaleDateString('it-IT') : '-'}</span></div>)}
          {notifications.length === 0 && <p className="text-sm text-slate-600">Nessun ordine compatibile.</p>}
        </Card>
        <Card title="Calendario conferimenti" action={<a className="text-sm font-semibold text-brand-900" href="/recipient/calendar">Apri calendario</a>}>
          {incoming.slice(0, 4).map((item) => <div key={item.id} className="mb-2 flex items-center justify-between rounded-xl border border-slate-200 px-3 py-2 text-sm"><span>{item.destinationAddress || 'Impianto'}</span><strong>{item.deadline ? new Date(item.deadline).toLocaleDateString('it-IT') : '-'}</strong></div>)}
          {incoming.length === 0 && <p className="text-sm text-slate-600">Nessun conferimento pianificato.</p>}
        </Card>
        <Card title="Conferimenti da chiudere">
          {incoming.filter((item) => ['delivered', 'in_execution'].includes(item.status)).length === 0 ? <p className="text-sm text-slate-600">Nessun conferimento da chiudere.</p> : <p className="text-sm text-slate-600">Controlla quantita ricevute ed esito nella pagina Arrivi.</p>}
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
