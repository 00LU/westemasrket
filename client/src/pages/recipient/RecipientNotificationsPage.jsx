import RoleLayout from '../../components/shared/RoleLayout';
import Card from '../../components/ui/Card';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { acceptRecipientSelection, createRecipientOffer, fetchRecipientNotifications } from '../../services/recipientApi';

const links = [
  { to: '/recipient', label: 'Dashboard' },
  { to: '/recipient/notifications', label: 'Notifications' },
  { to: '/recipient/capacity', label: 'Capacity' },
  { to: '/recipient/incoming', label: 'Incoming' },
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
    destinationAddress: formByRequest[item.id]?.destinationAddress || item.myOffer?.destinationAddress || '',
    availableCapacityTon: formByRequest[item.id]?.availableCapacityTon || '0',
    notes: formByRequest[item.id]?.notes || '',
  });

  const submitOffer = (item) => {
    const form = getFormValues(item);
    offerMutation.mutate({
      wasteRequestId: item.id,
      pricePerTon: Number(form.pricePerTon || 0),
      destinationAddress: form.destinationAddress,
      availableCapacityTon: Number(form.availableCapacityTon || 0),
      availabilityStatus: 'available',
      notes: form.notes,
    });
  };

  return (
    <RoleLayout title="Matching Waste Notifications" links={links}>
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
                <div className="grid gap-3 sm:grid-cols-2">
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
                </div>
                <Input
                  label="Destination address"
                  value={getFormValues(item).destinationAddress}
                  onChange={(event) => updateForm(item.id, 'destinationAddress', event.target.value)}
                />
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
