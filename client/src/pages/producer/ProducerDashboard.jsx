import { Link } from 'react-router-dom';
import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import RoleLayout from '../../components/shared/RoleLayout';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import StatusBadge from '../../components/shared/StatusBadge';
import {
  fetchProducerActiveOrders,
  fetchProducerRecipientOffersBoard,
  selectProducerRecipientOffer,
  selectProducerTransportBid,
} from '../../services/producerApi';

const links = [
  { to: '/producer', label: 'Dashboard' },
  { to: '/producer/new-request', label: 'New Request' },
  { to: '/producer/auction/123', label: 'Auction Room' },
  { to: '/producer/orders', label: 'Orders & Docs' },
];

const queueFilters = [
  { key: 'all', label: 'Tutte' },
  { key: 'recipient_action', label: 'Da scegliere destinatario' },
  { key: 'recipient_waiting', label: 'Attesa conferma destinatario' },
  { key: 'transport_action', label: 'Da scegliere trasporto' },
  { key: 'transport_waiting', label: 'Attesa conferma trasporto' },
  { key: 'execution', label: 'In esecuzione' },
];

function getQueueBucket(status) {
  if (['recipient_matching', 'recipient_options_ready'].includes(status)) return 'recipient_action';
  if (status === 'recipient_selected') return 'recipient_waiting';
  if (['transporter_matching', 'package_options_ready'].includes(status)) return 'transport_action';
  if (status === 'package_selected') return 'transport_waiting';
  if (['assigned', 'in_execution', 'delivered'].includes(status)) return 'execution';
  return 'all';
}

export default function ProducerDashboard() {
  const queryClient = useQueryClient();
  const [queueFilter, setQueueFilter] = useState('all');
  const [selectedRequestId, setSelectedRequestId] = useState(null);

  const { data = [], isLoading, isError, error } = useQuery({
    queryKey: ['producer', 'active-orders'],
    queryFn: fetchProducerActiveOrders,
  });

  const orders = data;
  const offersBoardQuery = useQuery({
    queryKey: ['producer', 'recipient-offers-board'],
    queryFn: fetchProducerRecipientOffersBoard,
  });
  const selectRecipientMutation = useMutation({
    mutationFn: selectProducerRecipientOffer,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['producer', 'active-orders'] });
      queryClient.invalidateQueries({ queryKey: ['producer', 'recipient-offers-board'] });
    },
  });
  const selectTransportMutation = useMutation({
    mutationFn: selectProducerTransportBid,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['producer', 'active-orders'] });
      queryClient.invalidateQueries({ queryKey: ['producer', 'recipient-offers-board'] });
    },
  });

  const handleRecipientSelection = (wasteRequestId, recipientOfferId, isReplacement) => {
    const confirmText = isReplacement
      ? 'Confermi di modificare il destinatario selezionato?'
      : 'Confermi di accettare questa offerta?';

    if (!window.confirm(confirmText)) {
      return;
    }

    selectRecipientMutation.mutate(
      { wasteRequestId, recipientOfferId, allowReplace: isReplacement },
      {
        onSuccess: () => {
          window.alert(isReplacement ? 'Selezione aggiornata con successo.' : 'Offerta accettata con successo.');
        },
        onError: (err) => {
          window.alert(err?.response?.data?.message || 'Operazione non riuscita.');
        },
      }
    );
  };

  const handleTransportSelection = (wasteRequestId, bidId, isReplacement) => {
    const confirmText = isReplacement
      ? 'Confermi di modificare il trasportatore selezionato?'
      : 'Confermi di accettare questa offerta di trasporto?';

    if (!window.confirm(confirmText)) {
      return;
    }

    selectTransportMutation.mutate(
      { wasteRequestId, bidId, allowReplace: isReplacement },
      {
        onSuccess: () => {
          window.alert(isReplacement ? 'Selezione trasporto aggiornata con successo.' : 'Offerta trasporto accettata con successo.');
        },
        onError: (err) => {
          window.alert(err?.response?.data?.message || 'Operazione non riuscita.');
        },
      }
    );
  };

  const boardEntries = offersBoardQuery.data || [];

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
        recipient_action: 0,
        recipient_waiting: 0,
        transport_action: 0,
        transport_waiting: 0,
        execution: 0,
      }
    );
  }, [boardEntries]);

  const filteredEntries = useMemo(() => {
    if (queueFilter === 'all') return boardEntries;
    return boardEntries.filter((entry) => getQueueBucket(entry.request.status) === queueFilter);
  }, [boardEntries, queueFilter]);

  useEffect(() => {
    if (filteredEntries.length === 0) {
      setSelectedRequestId(null);
      return;
    }

    if (!selectedRequestId || !filteredEntries.some((entry) => entry.request.id === selectedRequestId)) {
      setSelectedRequestId(filteredEntries[0].request.id);
    }
  }, [filteredEntries, selectedRequestId]);

  const selectedEntry = useMemo(
    () => filteredEntries.find((entry) => entry.request.id === selectedRequestId) || null,
    [filteredEntries, selectedRequestId]
  );

  const metrics = useMemo(() => {
    const total = orders.length;
    const avgCost = total > 0 ? Math.round(orders.reduce((sum, item) => sum + Number(item.maxPrice || 0), 0) / total) : 0;
    const compliance = total > 0 ? Math.round((orders.filter((item) => item.status !== 'expired').length / total) * 100) : 100;
    const actionable = boardEntries.filter((entry) => ['recipient_action', 'transport_action'].includes(getQueueBucket(entry.request.status))).length;
    return { total, avgCost, compliance, actionable };
  }, [orders, boardEntries]);

  return (
    <RoleLayout title="Producer Dashboard" links={links}>
      <div className="grid gap-4 sm:grid-cols-4">
        <Card title="Active Orders"><p className="text-3xl font-bold">{metrics.total}</p></Card>
        <Card title="Avg Disposal Cost"><p className="text-3xl font-bold">EUR {metrics.avgCost.toLocaleString()}</p></Card>
        <Card title="Compliance Rate"><p className="text-3xl font-bold">{metrics.compliance}%</p></Card>
        <Card title="Azioni Aperte"><p className="text-3xl font-bold">{metrics.actionable}</p></Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-[320px,1fr]">
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
                const active = selectedEntry?.request.id === entry.request.id;
                return (
                  <button
                    key={entry.request.id}
                    type="button"
                    onClick={() => setSelectedRequestId(entry.request.id)}
                    className={`w-full rounded-xl border px-3 py-3 text-left transition ${
                      active
                        ? 'border-brand-800 bg-brand-50'
                        : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    <p className="font-semibold text-slate-800">CER {entry.request.cerCode} | {entry.request.quantityTon} ton</p>
                    <p className="mt-1 text-xs text-slate-600">{entry.request.pickupAddress}</p>
                    <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                      <StatusBadge status={entry.request.status === 'awarded' ? 'pending' : entry.request.status} />
                      <span className="text-xs text-slate-600">R {entry.offers.length} | T {entry.bids?.length || 0}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </Card>

        <Card title="Dettaglio Richiesta">
          {!selectedEntry && !offersBoardQuery.isLoading && <p className="text-sm text-slate-600">Seleziona una richiesta dalla coda.</p>}

          {selectedEntry && (
            <div className="space-y-4 text-sm">
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="font-semibold text-slate-800">
                  Request {selectedEntry.request.id.slice(0, 8)} | CER {selectedEntry.request.cerCode} | {selectedEntry.request.quantityTon} ton
                </p>
                <p className="mt-1 text-slate-600">Pickup: {selectedEntry.request.pickupAddress}</p>
                <div className="mt-2"><StatusBadge status={selectedEntry.request.status === 'awarded' ? 'pending' : selectedEntry.request.status} /></div>
              </div>

              <div className="space-y-2 rounded-xl border border-slate-200 px-3 py-3">
                <p className="font-semibold text-slate-800">Offerte destinatario</p>
                {selectedEntry.offers.length === 0 && <p className="text-slate-600">Nessuna offerta destinatario.</p>}
                {selectedEntry.offers.map((offer) => (
                  <div key={offer.id} className="rounded-lg border border-slate-200 px-3 py-2">
                    <p className="font-semibold text-slate-800">
                      {offer.recipient?.companyName || 'Recipient'} - EUR {Number(offer.pricePerTon || 0).toLocaleString()}/ton
                    </p>
                    <p className="text-slate-600">Destination: {offer.destinationAddress}</p>
                    <p className="text-slate-600">Capacity: {offer.availableCapacityTon || '-'} ton</p>
                    {selectedEntry.request.selectedRecipientOfferId === offer.id ? (
                      <p className="mt-2 font-semibold text-emerald-700">Offerta accettata</p>
                    ) : (
                      <Button
                        className="mt-2"
                        type="button"
                        onClick={() => handleRecipientSelection(selectedEntry.request.id, offer.id, Boolean(selectedEntry.request.selectedRecipientOfferId))}
                        disabled={selectRecipientMutation.isPending}
                      >
                        {selectRecipientMutation.isPending
                          ? 'Accettazione...'
                          : selectedEntry.request.selectedRecipientOfferId
                            ? 'Modifica selezione'
                            : 'Accetta offerta'}
                      </Button>
                    )}
                  </div>
                ))}
              </div>

              <div className="space-y-2 rounded-xl border border-slate-200 px-3 py-3">
                <p className="font-semibold text-slate-800">Offerte trasporto</p>
                {selectedEntry.bids?.length ? (
                  <div className="space-y-2">
                    {selectedEntry.bids.map((bid) => (
                      <div key={bid.id} className="rounded-md border border-slate-200 bg-white px-3 py-2">
                        <p className="font-semibold text-slate-800">
                          {bid.transporter?.companyName || 'Transporter'} - EUR {Number(bid.transportPrice || 0).toLocaleString()}
                        </p>
                        <p className="text-slate-600">Vehicle: {bid.vehicleType || '-'}</p>
                        <p className="text-slate-600">Total package: EUR {Number(bid.totalPrice || 0).toLocaleString()}</p>
                        {selectedEntry.request.selectedBidId === bid.id ? (
                          <p className="mt-2 font-semibold text-emerald-700">Offerta trasporto accettata</p>
                        ) : (
                          <Button
                            className="mt-2"
                            type="button"
                            onClick={() => handleTransportSelection(selectedEntry.request.id, bid.id, Boolean(selectedEntry.request.selectedBidId))}
                            disabled={selectTransportMutation.isPending}
                          >
                            {selectTransportMutation.isPending
                              ? 'Accettazione...'
                              : selectedEntry.request.selectedBidId
                                ? 'Modifica selezione trasporto'
                                : 'Accetta offerta trasporto'}
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-slate-600">Nessuna offerta trasporto.</p>
                )}
              </div>
            </div>
          )}
        </Card>
      </div>

      <Card title="Live Requests (overview)">
        {isLoading && <p className="text-sm text-slate-600">Loading requests...</p>}
        {isError && (
          <p className="text-sm text-red-600">
            {error?.response?.status === 401 ? 'Unauthorized: please login again as producer.' : 'Unable to load requests.'}
          </p>
        )}
        {!isLoading && !isError && (
          <div className="space-y-3 text-sm">
            {orders.length === 0 && <p className="text-slate-600">No active requests yet.</p>}
            {orders.slice(0, 6).map((item) => (
              <div key={item.id} className="flex items-center justify-between rounded-xl border border-slate-200 px-3 py-2">
                <span>
                  CER {item.cerCode} - {item.quantityTon} ton - {item.pickupAddress}
                </span>
                <StatusBadge status={item.status === 'awarded' ? 'pending' : item.status} />
              </div>
            ))}
          </div>
        )}
      </Card>
    </RoleLayout>
  );
}
