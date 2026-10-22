import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import RoleLayout from '../../components/shared/RoleLayout';
import Card from '../../components/ui/Card';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';
import StatusBadge from '../../components/shared/StatusBadge';
import PickupSummary from '../../components/shared/PickupSummary';
import { transporterLinks } from '../../components/shared/navLinks';
import { fetchTransporterPickups, submitTransportProposal } from '../../services/transporterApi';
import { RESPONSE_LABELS, errorMessage, formatEuro } from '../../services/labels';

function ProposalForm({ item, onDone }) {
  const mine = item.myProposal;
  const [form, setForm] = useState({
    price: mine.price ?? '',
    vehicleType: mine.vehicleType ?? 'ADR Truck',
    availabilityNote: mine.availabilityNote ?? '',
  });
  const [message, setMessage] = useState('');
  const set = (field) => (event) => setForm((curr) => ({ ...curr, [field]: event.target.value }));

  const mutation = useMutation({
    mutationFn: submitTransportProposal,
    onSuccess: () => {
      setMessage('');
      onDone();
    },
    onError: (error) => setMessage(errorMessage(error)),
  });

  const submit = (event) => {
    event.preventDefault();
    mutation.mutate({ id: item.id, price: Number(form.price), vehicleType: form.vehicleType, availabilityNote: form.availabilityNote });
  };

  return (
    <form className="space-y-3" onSubmit={submit}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Input label="Prezzo del trasporto (EUR)" type="number" min="0" step="0.01" value={form.price} onChange={set('price')} required />
        <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
          Mezzo
          <select className="rounded-xl border border-slate-300 px-3 py-2 text-sm" value={form.vehicleType} onChange={set('vehicleType')}>
            <option>ADR Truck</option>
            <option>Container Truck</option>
            <option>Tank Trailer</option>
          </select>
        </label>
      </div>
      <Input label="Disponibilità (es. entro 48 ore)" value={form.availabilityNote} onChange={set('availabilityNote')} />
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={mutation.isPending}>
          {mine.status === 'submitted' ? 'Aggiorna proposta' : 'Invia proposta'}
        </Button>
        <Button type="button" variant="secondary" disabled={mutation.isPending} onClick={() => mutation.mutate({ id: item.id, decline: true })}>
          Non partecipo
        </Button>
      </div>
      {message && <p className="text-sm text-red-600">{message}</p>}
    </form>
  );
}

export default function TransporterNotificationsPage() {
  const queryClient = useQueryClient();
  const { data = [], isLoading, isError, error } = useQuery({
    queryKey: ['transporter', 'pickups'],
    queryFn: fetchTransporterPickups,
  });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['transporter'] });

  return (
    <RoleLayout title="Richieste di ritiro" links={transporterLinks}>
      <Card title="Richieste per cui puoi fare una proposta">
        {isLoading && <p className="text-sm text-slate-600">Caricamento...</p>}
        {isError && <p className="text-sm text-red-600">{errorMessage(error, 'Impossibile caricare le richieste.')}</p>}
        {!isLoading && !isError && (
          <div className="space-y-3 text-sm">
            {data.length === 0 && <p className="text-slate-600">Nessuna richiesta disponibile.</p>}
            {data.map((item) => (
              <div key={item.id} className="space-y-3 rounded-xl border border-slate-200 p-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <PickupSummary pickup={item} />
                  <StatusBadge status={item.stage} kind="stage" />
                </div>
                {item.myProposal.status === 'submitted' && (
                  <p className="text-emerald-700">La tua proposta: {formatEuro(item.myProposal.price)}</p>
                )}
                {!['invited', 'submitted'].includes(item.myProposal.status) && (
                  <p className="text-slate-600">{RESPONSE_LABELS[item.myProposal.status]}</p>
                )}
                {item.canRespond && <ProposalForm item={item} onDone={refresh} />}
              </div>
            ))}
          </div>
        )}
      </Card>
    </RoleLayout>
  );
}
