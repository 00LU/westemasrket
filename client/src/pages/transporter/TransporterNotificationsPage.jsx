import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import RoleLayout from '../../components/shared/RoleLayout';
import Card from '../../components/ui/Card';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';
import StatusAlert from '../../components/ui/StatusAlert';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import StatusBadge from '../../components/shared/StatusBadge';
import PickupSummary from '../../components/shared/PickupSummary';
import { transporterLinks } from '../../components/shared/navLinks';
import { fetchTransporterPickups, submitTransportProposal } from '../../services/transporterApi';
import { RESPONSE_LABELS, errorMessage, formatEuro } from '../../services/labels';
import PickupFilters from '../../components/shared/PickupFilters';
import { filterPickups } from '../../services/pickupGuidance';
import { cancelOffer } from '../../services/pickupApi';

export function ProposalForm({ item, onDone }) {
  const mine = item.myProposal;
  const [offers, setOffers] = useState(() => {
    const existing = new Map((mine.offers || []).map((offer) => [offer.recipientAvailabilityId, offer]));
    return (item.destinations || []).map((destination) => {
      const offer = existing.get(destination.id);
      return {
        recipientAvailabilityId: destination.id,
        pricingMode: offer?.pricingMode ?? 'fixed_trip',
        unitPrice: offer?.unitPrice ?? '',
      };
    });
  });
  const [form, setForm] = useState({
    vehicleType: mine.vehicleType ?? 'ADR Truck',
    availabilityNote: mine.availabilityNote ?? '',
  });
  const [message, setMessage] = useState('');
  const [confirmCancel, setConfirmCancel] = useState(false);
  const setFormField = (field) => (event) => setForm((curr) => ({ ...curr, [field]: event.target.value }));
  const setOffer = (id, field) => (event) => {
    const value = event.target.value;
    setOffers((current) => current.map((offer) => offer.recipientAvailabilityId === id
      ? { ...offer, [field]: value }
      : offer));
  };

  const mutation = useMutation({
    mutationFn: submitTransportProposal,
    onMutate: () => setMessage(''),
    onSuccess: (_, variables) => {
      onDone(variables.decline
        ? { variant: 'success', title: 'Mancata partecipazione registrata', body: 'Non riceverai altre richieste di risposta per questa asta.' }
        : { variant: 'success', title: mine.status === 'submitted' ? 'Proposta aggiornata' : 'Proposta inviata', body: 'Il produttore potrà confrontare la tua proposta con quelle disponibili e scegliere un pacchetto.' });
    },
    onError: (error) => setMessage({ variant: 'error', title: 'Proposta non inviata', body: errorMessage(error) }),
  });
  const cancelMutation = useMutation({
    mutationFn: cancelOffer,
    onSuccess: () => {
      setConfirmCancel(false);
      onDone({ variant: 'success', title: 'Offerta annullata', body: 'I pacchetti che includono le tue offerte sono stati esclusi; la richiesta prosegue con le alternative disponibili.' });
    },
    onError: (error) => setMessage({ variant: 'error', title: 'Offerta non annullata', body: errorMessage(error) }),
  });
  const busy = mutation.isPending || cancelMutation.isPending;

  const submit = (event) => {
    event.preventDefault();
    mutation.mutate({
      id: item.id,
      offers: offers.map((offer) => ({
        recipientAvailabilityId: offer.recipientAvailabilityId,
        pricingMode: offer.pricingMode,
        unitPrice: Number(offer.unitPrice),
      })),
      vehicleType: form.vehicleType,
      availabilityNote: form.availabilityNote,
    });
  };

  return (
    <form className="space-y-3" onSubmit={submit}>
      <div className="space-y-3">
        {item.destinations.map((destination, index) => {
          const offer = offers.find((entry) => entry.recipientAvailabilityId === destination.id);
          const distanceKm = destination.roadDistanceMeters == null ? null : destination.roadDistanceMeters / 1000;
          const perKm = offer?.pricingMode === 'per_km';
          const total = perKm && distanceKm != null
            ? Number(offer.unitPrice || 0) * distanceKm
            : Number(offer?.unitPrice || 0);
          return (
            <fieldset key={destination.id} className="space-y-3 rounded-xl border border-slate-200 p-3">
              <legend className="px-1 font-semibold">Destinatario {index + 1}</legend>
              <p className="text-sm text-slate-600">{destination.address}</p>
              <p className="text-xs text-slate-600">
                {distanceKm == null
                  ? `Distanza stradale non disponibile${destination.roadDistanceUnavailableReason === 'maps_not_configured' ? ': configurare GOOGLE_MAPS_API_KEY sul server' : ''}. Puoi inviare un’offerta fissa.`
                  : `Distanza stradale calcolata: ${distanceKm.toFixed(1)} km`}
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
                  Modalità
                  <select
                    className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
                    value={offer?.pricingMode || 'fixed_trip'}
                    onChange={setOffer(destination.id, 'pricingMode')}
                  >
                    <option value="fixed_trip">Viaggio fisso</option>
                    <option value="per_km" disabled={distanceKm == null}>EUR/km</option>
                  </select>
                </label>
                <Input
                  label={perKm ? 'Prezzo EUR/km' : 'Prezzo viaggio EUR'}
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={offer?.unitPrice ?? ''}
                  onChange={setOffer(destination.id, 'unitPrice')}
                  required
                />
              </div>
              {Number(offer?.unitPrice) > 0 && <p className="text-sm text-slate-600">Totale per questa sede: {formatEuro(total)}</p>}
            </fieldset>
          );
        })}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
          Mezzo
          <select className="rounded-xl border border-slate-300 px-3 py-2 text-sm" value={form.vehicleType} onChange={setFormField('vehicleType')}>
            <option>ADR Truck</option>
            <option>Container Truck</option>
            <option>Tank Trailer</option>
          </select>
        </label>
      </div>
      <Input label="Disponibilità (es. entro 48 ore)" value={form.availabilityNote} onChange={setFormField('availabilityNote')} />
      <p className="text-xs text-slate-600">Indica nella disponibilità anche le condizioni su IVA ed eventuali extra: non vengono calcolati separatamente dalla piattaforma.</p>
      <div className="flex flex-col-reverse justify-between gap-3 border-t border-slate-200 pt-4 sm:flex-row sm:items-center">
        <div>
          {mine.status === 'submitted' ? (
            <Button type="button" variant="danger" disabled={busy} onClick={() => setConfirmCancel(true)}>
              Annulla la mia offerta
            </Button>
          ) : (
            <Button type="button" variant="secondary" disabled={busy} onClick={() => mutation.mutate({ id: item.id, decline: true })}>
              Non partecipo
            </Button>
          )}
        </div>
        <Button type="submit" disabled={busy || offers.length === 0}>
          {mutation.isPending ? 'Invio...' : mine.status === 'submitted' ? 'Aggiorna proposta' : 'Invia proposta'}
        </Button>
      </div>
      {message && <StatusAlert variant={message.variant} title={message.title}>{message.body}</StatusAlert>}
      <ConfirmDialog
        open={confirmCancel}
        title="Annullare la tua offerta?"
        description="Tutti i pacchetti che includono le tue offerte saranno esclusi. La richiesta proseguirà con le proposte degli altri trasportatori."
        confirmLabel="Annulla offerta"
        variant="danger"
        busy={cancelMutation.isPending}
        onClose={() => setConfirmCancel(false)}
        onConfirm={() => cancelMutation.mutate(item.id)}
      />
    </form>
  );
}

export default function TransporterNotificationsPage() {
  const [status, setStatus] = useState('action');
  const [search, setSearch] = useState('');
  const { data = [], isLoading, isError, error } = useQuery({
    queryKey: ['transporter', 'pickups'],
    queryFn: fetchTransporterPickups,
  });
  const items = filterPickups(data, status, search);

  return (
    <RoleLayout title="Opportunita e aste" links={transporterLinks}>
      <Card title="Richieste per cui puoi fare una proposta">
        <PickupFilters status={status} onStatus={setStatus} search={search} onSearch={setSearch} />
        {isLoading && <p className="text-sm text-slate-600">Caricamento...</p>}
        {isError && <StatusAlert variant="error">{errorMessage(error, 'Impossibile caricare le richieste.')}</StatusAlert>}
        {!isLoading && !isError && (
          <div className="space-y-3 text-sm">
            {items.length === 0 && <p className="text-slate-600">Nessuna richiesta per questi filtri. Scegli “Tutte” o modifica la ricerca.</p>}
            {items.map((item) => (
              <div key={item.id} className="space-y-3 rounded-xl border border-slate-200 p-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <PickupSummary pickup={item} />
                  <StatusBadge status={item.stage} kind="stage" />
                </div>
                {item.myProposal.status === 'submitted' && (
                  <p className="text-emerald-700">Offerte inviate per {item.myProposal.offers.length} sedi di conferimento</p>
                )}
                {!['invited', 'submitted'].includes(item.myProposal.status) && (
                  <p className="text-slate-600">{RESPONSE_LABELS[item.myProposal.status]}</p>
                )}
                <Link to={`/transporter/pickups/${item.id}`} className="inline-block font-semibold text-brand-900 underline">{item.canRespond ? 'Apri e rispondi' : 'Apri richiesta'}</Link>
              </div>
            ))}
          </div>
        )}
      </Card>
    </RoleLayout>
  );
}
