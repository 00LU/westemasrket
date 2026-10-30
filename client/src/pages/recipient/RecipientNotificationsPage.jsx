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
import { recipientLinks } from '../../components/shared/navLinks';
import { fetchRecipientPickups, respondRecipientAvailability } from '../../services/recipientApi';
import { RESPONSE_LABELS, errorMessage, formatEuro, formatQuantity } from '../../services/labels';
import PickupFilters from '../../components/shared/PickupFilters';
import { filterPickups } from '../../services/pickupGuidance';
import AddressAutocomplete from '../../components/forms/AddressAutocomplete';
import { cancelOffer } from '../../services/pickupApi';

export function AvailabilityForm({ item, onDone }) {
  const mine = item.myResponse;
  const [form, setForm] = useState({
    unitPrice: mine.unitPrice ?? '',
    quantityTolerancePercent: mine.quantityTolerancePercent ?? '1',
    availabilityWindow: mine.availabilityWindow ?? '',
    destinationAddress: mine.destinationAddress ?? '',
    destinationLat: mine.destinationLat ?? null,
    destinationLng: mine.destinationLng ?? null,
    destinationPlaceId: mine.destinationPlaceId ?? '',
    notes: mine.notes ?? '',
  });
  const [message, setMessage] = useState('');
  const [confirmCancel, setConfirmCancel] = useState(false);
  const set = (field) => (event) => setForm((curr) => ({ ...curr, [field]: event.target.value }));

  const mutation = useMutation({
    mutationFn: respondRecipientAvailability,
    onMutate: () => setMessage(''),
    onSuccess: (_, variables) => {
      onDone(variables.available
        ? { variant: 'success', title: mine.status === 'available' ? 'Disponibilità aggiornata' : 'Disponibilità confermata', body: 'Ora il produttore raccoglie le risposte e poi sceglierà un pacchetto.' }
        : { variant: 'success', title: 'Indisponibilità registrata', body: 'La tua sede non sarà inclusa nei pacchetti di questa richiesta.' });
    },
    onError: (error) => setMessage({ variant: 'error', title: 'Risposta non inviata', body: errorMessage(error) }),
  });
  const cancelMutation = useMutation({
    mutationFn: cancelOffer,
    onSuccess: () => {
      setConfirmCancel(false);
      onDone({ variant: 'success', title: 'Offerta annullata', body: 'I pacchetti che includono la tua sede sono stati esclusi; l’asta prosegue con le alternative disponibili.' });
    },
    onError: (error) => setMessage({ variant: 'error', title: 'Offerta non annullata', body: errorMessage(error) }),
  });
  const busy = mutation.isPending || cancelMutation.isPending;

  const confirm = (event) => {
    event.preventDefault();
    mutation.mutate({
      id: item.id,
      available: true,
      unitPrice: Number(form.unitPrice),
      destinationAddress: form.destinationAddress,
      destinationLat: form.destinationLat,
      destinationLng: form.destinationLng,
      destinationPlaceId: form.destinationPlaceId,
      quantityTolerancePercent: form.quantityTolerancePercent === '' ? undefined : Number(form.quantityTolerancePercent),
      availabilityWindow: form.availabilityWindow,
      notes: form.notes,
    });
  };

  return (
    <form className="space-y-3" onSubmit={confirm}>
      <div className="grid gap-3 sm:grid-cols-2">
        <p className="rounded-xl bg-slate-50 p-3 text-sm text-slate-700">
          Unità stabilita dal produttore: EUR/{item.quantityUnit === 'liter' ? 'litro' : 'kg'}
        </p>
        <Input
          label={`Prezzo di smaltimento (EUR/${item.quantityUnit === 'liter' ? 'litro' : 'kg'})`}
          type="number"
          min="0"
          step="0.001"
          value={form.unitPrice}
          onChange={set('unitPrice')}
          required
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Input label="Tolleranza sulla quantità (%)" type="number" min="0" step="0.1" value={form.quantityTolerancePercent} onChange={set('quantityTolerancePercent')} />
        <Input label="Finestra di disponibilità" placeholder="Lun-Ven 08:00-17:00" value={form.availabilityWindow} onChange={set('availabilityWindow')} />
      </div>
      <AddressAutocomplete
        label="Indirizzo di destinazione"
        value={form.destinationAddress}
        onChange={(place) => setForm((current) => ({
          ...current,
          destinationAddress: place.addressFormatted,
          destinationLat: place.lat,
          destinationLng: place.lng,
          destinationPlaceId: place.placeId,
        }))}
        required
      />
      <Input label="Note" value={form.notes} onChange={set('notes')} />
      {form.unitPrice !== '' && (
        <p role="status" className="rounded-xl bg-slate-50 p-3 text-sm">
          {formatQuantity(item.quantity, item.quantityUnit)} × {formatEuro(Number(form.unitPrice))}/{item.quantityUnit === 'liter' ? 'litro' : 'kg'} ={' '}
          <strong>{formatEuro(item.quantity * Number(form.unitPrice))} di trattamento</strong>.
        </p>
      )}
      <p className="text-xs text-slate-600">Specifica nelle note IVA ed eventuali extra: non vengono calcolati separatamente dalla piattaforma.</p>
      <div className="flex flex-col-reverse justify-between gap-3 border-t border-slate-200 pt-4 sm:flex-row sm:items-center">
        <div>
          {mine.status === 'available' ? (
            <Button type="button" variant="danger" disabled={busy} onClick={() => setConfirmCancel(true)}>
              Annulla la mia offerta
            </Button>
          ) : (
            <Button type="button" variant="secondary" disabled={busy} onClick={() => mutation.mutate({ id: item.id, available: false })}>
              Non sono disponibile
            </Button>
          )}
        </div>
        <Button type="submit" disabled={busy}>
          {mutation.isPending ? 'Invio...' : mine.status === 'available' ? 'Aggiorna disponibilità' : 'Conferma disponibilità'}
        </Button>
      </div>
      {message && <StatusAlert variant={message.variant} title={message.title}>{message.body}</StatusAlert>}
      <ConfirmDialog
        open={confirmCancel}
        title="Annullare la tua offerta?"
        description="Tutti i pacchetti che includono la tua sede saranno esclusi. La richiesta proseguirà con le altre offerte disponibili."
        confirmLabel="Annulla offerta"
        variant="danger"
        busy={cancelMutation.isPending}
        onClose={() => setConfirmCancel(false)}
        onConfirm={() => cancelMutation.mutate(item.id)}
      />
    </form>
  );
}

export default function RecipientNotificationsPage() {
  const [status, setStatus] = useState('action');
  const [search, setSearch] = useState('');
  const { data = [], isLoading, isError, error } = useQuery({
    queryKey: ['recipient', 'pickups'],
    queryFn: fetchRecipientPickups,
  });
  const items = filterPickups(data, status, search);

  return (
    <RoleLayout title="Ordini compatibili" links={recipientLinks}>
      <Card title="Richieste ricevute">
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
                {item.myResponse.status === 'available' && (
                  <p className="text-emerald-700">
                    La tua disponibilità: {formatEuro(item.myResponse.unitPrice)} / {item.quantityUnit === 'liter' ? 'litro' : 'kg'} presso {item.myResponse.destinationAddress}
                  </p>
                )}
                {item.myResponse.status !== 'pending' && item.myResponse.status !== 'available' && (
                  <p className="text-slate-600">{RESPONSE_LABELS[item.myResponse.status]}</p>
                )}
                <Link to={`/recipient/pickups/${item.id}`} className="inline-block font-semibold text-brand-900 underline">{item.canRespond ? 'Apri e rispondi' : 'Apri richiesta'}</Link>
              </div>
            ))}
          </div>
        )}
      </Card>
    </RoleLayout>
  );
}
