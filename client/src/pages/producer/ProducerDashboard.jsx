import { Link } from 'react-router-dom';
import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import RoleLayout from '../../components/shared/RoleLayout';
import Card from '../../components/ui/Card';
import StatusBadge from '../../components/shared/StatusBadge';
import { producerLinks } from '../../components/shared/navLinks';
import { fetchProducerPickups } from '../../services/producerApi';
import { errorMessage, formatDateTime } from '../../services/labels';

const FILTERS = [
  { key: 'all', label: 'Tutte', match: () => true },
  { key: 'action', label: 'Richiedono un\'azione', match: (r) => ['packages_ready', 'in_agreement', 'draft'].includes(r.status) },
  { key: 'waiting', label: 'In attesa di risposte', match: (r) => ['awaiting_recipients', 'awaiting_transporters'].includes(r.status) },
  { key: 'confirmed', label: 'Confermate', match: (r) => r.status === 'confirmed' },
];

function nextStep(request) {
  switch (request.status) {
    case 'draft':
      return 'Pubblica la richiesta';
    case 'awaiting_recipients':
      return `Destinatari: ${request.counts.recipientsAvailable} disponibili, ${request.counts.recipientsPending} in attesa`;
    case 'awaiting_transporters':
      return `Proposte ricevute: ${request.counts.proposalsSubmitted}/${request.counts.transportersInvited}`;
    case 'packages_ready':
      return `${request.counts.packagesAvailable} pacchetti: scegli il migliore`;
    case 'in_agreement':
      return 'Concorda giorno e orario';
    case 'confirmed':
      return `Ritiro il ${formatDateTime(request.confirmedSlotAt)}`;
    default:
      return '';
  }
}

export default function ProducerDashboard() {
  const [filter, setFilter] = useState('all');
  const { data = [], isLoading, isError, error } = useQuery({
    queryKey: ['producer', 'pickups'],
    queryFn: fetchProducerPickups,
  });

  const metrics = useMemo(
    () => ({
      open: data.filter((r) => !['confirmed', 'cancelled'].includes(r.status)).length,
      actions: data.filter((r) => ['packages_ready', 'in_agreement'].includes(r.status)).length,
      confirmed: data.filter((r) => r.status === 'confirmed').length,
    }),
    [data]
  );

  const active = FILTERS.find((item) => item.key === filter);
  const visible = data.filter(active.match);

  return (
    <RoleLayout title="Dashboard produttore" links={producerLinks}>
      <div className="grid gap-4 sm:grid-cols-3">
        <Card title="Richieste aperte"><p className="text-3xl font-bold">{metrics.open}</p></Card>
        <Card title="Azioni da fare"><p className="text-3xl font-bold">{metrics.actions}</p></Card>
        <Card title="Ritiri confermati"><p className="text-3xl font-bold">{metrics.confirmed}</p></Card>
      </div>

      <Card title="Le mie richieste" action={<Link to="/producer/new-request" className="text-sm font-semibold text-brand-900">+ Nuova</Link>}>
        <div className="mb-3 flex flex-wrap gap-2">
          {FILTERS.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setFilter(item.key)}
              className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                filter === item.key ? 'bg-brand-900 text-white' : 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-100'
              }`}
            >
              {item.label} ({data.filter(item.match).length})
            </button>
          ))}
        </div>

        {isLoading && <p className="text-sm text-slate-600">Caricamento...</p>}
        {isError && <p className="text-sm text-red-600">{errorMessage(error, 'Impossibile caricare le richieste.')}</p>}
        {!isLoading && !isError && (
          <div className="space-y-2 text-sm">
            {visible.length === 0 && <p className="text-slate-600">Nessuna richiesta.</p>}
            {visible.map((request) => (
              <Link
                key={request.id}
                to={`/producer/pickups/${request.id}`}
                className="block rounded-xl border border-slate-200 px-3 py-3 hover:bg-slate-50"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-semibold text-slate-800">CER {request.cerCode} | {request.quantityTon} ton</span>
                  <StatusBadge status={request.status} />
                </div>
                <p className="text-slate-600">{request.pickupAddress}</p>
                <p className="text-xs text-slate-500">{nextStep(request)}</p>
              </Link>
            ))}
          </div>
        )}
      </Card>
    </RoleLayout>
  );
}
