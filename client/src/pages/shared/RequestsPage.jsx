import { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import RoleLayout from '../../components/shared/RoleLayout';
import StatusBadge from '../../components/shared/StatusBadge';
import Card from '../../components/ui/Card';
import { producerLinks, recipientLinks, transporterLinks } from '../../components/shared/navLinks';
import { fetchProducerPickups } from '../../services/producerApi';
import { fetchRecipientPickups } from '../../services/recipientApi';
import { fetchTransporterPickups } from '../../services/transporterApi';
import { errorMessage, formatDateTime, REQUEST_STATUS_LABELS, STAGE_LABELS } from '../../services/labels';
import { producerNextStep } from '../../services/pickupGuidance';

const configs = {
  producer: {
    title: 'Richieste',
    links: producerLinks,
    fetch: fetchProducerPickups,
    detailsPath: (id) => `/producer/pickups/${id}`,
    statusOptions: Object.entries(REQUEST_STATUS_LABELS),
    statusField: 'status',
  },
  recipient: {
    title: 'Richieste',
    links: recipientLinks,
    fetch: fetchRecipientPickups,
    detailsPath: (id) => `/recipient/pickups/${id}`,
    statusOptions: Object.entries(STAGE_LABELS),
    statusField: 'stage',
  },
  transporter: {
    title: 'Richieste',
    links: transporterLinks,
    fetch: fetchTransporterPickups,
    detailsPath: (id) => `/transporter/pickups/${id}`,
    statusOptions: Object.entries(STAGE_LABELS),
    statusField: 'stage',
  },
};

function eventDate(item) {
  return item.scheduledAt || item.confirmedSlotAt || item.deadline;
}

function dateKey(value) {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10);
}

function matchesStatus(item, filter, role) {
  if (filter === 'all') return true;
  if (role === 'producer') {
    if (filter === 'action') return item.actionRequired;
    return item.status === filter;
  }

  if (filter === 'action') return item.stage === 'to_respond';
  if (filter === 'agreement') return ['in_agreement', 'confirmed'].includes(item.stage);
  if (filter === 'closed') return ['closed', 'cancelled'].includes(item.stage);
  if (filter === 'waiting') return ['responded', 'waiting'].includes(item.stage);
  return item.stage === filter;
}

function SummaryCards({ items, role }) {
  const count = (predicate) => items.filter(predicate).length;
  const cards = role === 'producer'
    ? [
        ['Tutte le richieste', items.length],
        ['Richiedono un’azione', count((item) => item.actionRequired)],
        ['Ritiri confermati', count((item) => item.status === 'confirmed')],
      ]
    : [
        ['Richieste ricevute', items.length],
        ['Da rispondere', count((item) => item.stage === 'to_respond')],
        ['In accordo o confermate', count((item) => ['in_agreement', 'confirmed'].includes(item.stage))],
      ];

  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {cards.map(([label, value]) => (
        <Card key={label}>
          <p className="text-sm text-slate-500">{label}</p>
          <p className="mt-1 text-3xl font-bold text-brand-900">{value}</p>
        </Card>
      ))}
    </div>
  );
}

export default function RequestsPage({ role }) {
  const config = configs[role];
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialStatus = searchParams.get('status') || 'all';
  const [status, setStatus] = useState(initialStatus);
  const [cer, setCer] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const { data = [], isLoading, isError, error } = useQuery({
    queryKey: [role, 'pickups'],
    queryFn: config.fetch,
  });

  const visibleItems = useMemo(() => data
    .filter((item) => matchesStatus(item, status, role))
    .filter((item) => !cer.trim() || String(item.cerCode || '').toLocaleLowerCase('it-IT').includes(cer.trim().toLocaleLowerCase('it-IT')))
    .filter((item) => {
      const date = dateKey(eventDate(item));
      return (!dateFrom || (date && date >= dateFrom)) && (!dateTo || (date && date <= dateTo));
    })
    .sort((a, b) => new Date(b.created_at || b.createdAt || 0) - new Date(a.created_at || a.createdAt || 0)), [cer, data, dateFrom, dateTo, role, status]);

  return (
    <RoleLayout title={config.title} links={config.links}>
      {!isLoading && !isError && <SummaryCards items={data} role={role} />}
      <Card title="Elenco richieste">
        <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
            Stato
            <select value={status} onChange={(event) => setStatus(event.target.value)} className="rounded-xl border border-slate-300 bg-white px-3 py-2">
              <option value="all">Tutti gli stati</option>
              {role === 'producer' && <option value="action">Richiedono un’azione</option>}
              {role !== 'producer' && (
                <>
                  <option value="action">Da rispondere</option>
                  <option value="waiting">Risposta inviata / in attesa</option>
                  <option value="agreement">In accordo / confermate</option>
                  <option value="closed">Concluse / annullate</option>
                </>
              )}
              {config.statusOptions.map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
            Codice CER
            <input value={cer} onChange={(event) => setCer(event.target.value)} placeholder="Es. 16 03 04" className="rounded-xl border border-slate-300 px-3 py-2" />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
            Data da
            <input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} className="rounded-xl border border-slate-300 px-3 py-2" />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
            Data a
            <input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} className="rounded-xl border border-slate-300 px-3 py-2" />
          </label>
        </div>
        <p className="mb-3 text-xs text-slate-500">Il filtro data usa la data del ritiro confermato, se disponibile, altrimenti la scadenza indicata nella richiesta.</p>
        {isLoading && <p role="status" className="text-sm text-slate-600">Caricamento richieste...</p>}
        {isError && <p role="alert" className="text-sm text-red-700">{errorMessage(error, 'Impossibile caricare le richieste.')}</p>}
        {!isLoading && !isError && visibleItems.length === 0 && (
          <p className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-600">Nessuna richiesta corrisponde ai filtri selezionati.</p>
        )}
        {!isLoading && !isError && visibleItems.length > 0 && (
          <div className="-mx-2 overflow-x-auto px-2">
            <table className="w-full min-w-[760px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-3 py-3">Richiesta</th>
                  <th className="px-3 py-3">Data</th>
                  <th className="px-3 py-3">Indirizzo di ritiro</th>
                  <th className="px-3 py-3">Stato</th>
                  <th className="px-3 py-3">Prossimo passo</th>
                </tr>
              </thead>
              <tbody>
                {visibleItems.map((item) => {
                  const itemStatus = item[config.statusField];
                  const nextStep = role === 'producer'
                    ? producerNextStep(item)
                    : item.stage === 'to_respond'
                      ? role === 'recipient' ? 'Indica la disponibilità o non partecipare.' : 'Invia una proposta o indica che non partecipi.'
                      : item.stage === 'in_agreement'
                        ? 'Gestisci il giorno e l’orario concordati.'
                        : item.stage === 'confirmed'
                          ? 'Ritiro confermato: consulta l’agenda.'
                          : item.stage === 'cancelled'
                            ? 'Richiesta annullata.'
                            : item.stage === 'closed'
                              ? 'Partecipazione conclusa.'
                              : 'In attesa dell’esito della richiesta.';
                  const detailPath = config.detailsPath(item.id);
                  return (
                    <tr
                      key={item.id}
                      tabIndex={0}
                      onClick={() => navigate(detailPath)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          navigate(detailPath);
                        }
                      }}
                      className="cursor-pointer border-b border-slate-100 transition hover:bg-slate-50 focus:bg-slate-50 focus:outline-none"
                    >
                      <td className="px-3 py-3">
                        <Link to={detailPath} onClick={(event) => event.stopPropagation()} className="font-semibold text-brand-900 hover:underline">
                          CER {item.cerCode === 'UNKNOWN' ? 'da proporre' : item.cerCode}
                        </Link>
                        <p className="mt-1 text-xs text-slate-500">{item.quantityTon} ton · {item.wasteDescription || 'Descrizione non indicata'}</p>
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 text-slate-600">{formatDateTime(eventDate(item))}</td>
                      <td className="max-w-56 px-3 py-3 text-slate-600">{item.pickupAddress}</td>
                      <td className="px-3 py-3"><StatusBadge status={itemStatus} kind={role === 'producer' ? 'request' : 'stage'} /></td>
                      <td className="max-w-64 px-3 py-3 text-slate-600">{nextStep}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {!isLoading && !isError && <p className="mt-3 text-xs text-slate-500">{visibleItems.length} richieste</p>}
      </Card>
    </RoleLayout>
  );
}
