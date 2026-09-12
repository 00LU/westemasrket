import RoleLayout from '../../components/shared/RoleLayout';
import Card from '../../components/ui/Card';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { acceptTransportSelection, confirmTransporterCombination, createTransportOffer, fetchTransporterNotifications } from '../../services/transporterApi';

const links = [
  { to: '/transporter', label: 'Dashboard' },
  { to: '/transporter/opportunities', label: 'Opportunita e aste' },
  { to: '/transporter/planning', label: 'Pianificazione viaggi' },
  { to: '/transporter/jobs', label: 'Lavori assegnati' },
  { to: '/transporter/fleet', label: 'Mezzi e conducenti' },
  { to: '/transporter/authorizations', label: 'Autorizzazioni' },
  { to: '/transporter/earnings', label: 'Corrispettivi' },
  { to: '/profile', label: 'Profilo' },
];

export default function TransporterNotificationsPage() {
  const queryClient = useQueryClient();
  const { data = [], isLoading, isError, error } = useQuery({
    queryKey: ['transporter', 'notifications'],
    queryFn: fetchTransporterNotifications,
  });
  const [formByRequest, setFormByRequest] = useState({});

  const bidMutation = useMutation({
    mutationFn: createTransportOffer,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transporter', 'notifications'] });
    },
  });
  const acceptMutation = useMutation({
    mutationFn: acceptTransportSelection,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transporter', 'notifications'] });
    },
  });
  const confirmMutation = useMutation({
    mutationFn: confirmTransporterCombination,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['transporter', 'notifications'] }),
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

  const getForm = (item) => ({
    transportPrice: formByRequest[item.id]?.transportPrice || item.myBid?.transportPrice || '0',
    pricingMode: formByRequest[item.id]?.pricingMode || item.myBid?.pricingMode || 'fixed_trip',
    distanceKm: formByRequest[item.id]?.distanceKm || item.myBid?.distanceKm || '0',
    vehicleType: formByRequest[item.id]?.vehicleType || item.myBid?.vehicleType || 'ADR Truck',
    availability: formByRequest[item.id]?.availability || item.myBid?.availability || '',
  });

  const submitOffer = (item) => {
    const form = getForm(item);
    bidMutation.mutate({
      wasteRequestId: item.id,
      transportPrice: Number(form.transportPrice || 0),
      pricingMode: form.pricingMode,
      distanceKm: Number(form.distanceKm || 0),
      fixedPrice: form.pricingMode === 'fixed_trip' ? Number(form.transportPrice || 0) : undefined,
      vehicleType: form.vehicleType,
      availability: form.availability,
    });
  };

  return (
    <RoleLayout title="Opportunita e aste" links={links}>
      <div className="grid gap-6">
        <Card title="Request Feed">
          {isLoading && <p className="text-sm text-slate-600">Loading notifications...</p>}
          {isError && (
            <p className="text-sm text-red-600">
              {error?.response?.status === 401 ? 'Unauthorized: please login again as transporter.' : 'Unable to load notifications.'}
            </p>
          )}
          {!isLoading && !isError && (
            <div className="space-y-3 text-sm">
              {data.length === 0 && <p className="text-slate-600">No compatible requests at the moment.</p>}
              {data.map((item) => (
                <div key={item.id} className="space-y-3 rounded-xl border border-slate-200 p-3">
                  <div>
                    <p className="font-semibold text-slate-800">CER {item.cerCode} | {item.quantityTon} ton</p>
                    <p className="text-slate-600">Pickup: {item.pickupAddress}</p>
                    <p className="text-slate-600">Destination: {item.destinationAddress}</p>
                    <p className="text-slate-600">Recipient component: EUR {Number(item.recipientPricePerTon || 0).toLocaleString()}/ton</p>
                    {item.canAcceptSelection && <p className="font-semibold text-emerald-700">Sei stato selezionato per il trasporto</p>}
                    {item.canConfirmCombination && <p className="font-semibold text-amber-700">Riconferma richiesta dal produttore</p>}
                    {item.myBid && <p className="text-emerald-700">Your current offer: EUR {Number(item.myBid.transportPrice || 0).toLocaleString()}</p>}
                  </div>
                  {item.canAcceptSelection && (
                    <Button
                      type="button"
                      onClick={() => acceptMutation.mutate(item.id)}
                      disabled={acceptMutation.isPending}
                    >
                      {acceptMutation.isPending ? 'Conferma in corso...' : 'Accetta incarico trasporto'}
                    </Button>
                  )}
                  {item.canConfirmCombination && <Button type="button" onClick={() => confirmMutation.mutate(item.id)} disabled={confirmMutation.isPending}>{confirmMutation.isPending ? 'Conferma in corso...' : 'Riconferma combinazione'}</Button>}
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <Input
                      label={getForm(item).pricingMode === 'per_km' ? 'Prezzo EUR/km' : 'Prezzo viaggio EUR'}
                      type="number"
                      value={getForm(item).transportPrice}
                      onChange={(event) => updateForm(item.id, 'transportPrice', event.target.value)}
                    />
                    <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">Modalita<select className="rounded-xl border border-slate-300 px-3 py-2 text-sm" value={getForm(item).pricingMode} onChange={(event) => updateForm(item.id, 'pricingMode', event.target.value)}><option value="per_km">EUR/km</option><option value="fixed_trip">Viaggio fisso</option></select></label>
                    <Input label="Distanza km" type="number" value={getForm(item).distanceKm} onChange={(event) => updateForm(item.id, 'distanceKm', event.target.value)} />
                    <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
                      Vehicle type
                      <select
                        className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
                        value={getForm(item).vehicleType}
                        onChange={(event) => updateForm(item.id, 'vehicleType', event.target.value)}
                      >
                        <option>ADR Truck</option>
                        <option>Container Truck</option>
                        <option>Tank Trailer</option>
                      </select>
                    </label>
                    <Input
                      label="Availability"
                      value={getForm(item).availability}
                      onChange={(event) => updateForm(item.id, 'availability', event.target.value)}
                      placeholder="Next 24h"
                    />
                  </div>
                  <Button type="button" onClick={() => submitOffer(item)} disabled={bidMutation.isPending || item.canAcceptSelection}>
                    {bidMutation.isPending ? 'Sending...' : item.myBid ? 'Update transport offer' : 'Send transport offer'}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </RoleLayout>
  );
}
