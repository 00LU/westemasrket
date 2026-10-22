import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import RoleLayout from '../../components/shared/RoleLayout';
import Card from '../../components/ui/Card';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';
import StatusBadge from '../../components/shared/StatusBadge';
import PickupSummary from '../../components/shared/PickupSummary';
import { recipientLinks } from '../../components/shared/navLinks';
import { fetchRecipientPickups, respondRecipientAvailability } from '../../services/recipientApi';
import { RESPONSE_LABELS, errorMessage, formatEuro } from '../../services/labels';

function AvailabilityForm({ item, onDone }) {
  const mine = item.myResponse;
  const [form, setForm] = useState({
    pricePerTon: mine.pricePerTon ?? '',
    destinationAddress: mine.destinationAddress ?? '',
    availableCapacityTon: mine.availableCapacityTon ?? '',
    notes: mine.notes ?? '',
  });
  const [message, setMessage] = useState('');
  const set = (field) => (event) => setForm((curr) => ({ ...curr, [field]: event.target.value }));

  const mutation = useMutation({
    mutationFn: respondRecipientAvailability,
    onSuccess: () => {
      setMessage('');
      onDone();
    },
    onError: (error) => setMessage(errorMessage(error)),
  });

  const confirm = (event) => {
    event.preventDefault();
    mutation.mutate({
      id: item.id,
      available: true,
      pricePerTon: Number(form.pricePerTon),
      destinationAddress: form.destinationAddress,
      availableCapacityTon: form.availableCapacityTon === '' ? undefined : Number(form.availableCapacityTon),
      notes: form.notes,
    });
  };

  return (
    <form className="space-y-3" onSubmit={confirm}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Input label="Prezzo smaltimento (EUR/ton)" type="number" min="0" step="0.01" value={form.pricePerTon} onChange={set('pricePerTon')} required />
        <Input label="Capacità disponibile (ton)" type="number" min="0" step="0.01" value={form.availableCapacityTon} onChange={set('availableCapacityTon')} />
      </div>
      <Input label="Indirizzo di destinazione" value={form.destinationAddress} onChange={set('destinationAddress')} required />
      <Input label="Note" value={form.notes} onChange={set('notes')} />
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={mutation.isPending}>
          {mine.status === 'available' ? 'Aggiorna disponibilità' : 'Conferma disponibilità'}
        </Button>
        <Button type="button" variant="secondary" disabled={mutation.isPending} onClick={() => mutation.mutate({ id: item.id, available: false })}>
          Non sono disponibile
        </Button>
      </div>
      {message && <p className="text-sm text-red-600">{message}</p>}
    </form>
  );
}

export default function RecipientNotificationsPage() {
  const queryClient = useQueryClient();
  const { data = [], isLoading, isError, error } = useQuery({
    queryKey: ['recipient', 'pickups'],
    queryFn: fetchRecipientPickups,
  });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['recipient'] });

  return (
    <RoleLayout title="Richieste di ritiro" links={recipientLinks}>
      <Card title="Richieste ricevute">
        {isLoading && <p className="text-sm text-slate-600">Caricamento...</p>}
        {isError && <p className="text-sm text-red-600">{errorMessage(error, 'Impossibile caricare le richieste.')}</p>}
        {!isLoading && !isError && (
          <div className="space-y-3 text-sm">
            {data.length === 0 && <p className="text-slate-600">Nessuna richiesta di ritiro.</p>}
            {data.map((item) => (
              <div key={item.id} className="space-y-3 rounded-xl border border-slate-200 p-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <PickupSummary pickup={item} />
                  <StatusBadge status={item.stage} kind="stage" />
                </div>
                {item.myResponse.status === 'available' && (
                  <p className="text-emerald-700">
                    La tua disponibilità: {formatEuro(item.myResponse.pricePerTon)}/ton presso {item.myResponse.destinationAddress}
                  </p>
                )}
                {item.myResponse.status !== 'pending' && item.myResponse.status !== 'available' && (
                  <p className="text-slate-600">{RESPONSE_LABELS[item.myResponse.status]}</p>
                )}
                {item.canRespond && <AvailabilityForm item={item} onDone={refresh} />}
              </div>
            ))}
          </div>
        )}
      </Card>
    </RoleLayout>
  );
}
