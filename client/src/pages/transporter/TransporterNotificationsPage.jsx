import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import RoleLayout from '../../components/shared/RoleLayout';
import Card from '../../components/ui/Card';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';
import StatusBadge from '../../components/shared/StatusBadge';
import PickupSummary from '../../components/shared/PickupSummary';
import { transporterLinks } from '../../components/shared/navLinks';
import { fetchTransporterPickups, submitTransportProposal } from '../../services/transporterApi';
import { RESPONSE_LABELS, errorMessage, formatEuro } from '../../services/labels';
import PickupFilters from '../../components/shared/PickupFilters';
import { filterPickups } from '../../services/pickupGuidance';

export function ProposalForm({ item, onDone }) {
  const mine = item.myProposal;
  const [form, setForm] = useState({
    pricingMode: mine.pricingMode ?? 'fixed_trip',
    unitPrice: mine.unitPrice ?? mine.price ?? '',
    distanceKm: mine.distanceKm ?? '',
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
    mutation.mutate({
      id: item.id,
      pricingMode: form.pricingMode,
      unitPrice: Number(form.unitPrice),
      distanceKm: form.pricingMode === 'per_km' ? Number(form.distanceKm) : undefined,
      vehicleType: form.vehicleType,
      availabilityNote: form.availabilityNote,
    });
  };

  const perKm = form.pricingMode === 'per_km';
  const estimatedTotal = perKm ? Number(form.unitPrice || 0) * Number(form.distanceKm || 0) : Number(form.unitPrice || 0);

  return (
    <form className="space-y-3" onSubmit={submit}>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
          Modalità
          <select className="rounded-xl border border-slate-300 px-3 py-2 text-sm" value={form.pricingMode} onChange={set('pricingMode')}>
            <option value="fixed_trip">Viaggio fisso</option>
            <option value="per_km">EUR/km</option>
          </select>
        </label>
        <Input label={perKm ? 'Prezzo EUR/km' : 'Prezzo viaggio EUR'} type="number" min="0.01" step="0.01" value={form.unitPrice} onChange={set('unitPrice')} required />
        {perKm && <Input label="Distanza km" type="number" min="0.1" step="0.1" value={form.distanceKm} onChange={set('distanceKm')} required />}
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
      {estimatedTotal > 0 && <p className="text-sm text-slate-600">Totale trasporto: {formatEuro(estimatedTotal)}</p>}
      <p className="text-xs text-slate-600">Indica nella disponibilità anche le condizioni su IVA ed eventuali extra: non vengono calcolati separatamente dalla piattaforma.</p>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={mutation.isPending}>
          {mine.status === 'submitted' ? 'Aggiorna proposta' : 'Invia proposta'}
        </Button>
        <Button type="button" variant="secondary" disabled={mutation.isPending} onClick={() => mutation.mutate({ id: item.id, decline: true })}>
          Non partecipo
        </Button>
      </div>
      {message && <p role="alert" className="text-sm text-red-600">{message}</p>}
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
        {isError && <p className="text-sm text-red-600">{errorMessage(error, 'Impossibile caricare le richieste.')}</p>}
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
                  <p className="text-emerald-700">La tua proposta: {formatEuro(item.myProposal.price)}</p>
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
