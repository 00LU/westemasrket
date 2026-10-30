import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import RoleLayout from '../../components/shared/RoleLayout';
import Card from '../../components/ui/Card';
import StatusBadge from '../../components/shared/StatusBadge';
import Button from '../../components/ui/Button';
import StatusAlert from '../../components/ui/StatusAlert';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import PickupSummary from '../../components/shared/PickupSummary';
import AgreementPanel from '../../components/shared/AgreementPanel';
import { recipientLinks, transporterLinks } from '../../components/shared/navLinks';
import { fetchRecipientPickup } from '../../services/recipientApi';
import { fetchTransporterPickup } from '../../services/transporterApi';
import { RESPONSE_LABELS, errorMessage, formatEuro } from '../../services/labels';
import { AvailabilityForm } from '../recipient/RecipientNotificationsPage';
import { ProposalForm } from '../transporter/TransporterNotificationsPage';
import GooglePickupMap from '../../components/map/GooglePickupMap';
import { cancelOffer } from '../../services/pickupApi';

export default function OperatorPickupPage({ role }) {
  const { id } = useParams();
  const queryClient = useQueryClient();
  const [actionFeedback, setActionFeedback] = useState(null);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const recipient = role === 'recipient';
  const query = useQuery({
    queryKey: [role, 'pickup', id],
    queryFn: () => recipient ? fetchRecipientPickup(id) : fetchTransporterPickup(id),
  });
  const item = query.data;
  const refresh = (feedback) => {
    if (feedback) setActionFeedback(feedback);
    queryClient.invalidateQueries({ queryKey: [role] });
  };
  const cancelMutation = useMutation({
    mutationFn: cancelOffer,
    onSuccess: () => {
      setConfirmCancel(false);
      setActionFeedback({ variant: 'success', title: 'Offerta annullata', body: 'La richiesta prosegue con le offerte rimaste. I pacchetti che includevano la tua offerta sono stati esclusi.' });
      refresh();
    },
    onError: (error) => setActionFeedback({ variant: 'error', title: 'Offerta non annullata', body: errorMessage(error) }),
  });
  const response = item && (recipient ? item.myResponse : item.myProposal);
  const onResponseDone = (feedback) => {
    setActionFeedback(feedback);
    refresh();
  };

  return (
    <RoleLayout title="Dettaglio richiesta di ritiro" links={recipient ? recipientLinks : transporterLinks}>
      <Link to={`/${role}/requests`} className="text-sm font-semibold text-brand-900 underline">Torna alle richieste</Link>
      {query.isLoading && <p role="status">Caricamento richiesta...</p>}
      {query.isError && (
        <StatusAlert variant="error" action={<button type="button" className="text-sm font-semibold underline" onClick={() => query.refetch()}>Riprova</button>}>
          {errorMessage(query.error, 'Impossibile caricare la richiesta.')}
        </StatusAlert>
      )}
      {actionFeedback && <StatusAlert variant={actionFeedback.variant} title={actionFeedback.title}>{actionFeedback.body}</StatusAlert>}
      {item && (
        <>
          <Card title={item.requestCode || '—'} action={<StatusBadge status={item.stage} kind="stage" />}>
            <div className="space-y-3 text-sm">
              <div className={!recipient ? 'grid gap-4 md:grid-cols-2 md:items-start' : undefined}>
                <PickupSummary pickup={item} showCode={false} />
                {!recipient && (
                  <GooglePickupMap
                    origin={{ address: item.pickupAddress, lat: item.pickupLat, lng: item.pickupLng }}
                    destinations={item.destinations || []}
                  />
                )}
              </div>
              {!item.agreement && (
                <p role="status" className="rounded-xl bg-brand-50 p-3">
                  {item.stage === 'cancelled'
                    ? 'La richiesta è stata annullata. Non sono richieste altre risposte.'
                    : item.stage === 'closed'
                      ? 'La tua partecipazione è conclusa. Non sono richieste altre risposte.'
                      : item.stage === 'to_respond'
                        ? recipient ? 'Ora tocca a te: conferma la disponibilità o comunica che non sei disponibile.' : 'Ora tocca a te: invia una proposta o comunica che non partecipi.'
                        : 'La tua risposta è stata registrata. Attendi l’esito della raccolta e la scelta del Produttore.'}
                </p>
              )}
              <p>La tua risposta: {RESPONSE_LABELS[response.status]}</p>
              {recipient && response.status === 'available' && (
                <p>Trattamento: {formatEuro(response.unitPrice)}/{item.quantityUnit === 'liter' ? 'litro' : 'kg'} · {response.destinationAddress}</p>
              )}
              {!recipient && response.status === 'submitted' && (
                <div>
                  <p>Le tue offerte per sede:</p>
                  <ul className="list-inside list-disc">
                    {response.offers.map((offer) => (
                      <li key={offer.recipientAvailabilityId}>
                        {offer.destinationAddress}: {formatEuro(offer.price)}
                        {offer.pricingMode === 'per_km'
                          ? ` (${formatEuro(offer.unitPrice)}/km × ${Number(offer.distanceKm).toFixed(1)} km)`
                          : ' (prezzo fisso)'}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {item.canRespond && (recipient
                ? <AvailabilityForm key={item.id} item={item} onDone={onResponseDone} />
                : <ProposalForm key={item.id} item={item} onDone={onResponseDone} />)}
              {item.canCancelOffer && !item.canRespond && !item.agreement && (
                <section className="space-y-3 rounded-xl border border-red-200 bg-red-50 p-4">
                  <div>
                    <h2 className="font-semibold text-red-900">Ritira la tua offerta</h2>
                    <p className="mt-1 text-sm text-red-800">I pacchetti che la includono verranno esclusi; la richiesta continuerà con le altre offerte disponibili.</p>
                  </div>
                  <Button type="button" variant="danger" disabled={cancelMutation.isPending} onClick={() => setConfirmCancel(true)}>
                    Annulla la mia offerta
                  </Button>
                </section>
              )}
            </div>
          </Card>
          <AgreementPanel
            key={item.agreement?.activeSlot?.id || item.id}
            pickupId={id}
            agreement={item.agreement}
            role={role}
            confirmed={['confirmed', 'completed'].includes(item.stage)}
            completed={item.stage === 'completed'}
            onChanged={refresh}
          />
        </>
      )}
      <ConfirmDialog
        open={confirmCancel}
        title="Annullare la tua offerta?"
        description="I pacchetti che la includono saranno esclusi. Se restano alternative, il produttore potrà continuare la trattativa con gli altri operatori."
        confirmLabel="Annulla offerta"
        variant="danger"
        busy={cancelMutation.isPending}
        onClose={() => setConfirmCancel(false)}
        onConfirm={() => cancelMutation.mutate(id)}
      />
    </RoleLayout>
  );
}
