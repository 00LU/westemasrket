import RoleLayout from '../../components/shared/RoleLayout';
import Card from '../../components/ui/Card';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { acceptRecipientSelection, confirmRecipientCombination, createRecipientOffer, fetchRecipientNotifications } from '../../services/recipientApi';

const links = [
  { to: '/recipient', label: 'Dashboard' },
  { to: '/recipient/opportunities', label: 'Ordini compatibili' },
  { to: '/recipient/calendar', label: 'Calendario conferimenti' },
  { to: '/recipient/incoming', label: 'Arrivi e conferimenti' },
  { to: '/recipient/capacity', label: 'Disponibilita e capacita' },
  { to: '/recipient/facilities', label: 'Impianti e autorizzazioni' },
  { to: '/recipient/earnings', label: 'Corrispettivi' },
  { to: '/profile', label: 'Profilo' },
];

export default function RecipientNotificationsPage() {
  const queryClient = useQueryClient();
  const { data = [], isLoading, isError, error } = useQuery({
    queryKey: ['recipient', 'notifications'],
    queryFn: fetchRecipientNotifications,
  });
  const [formByRequest, setFormByRequest] = useState({});

  const offerMutation = useMutation({
    mutationFn: createRecipientOffer,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recipient', 'notifications'] });
    },
  });
  const acceptMutation = useMutation({
    mutationFn: acceptRecipientSelection,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recipient', 'notifications'] });
    },
  });
  const confirmMutation = useMutation({
    mutationFn: confirmRecipientCombination,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['recipient', 'notifications'] }),
  });

  const updateForm = (requestId, field, value) => {
    setFormByRequest((curr) => ({
      ...curr,
      [requestId]: {
        ...curr[requestId],
        [field]: value,
      },
    }));
  };

  const getFormValues = (item) => ({
    pricePerTon: formByRequest[item.id]?.pricePerTon || item.myOffer?.pricePerTon || '0',
    pricingUnit: formByRequest[item.id]?.pricingUnit || item.myOffer?.pricingUnit || 'per_ton',
    destinationAddress: formByRequest[item.id]?.destinationAddress || item.myOffer?.destinationAddress || '',
    availableCapacityTon: formByRequest[item.id]?.availableCapacityTon || item.myOffer?.availableCapacityTon || '0',
    quantityTolerancePercent: formByRequest[item.id]?.quantityTolerancePercent || item.myOffer?.quantityTolerancePercent || '1',
    availabilityWindow: formByRequest[item.id]?.availabilityWindow || item.myOffer?.availabilityWindow || '',
    notes: formByRequest[item.id]?.notes || '',
  });

  const submitOffer = (item) => {
    const form = getFormValues(item);
    offerMutation.mutate({
      wasteRequestId: item.id,
      pricePerTon: Number(form.pricePerTon || 0),
      pricingUnit: form.pricingUnit,
      destinationAddress: form.destinationAddress,
      availableCapacityTon: Number(form.availableCapacityTon || 0),
      quantityTolerancePercent: Number(form.quantityTolerancePercent || 1),
      availabilityWindow: form.availabilityWindow,
      availabilityStatus: 'available',
      notes: form.notes,
    });
  };

  return (
    <RoleLayout title="Ordini compatibili e offerte" links={links}>
      <Card title="Matching Feed">
        {isLoading && <p className="text-sm text-slate-600">Loading notifications...</p>}
        {isError && (
          <p className="text-sm text-red-600">
            {error?.response?.status === 401 ? 'Unauthorized: please login again as recipient.' : 'Unable to load notifications.'}
          </p>
        )}
        {!isLoading && !isError && (
          <div className="space-y-2 text-sm">
            {data.length === 0 && <p className="text-slate-600">No matching waste notifications.</p>}
            {data.map((item) => (
              <div key={item.id} className="space-y-3 rounded-xl border border-slate-200 p-3">
                <div>
                  <p className="font-semibold text-slate-800">CER {item.cerCode} | {item.quantityTon} ton</p>
                  <p className="text-slate-600">Pickup: {item.pickupAddress}</p>
                  <p className="text-slate-600">Deadline: {new Date(item.deadline).toLocaleDateString()}</p>
                  {item.canAcceptSelection && <p className="font-semibold text-emerald-700">Sei stato selezionato dal producer</p>}
                  {item.canConfirmCombination && <p className="font-semibold text-amber-700">Riconferma richiesta dal produttore</p>}
                  {item.myOffer && <p className="text-emerald-700">Existing offer: EUR {item.myOffer.pricePerTon}/ton</p>}
                </div>
                {item.canAcceptSelection && (
                  <Button
                    type="button"
                    onClick={() => acceptMutation.mutate(item.id)}
                    disabled={acceptMutation.isPending}
                  >
                    {acceptMutation.isPending ? 'Conferma in corso...' : 'Accetta selezione'}
                  </Button>
                )}
                {item.canConfirmCombination && <Button type="button" onClick={() => confirmMutation.mutate(item.id)} disabled={confirmMutation.isPending}>{confirmMutation.isPending ? 'Conferma in corso...' : 'Riconferma combinazione'}</Button>}
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <Input
                    label="Price per ton (EUR)"
                    type="number"
                    value={getFormValues(item).pricePerTon}
                    onChange={(event) => updateForm(item.id, 'pricePerTon', event.target.value)}
                  />
                  <Input
                    label="Available capacity (ton)"
                    type="number"
                    value={getFormValues(item).availableCapacityTon}
                    onChange={(event) => updateForm(item.id, 'availableCapacityTon', event.target.value)}
                  />
                  <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">Unita prezzo<select className="rounded-xl border border-slate-300 px-3 py-2 text-sm" value={getFormValues(item).pricingUnit} onChange={(event) => updateForm(item.id, 'pricingUnit', event.target.value)}><option value="per_kg">EUR/kg</option><option value="per_liter">EUR/litro</option><option value="per_ton">EUR/ton</option></select></label>
                  <Input label="Tolleranza quantita %" type="number" min="0" value={getFormValues(item).quantityTolerancePercent} onChange={(event) => updateForm(item.id, 'quantityTolerancePercent', event.target.value)} />
                </div>
                <Input
                  label="Destination address"
                  value={getFormValues(item).destinationAddress}
                  onChange={(event) => updateForm(item.id, 'destinationAddress', event.target.value)}
                />
                <Input label="Disponibilita preliminare" value={getFormValues(item).availabilityWindow} onChange={(event) => updateForm(item.id, 'availabilityWindow', event.target.value)} placeholder="Es. 10-12 ottobre" />
                <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
                  Notes
                  <textarea
                    className="min-h-20 rounded-xl border border-slate-300 px-3 py-2 text-sm"
                    value={getFormValues(item).notes}
                    onChange={(event) => updateForm(item.id, 'notes', event.target.value)}
                    placeholder="Availability details or treatment notes"
                  />
                </label>
                <Button type="button" onClick={() => submitOffer(item)} disabled={offerMutation.isPending || item.canAcceptSelection}>
                  {offerMutation.isPending ? 'Sending...' : item.myOffer ? 'Update Offer' : 'Send Offer'}
                </Button>
              </div>
            ))}
          </div>
        )}
      </Card>
    </RoleLayout>
  );
}
