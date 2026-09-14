import { Link } from 'react-router-dom';
import { useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import RoleLayout from '../../components/shared/RoleLayout';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Modal from '../../components/ui/Modal';
import StatusBadge from '../../components/shared/StatusBadge';
import {
  fetchProducerActiveOrders,
  fetchProducerCombinations,
  fetchProducerOrderHistory,
  fetchProducerRecipientOffersBoard,
  selectProducerCombination,
} from '../../services/producerApi';

const links = [
  { to: '/profile', label: 'Profilo' },
  { to: '/producer', label: 'Dashboard' },
  { to: '/producer/new-request', label: 'New Request' },
  { to: '/producer/recurring-orders', label: 'Ordini ricorrenti' },
];

const queueFilters = [
  { key: 'all', label: 'Tutte' },
  { key: 'draft', label: 'Draft' },
  { key: 'recipient_action', label: 'Da scegliere destinatario' },
  { key: 'recipient_waiting', label: 'Attesa conferma destinatario' },
  { key: 'transport_action', label: 'Da scegliere trasporto' },
  { key: 'transport_waiting', label: 'Attesa conferma trasporto' },
  { key: 'confirmed', label: 'Confermati' },
  { key: 'execution', label: 'Working' },
  { key: 'delivered', label: 'Delivered' },
  { key: 'completed', label: 'Completed' },
  { key: 'hold', label: 'Hold' },
];

function getQueueBucket(status) {
  if (status === 'draft') return 'draft';
  if (['recipient_matching', 'recipient_options_ready'].includes(status)) return 'recipient_action';
  if (status === 'recipient_selected') return 'recipient_waiting';
  if (['transporter_matching', 'package_options_ready'].includes(status)) return 'transport_action';
  if (status === 'package_selected') return 'transport_waiting';
  if (status === 'assigned') return 'confirmed';
  if (status === 'in_execution') return 'execution';
  if (status === 'delivered') return 'delivered';
  if (status === 'completed') return 'completed';
  if (['cancelled', 'expired'].includes(status)) return 'hold';
  return 'all';
}

function getDateKey(value) {
  if (!value) return '';
  const date = new Date(value);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function getCalendarDays(month) {
  const firstDay = new Date(month.getFullYear(), month.getMonth(), 1);
  const mondayOffset = (firstDay.getDay() + 6) % 7;
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  return Array.from({ length: Math.ceil((mondayOffset + daysInMonth) / 7) * 7 }, (_, index) => {
    const day = index - mondayOffset + 1;
    return day > 0 && day <= daysInMonth ? new Date(month.getFullYear(), month.getMonth(), day) : null;
  });
}

export default function ProducerDashboard() {
  const [queueFilter, setQueueFilter] = useState('all');
  const [summaryRequest, setSummaryRequest] = useState(null);
  const [selectedCombination, setSelectedCombination] = useState(null);
  const [calendarMonth, setCalendarMonth] = useState(() => new Date());

  const { data = [], isLoading, isError, error } = useQuery({
    queryKey: ['producer', 'active-orders'],
    queryFn: fetchProducerActiveOrders,
  });

  const orders = data;
  const historyQuery = useQuery({
    queryKey: ['producer', 'order-history'],
    queryFn: fetchProducerOrderHistory,
  });
  const offersBoardQuery = useQuery({
    queryKey: ['producer', 'recipient-offers-board'],
    queryFn: fetchProducerRecipientOffersBoard,
  });
  const combinationsQuery = useQuery({
    queryKey: ['producer', 'combinations'],
    queryFn: fetchProducerCombinations,
  });
  const boardEntries = offersBoardQuery.data || [];
  const combinations = combinationsQuery.data || [];
  const selectCombinationMutation = useMutation({
    mutationFn: selectProducerCombination,
    onSuccess: () => {
      setSelectedCombination(null);
      combinationsQuery.refetch();
      offersBoardQuery.refetch();
    },
  });

  const queueCounts = useMemo(() => {
    return boardEntries.reduce(
      (acc, entry) => {
        const bucket = getQueueBucket(entry.request.status);
        if (acc[bucket] !== undefined) acc[bucket] += 1;
        acc.all += 1;
        return acc;
      },
      {
        all: 0,
        draft: 0,
        recipient_action: 0,
        recipient_waiting: 0,
        transport_action: 0,
        transport_waiting: 0,
        confirmed: 0,
        execution: 0,
        delivered: 0,
        completed: 0,
        hold: 0,
      }
    );
  }, [boardEntries]);

  const allOrders = useMemo(() => {
    const combined = [...(historyQuery.data || []), ...orders];
    return combined.filter((order, index, list) => list.findIndex((item) => item.id === order.id) === index);
  }, [historyQuery.data, orders]);

  const statusCounts = useMemo(() => allOrders.reduce((counts, order) => {
    const bucket = getQueueBucket(order.status);
    counts[bucket] = (counts[bucket] || 0) + 1;
    return counts;
  }, {}), [allOrders]);

  const cerRequests = allOrders.filter((order) => order.cerKnown === false || order.status === 'draft');
  const calendarDays = getCalendarDays(calendarMonth);
  const calendarOrders = useMemo(() => allOrders.reduce((ordersByDate, order) => {
    const key = getDateKey(order.deadline);
    if (key) ordersByDate[key] = [...(ordersByDate[key] || []), order];
    return ordersByDate;
  }, {}), [allOrders]);

  const filteredEntries = useMemo(() => {
    if (queueFilter === 'all') return boardEntries;
    return boardEntries.filter((entry) => getQueueBucket(entry.request.status) === queueFilter);
  }, [boardEntries, queueFilter]);

  return (
    <RoleLayout title="Producer Dashboard" links={links}>
      <div className="w-full">
        <Card title="Coda Richieste" action={<Link to="/producer/new-request" className="text-sm font-semibold text-brand-900">+ New</Link>}>
          <div className="mb-3 flex flex-wrap gap-2">
            {queueFilters.map((filter) => (
              <button
                key={filter.key}
                type="button"
                onClick={() => setQueueFilter(filter.key)}
                className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                  queueFilter === filter.key
                    ? 'bg-brand-900 text-white'
                    : 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-100'
                }`}
              >
                {filter.label} ({queueCounts[filter.key] || 0})
              </button>
            ))}
          </div>

          {offersBoardQuery.isLoading && <p className="text-sm text-slate-600">Loading queue...</p>}
          {offersBoardQuery.isError && (
            <p className="text-sm text-red-600">
              {offersBoardQuery.error?.response?.status === 401 ? 'Unauthorized: please login again as producer.' : 'Unable to load queue.'}
            </p>
          )}

          {!offersBoardQuery.isLoading && !offersBoardQuery.isError && (
            <div className="space-y-2 text-sm">
              {filteredEntries.length === 0 && <p className="text-slate-600">No requests in this queue.</p>}
              {filteredEntries.map((entry) => {
                return (
                  <div
                    key={entry.request.id}
                    className="rounded-xl border border-slate-200 bg-white px-3 py-3 transition hover:border-slate-300 hover:bg-slate-50"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1 text-left">
                        <p className="font-semibold text-slate-800">CER {entry.request.cerCode} | {entry.request.quantityTon} ton</p>
                        <p className="mt-1 text-xs text-slate-600">{entry.request.pickupAddress}</p>
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <StatusBadge status={entry.request.status === 'awarded' ? 'pending' : entry.request.status} />
                          <span className="text-xs text-slate-600">R {entry.offers.length} | T {entry.bids?.length || 0}</span>
                        </div>
                      </div>
                      <Button type="button" variant="secondary" className="shrink-0 px-3 py-1.5 text-xs" onClick={() => setSummaryRequest(entry.request)}>
                        Riepilogo
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

      </div>

      <div className="grid gap-6 lg:grid-cols-2">
      <Card title="Richieste CER da confermare">
        {cerRequests.length === 0 && <p className="text-sm text-slate-600">Nessuna richiesta CER in attesa.</p>}
        <div className="space-y-2 text-sm">
          {cerRequests.slice(0, 5).map((item) => (
            <div key={item.id} className="flex items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2">
              <span>CER da proporre · {item.pickupAddress}</span>
              <Button type="button" variant="secondary" className="px-3 py-1 text-xs" onClick={() => setSummaryRequest(item)}>Vedi</Button>
            </div>
          ))}
        </div>
      </Card>

      <Card title="Calendario ritiri / consegne">
        <div className="mb-3 flex items-center justify-between">
          <Button type="button" variant="secondary" className="px-3 py-1 text-xs" onClick={() => setCalendarMonth((month) => new Date(month.getFullYear(), month.getMonth() - 1, 1))}>Precedente</Button>
          <p className="font-semibold capitalize text-slate-800">{calendarMonth.toLocaleDateString('it-IT', { month: 'long', year: 'numeric' })}</p>
          <Button type="button" variant="secondary" className="px-3 py-1 text-xs" onClick={() => setCalendarMonth((month) => new Date(month.getFullYear(), month.getMonth() + 1, 1))}>Successivo</Button>
        </div>
        <div className="grid grid-cols-7 gap-1 text-center text-xs font-semibold text-slate-500">
          {['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'].map((day) => <span key={day}>{day}</span>)}
        </div>
        <div className="mt-1 grid grid-cols-7 gap-1">
          {calendarDays.map((day, index) => {
            const ordersForDay = day ? calendarOrders[getDateKey(day)] || [] : [];
            return (
              <div key={day ? day.toISOString() : `empty-${index}`} className={`min-h-16 rounded-lg border p-1 text-left ${day ? 'border-slate-200 bg-white' : 'border-transparent bg-slate-50'}`}>
                {day && <>
                  <p className="text-xs font-semibold text-slate-700">{day.getDate()}</p>
                  <div className="mt-1 space-y-1">
                    {ordersForDay.map((order) => <button key={order.id} type="button" className="block w-full truncate rounded bg-brand-900 px-1 py-0.5 text-left text-[10px] text-white" onClick={() => setSummaryRequest(order)}>CER {order.cerCode}</button>)}
                  </div>
                </>}
              </div>
            );
          })}
        </div>
      </Card>

      <Card title="Storico economico e pagamenti">
        <p className="text-sm text-slate-600">Totale ordini: {allOrders.length}</p>
        <p className="text-sm text-slate-600">Budget massimo complessivo: EUR {allOrders.reduce((sum, item) => sum + Number(item.maxPrice || 0), 0).toLocaleString()}</p>
        <Link className="mt-3 inline-flex text-sm font-semibold text-brand-900" to="/producer/recurring-orders">Gestisci ordini ricorrenti</Link>
      </Card>

      <Card title="Tracking e assistenza">
        <p className="text-sm text-slate-600">Working: {statusCounts.execution || 0} · Delivered: {statusCounts.delivered || 0}</p>
        <p className="mt-2 text-sm text-slate-600">Anomalie e contestazioni aperte: 0</p>
        <Link className="mt-3 inline-flex text-sm font-semibold text-brand-900" to="/profile">Documenti e preferenze notifiche</Link>
      </Card>
      </div>

      <Card title="Combinazioni disponibili">
        <p className="mb-3 text-sm text-slate-600">La selezione invia una richiesta di riconferma a trasportatore e destinatario. L'ordine diventa definitivo solo dopo entrambe le conferme.</p>
        {combinationsQuery.isLoading && <p className="text-sm text-slate-600">Generazione combinazioni...</p>}
        {combinationsQuery.isError && <p className="text-sm text-red-600">Impossibile generare le combinazioni.</p>}
        {!combinationsQuery.isLoading && !combinationsQuery.isError && combinations.map((entry) => (
          <div key={entry.request.id} className="mb-4 rounded-xl border border-slate-200 p-4">
            <p className="font-semibold text-slate-800">CER {entry.request.cerCode} · {entry.request.quantityTon} ton</p>
            {entry.combinations.length === 0 && <p className="mt-2 text-sm text-amber-700">Nessuna combinazione completa disponibile.</p>}
            <div className="mt-3 grid gap-3 lg:grid-cols-2">
              {entry.combinations.slice(0, 6).map((combination) => (
                <div key={combination.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm">
                  <div className="flex flex-wrap gap-2">{combination.bestPrice && <span className="rounded-full bg-emerald-100 px-2 py-1 text-xs font-semibold text-emerald-700">Best Price</span>}{combination.bestOperationalFit && <span className="rounded-full bg-blue-100 px-2 py-1 text-xs font-semibold text-blue-700">Best Operational Fit</span>}</div>
                  <p className="mt-2 font-semibold">Prezzo finale: EUR {combination.finalPrice.toLocaleString()}</p>
                  <p className="text-slate-600">Trasporto: EUR {combination.transportCost.toLocaleString()} · Trattamento: EUR {combination.treatmentCost.toLocaleString()} · Fee: EUR {combination.platformFee.toLocaleString()}</p>
                  <p className="text-slate-600">Fit operativo: {Math.round(combination.operationalFit * 100)}%</p>
                  {combination.warnings.length > 0 && <p className="mt-2 text-amber-700">Warning: {combination.warnings.join('; ')}</p>}
                  <Button type="button" className="mt-3" onClick={() => setSelectedCombination({ orderId: entry.request.id, ...combination })}>Seleziona combinazione</Button>
                </div>
              ))}
            </div>
          </div>
        ))}
      </Card>

      <Modal open={Boolean(selectedCombination)} title="Conferma selezione produttore" onClose={() => setSelectedCombination(null)}>
        {selectedCombination && <div className="space-y-3 text-sm text-slate-700"><p>Stai selezionando una combinazione con prezzo finale di <strong>EUR {selectedCombination.finalPrice.toLocaleString()}</strong>.</p><p>Il trasportatore e il destinatario dovranno riconfermare prezzo, condizioni e disponibilita. La selezione non e ancora un'assegnazione definitiva.</p><div className="flex justify-end gap-2"><Button type="button" variant="secondary" onClick={() => setSelectedCombination(null)}>Annulla</Button><Button type="button" disabled={selectCombinationMutation.isPending} onClick={() => selectCombinationMutation.mutate({ orderId: selectedCombination.orderId, bidId: selectedCombination.bidId, recipientOfferId: selectedCombination.recipientOfferId, finalPrice: selectedCombination.finalPrice, platformFee: selectedCombination.platformFee })}>{selectCombinationMutation.isPending ? 'Invio...' : 'Invia riconferma'}</Button></div></div>}
      </Modal>

      <Modal open={Boolean(summaryRequest)} title="Riepilogo ordine" onClose={() => setSummaryRequest(null)}>
        {summaryRequest && (
          <div className="space-y-2 text-sm text-slate-700">
            <p><strong>ID ordine:</strong> {summaryRequest.id}</p>
            <p><strong>Stato:</strong> {summaryRequest.status}</p>
            <p><strong>CER / EER:</strong> {summaryRequest.cerCode || 'Da definire'}</p>
            <p><strong>Descrizione:</strong> {summaryRequest.wasteDescription || '-'}</p>
            {summaryRequest.photoData ? <img className="max-h-56 w-full rounded-xl object-contain" src={summaryRequest.photoData} alt={`Foto ordine ${summaryRequest.id}`} /> : <p className="text-xs text-slate-500">Nessuna foto salvata per questo ordine.</p>}
            {summaryRequest.photoFileName && <p><strong>Foto:</strong> {summaryRequest.photoFileName}</p>}
            <p><strong>Sede / ritiro:</strong> {summaryRequest.pickupAddress || '-'}</p>
            <p><strong>Quantita:</strong> {summaryRequest.quantityTon || '-'} ton</p>
            <p><strong>Contenimento:</strong> {summaryRequest.containment || '-'}</p>
            <p><strong>Informazioni speciali:</strong> {summaryRequest.specialInfo || '-'}</p>
            <p><strong>Scadenza:</strong> {summaryRequest.deadline || '-'}</p>
            <p><strong>Ricorrente:</strong> {summaryRequest.recurring ? 'Si' : 'No'}</p>
            <div className="pt-3 text-right"><Button type="button" variant="secondary" onClick={() => setSummaryRequest(null)}>Chiudi</Button></div>
          </div>
        )}
      </Modal>
    </RoleLayout>
  );
}
