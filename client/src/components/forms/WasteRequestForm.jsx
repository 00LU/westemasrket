import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import CERSelector from './CERSelector';
import Input from '../ui/Input';
import Button from '../ui/Button';
import api from '../../services/api';
import { createProducerWasteRequest } from '../../services/producerApi';

export default function WasteRequestForm() {
  const [cerCode, setCerCode] = useState('15 01 10*');
  const [quantityTon, setQuantityTon] = useState('2.5');
  const [distanceKm, setDistanceKm] = useState('85');
  const [urgency, setUrgency] = useState('normal');
  const [pickupAddress, setPickupAddress] = useState('');
  const [deadline, setDeadline] = useState('');
  const [maxPriceInput, setMaxPriceInput] = useState('');
  const [submitMessage, setSubmitMessage] = useState('');
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

  const createMutation = useMutation({
    mutationFn: createProducerWasteRequest,
    onSuccess: () => {
      setSubmitError('');
      setSubmitMessage('Request published successfully.');
      setPickupAddress('');
      setDeadline('');
      setMaxPriceInput('');
    },
    onError: (error) => {
      setSubmitMessage('');
      setSubmitError(
        error?.response?.status === 401
          ? 'Unauthorized: please login again as producer.'
          : error?.response?.data?.message || 'Unable to publish request.'
      );
    },
  });

  const estimatedMin = Number(estimateMutation.data?.min || minPrice);
  const estimatedMax = Number(estimateMutation.data?.max || suggestedMaxPrice);

  const handleSubmit = (event) => {
    event.preventDefault();
    setSubmitError('');
    setSubmitMessage('');

    createMutation.mutate({
      cerCode,
      quantityTon: quantity,
      pickupAddress,
      pickupLat: 45.4642,
      pickupLng: 9.19,
      deadline,
      maxPrice: Number(maxPriceInput || estimatedMax),
    });
  };

  return (
    <form className="panel space-y-4" onSubmit={handleSubmit}>
      <h3 className="font-display text-lg font-semibold">New Waste Request</h3>
      <CERSelector value={cerCode} onChange={setCerCode} />
      <div className="grid gap-3 sm:grid-cols-2">
        <Input label="Quantity (ton)" value={quantityTon} onChange={(event) => setQuantityTon(event.target.value)} required />
        <Input label="Distance (km)" value={distanceKm} onChange={(event) => setDistanceKm(event.target.value)} required />
      </div>
      <Input label="Pickup Address" placeholder="Via Industria 14, Milano" value={pickupAddress} onChange={(event) => setPickupAddress(event.target.value)} required />
      <Input label="Disposal Deadline" type="date" value={deadline} onChange={(event) => setDeadline(event.target.value)} required />
      <Input label="Max Price (EUR)" type="number" value={maxPriceInput} onChange={(event) => setMaxPriceInput(event.target.value)} placeholder={String(estimatedMax)} min="1" required />
      <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
        Urgency
        <select className="rounded-xl border border-slate-300 px-3 py-2 text-sm" value={urgency} onChange={(event) => setUrgency(event.target.value)}>
          <option value="normal">Normal</option>
          <option value="urgent">Urgent legal deadline</option>
        </select>
      </label>
      <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
        Notes / special handling
        <textarea className="min-h-24 rounded-xl border border-slate-300 px-3 py-2 text-sm" placeholder="ADR handling details, loading constraints..." />
      </label>
      <div className="rounded-xl bg-brand-50 p-3 text-sm text-brand-900">
        Suggested price range: EUR {estimatedMin.toLocaleString()} - EUR {estimatedMax.toLocaleString()}
      </div>
      <div className="flex gap-2">
        <Button
          type="button"
          variant="secondary"
          onClick={() => estimateMutation.mutate()}
          disabled={estimateMutation.isPending}
        >
          {estimateMutation.isPending ? 'Estimating...' : 'Recalculate Estimate'}
        </Button>
        <Button type="submit" disabled={createMutation.isPending}>
          {createMutation.isPending ? 'Publishing...' : 'Publish Reverse Auction'}
        </Button>
      </div>
      {submitMessage && <p className="text-sm text-emerald-700">{submitMessage}</p>}
      {submitError && <p className="text-sm text-red-600">{submitError}</p>}
    </form>
  );
}
