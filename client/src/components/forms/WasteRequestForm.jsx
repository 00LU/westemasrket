import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import CERSelector from './CERSelector';
import Input from '../ui/Input';
import Button from '../ui/Button';
import api from '../../services/api';
import { createProducerPickup, publishProducerPickup } from '../../services/producerApi';
import { errorMessage } from '../../services/labels';

export default function WasteRequestForm() {
  const navigate = useNavigate();
  const [cerCode, setCerCode] = useState('15 01 10*');
  const [quantityTon, setQuantityTon] = useState('2.5');
  const [distanceKm, setDistanceKm] = useState('85');
  const [urgency, setUrgency] = useState('normal');
  const [pickupAddress, setPickupAddress] = useState('');
  const [deadline, setDeadline] = useState('');
  const [maxPriceInput, setMaxPriceInput] = useState('');
  const [notes, setNotes] = useState('');
  const [submitError, setSubmitError] = useState('');

  const quantity = Number(quantityTon || 0);
  const distance = Number(distanceKm || 0);
  const urgencyMultiplier = urgency === 'urgent' ? 1.3 : 1;
  const minPrice = Math.round((120 * quantity + 2.2 * distance) * urgencyMultiplier);
  const suggestedMaxPrice = Math.round(minPrice * 1.25);

  const estimateMutation = useMutation({
    mutationFn: async () => {
      const { data } = await api.post('/producers/pricing/estimate', {
        hazardous: cerCode.includes('*'),
        quantityTon: quantity,
        distanceKm: distance,
        urgency,
      });
      return data;
    },
  });

  const estimatedMin = Number(estimateMutation.data?.min || minPrice);
  const estimatedMax = Number(estimateMutation.data?.max || suggestedMaxPrice);

  const buildPayload = () => ({
    cerCode,
    quantityTon: quantity,
    pickupAddress,
    pickupLat: 45.4642,
    pickupLng: 9.19,
    // Date-only input: the pickup is due by the end of that day in the user's timezone.
    deadline: new Date(`${deadline}T23:59:00`).toISOString(),
    maxPrice: Number(maxPriceInput || estimatedMax),
    notes,
  });

  const createMutation = useMutation({
    mutationFn: async ({ publish }) => {
      const draft = await createProducerPickup(buildPayload());
      if (publish) {
        try {
          await publishProducerPickup(draft.id);
        } catch (error) {
          error.draft = draft;
          throw error;
        }
      }
      return draft;
    },
    onSuccess: (draft) => navigate(`/producer/pickups/${draft.id}`),
    onError: (error) => {
      const text = errorMessage(error, 'Impossibile salvare la richiesta.');
      // The draft was saved but could not be published: continue on its page, where it can be retried.
      if (error.draft) navigate(`/producer/pickups/${error.draft.id}`, { state: { notice: `Salvata come bozza. Pubblicazione non riuscita: ${text}` } });
      else setSubmitError(text);
    },
  });

  const submit = (publish) => (event) => {
    event.preventDefault();
    setSubmitError('');
    createMutation.mutate({ publish });
  };

  return (
    <form className="panel space-y-4" onSubmit={submit(true)}>
      <h3 className="font-display text-lg font-semibold">Nuova richiesta di ritiro</h3>
      <CERSelector value={cerCode} onChange={setCerCode} />
      <div className="grid gap-3 sm:grid-cols-2">
        <Input label="Quantità (ton)" value={quantityTon} onChange={(event) => setQuantityTon(event.target.value)} required />
        <Input label="Distanza stimata (km)" value={distanceKm} onChange={(event) => setDistanceKm(event.target.value)} required />
      </div>
      <Input label="Indirizzo di ritiro" placeholder="Via Industria 14, Milano" value={pickupAddress} onChange={(event) => setPickupAddress(event.target.value)} required />
      <Input label="Ritiro entro il" type="date" value={deadline} onChange={(event) => setDeadline(event.target.value)} required />
      <Input label="Prezzo massimo (EUR)" type="number" value={maxPriceInput} onChange={(event) => setMaxPriceInput(event.target.value)} placeholder={String(estimatedMax)} min="1" required />
      <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
        Urgenza
        <select className="rounded-xl border border-slate-300 px-3 py-2 text-sm" value={urgency} onChange={(event) => setUrgency(event.target.value)}>
          <option value="normal">Normale</option>
          <option value="urgent">Urgente (scadenza di legge)</option>
        </select>
      </label>
      <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
        Note / movimentazione speciale
        <textarea
          className="min-h-24 rounded-xl border border-slate-300 px-3 py-2 text-sm"
          placeholder="Dettagli ADR, vincoli di carico..."
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
        />
      </label>
      <div className="rounded-xl bg-brand-50 p-3 text-sm text-brand-900">
        Fascia di prezzo suggerita: EUR {estimatedMin.toLocaleString()} - EUR {estimatedMax.toLocaleString()}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="secondary" onClick={() => estimateMutation.mutate()} disabled={estimateMutation.isPending}>
          {estimateMutation.isPending ? 'Calcolo...' : 'Ricalcola stima'}
        </Button>
        <Button type="button" variant="secondary" onClick={submit(false)} disabled={createMutation.isPending}>
          Salva come bozza
        </Button>
        <Button type="submit" disabled={createMutation.isPending}>
          {createMutation.isPending ? 'Invio...' : 'Pubblica richiesta'}
        </Button>
      </div>
      {submitError && <p className="text-sm text-red-600">{submitError}</p>}
    </form>
  );
}
