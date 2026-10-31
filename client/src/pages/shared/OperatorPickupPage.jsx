import { useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import RoleLayout from '../../components/shared/RoleLayout';
import DetailLayout, { ActiveFirst, BackLink } from '../../components/shared/DetailLayout';
import NextStepBar from '../../components/shared/NextStepBar';
import ProgressTimeline from '../../components/shared/ProgressTimeline';
import Card from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import StatusBadge from '../../components/shared/StatusBadge';
import Button from '../../components/ui/Button';
import StatusAlert from '../../components/ui/StatusAlert';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import PickupSummary from '../../components/shared/PickupSummary';
import AgreementPanel from '../../components/shared/AgreementPanel';
import AgreementSummary from '../../components/shared/AgreementSummary';
import { recipientLinks, transporterLinks } from '../../components/shared/navLinks';
import { fetchRecipientPickup } from '../../services/recipientApi';
import { fetchTransporterPickup } from '../../services/transporterApi';
import { RESPONSE_LABELS, errorMessage, formatEuro } from '../../services/labels';
import { agreementActionable, agreementNextStep, operatorNextStep } from '../../services/pickupGuidance';
import { AvailabilityForm } from '../recipient/RecipientNotificationsPage';
import { ProposalForm } from '../transporter/TransporterNotificationsPage';
import GooglePickupMap from '../../components/map/GooglePickupMap';
import { cancelOffer } from '../../services/pickupApi';
import useMediaQuery from '../../hooks/useMediaQuery';

const STAGES = [
  ['to_respond', 'Da rispondere'],
  ['responded', 'Risposta inviata'],
  ['in_agreement', 'Accordo su data e ora'],
  ['confirmed', 'Ritiro confermato'],
  ['completed', 'Ritiro completato'],
];

function nextStepText(item, role) {
  if (item.agreement && item.stage === 'in_agreement') return agreementNextStep(item.agreement, role);
  if (item.stage === 'cancelled') return 'La richiesta è stata annullata. Non sono richieste altre risposte.';
  if (item.stage === 'closed') return 'La tua partecipazione è conclusa. Non sono richieste altre risposte.';
  if (item.stage === 'to_respond') {
    return role === 'recipient'
      ? 'Ora tocca a te: conferma la disponibilità o comunica che non sei disponibile.'
      : 'Ora tocca a te: invia una proposta o comunica che non partecipi.';
  }
  if (['responded', 'waiting'].includes(item.stage)) return 'La tua risposta è stata registrata. Attendi l’esito della raccolta e la scelta del Produttore.';
  return operatorNextStep(item.stage, role);
}

const responseTone = (status) => (['available', 'submitted'].includes(status) ? 'success' : ['pending', 'invited'].includes(status) ? 'warning' : 'neutral');

export default function OperatorPickupPage({ role }) {
  const { id } = useParams();
  const queryClient = useQueryClient();
  const [actionFeedback, setActionFeedback] = useState(null);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const recipient = role === 'recipient';
  const sideColumn = useMediaQuery('(min-width: 1280px)');
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

  const stageIndex = item ? STAGES.findIndex(([key]) => key === (item.stage === 'waiting' ? 'responded' : item.stage)) : -1;
  const showCancelOffer = item?.canCancelOffer && !item.canRespond && !item.agreement;
  const hasConditions = recipient ? response?.status === 'available' : response?.status === 'submitted';

  const agreementConfirmed = ['confirmed', 'completed'].includes(item?.stage);
  const activeSection = ['in_agreement', 'confirmed', 'completed'].includes(item?.stage)
    ? 'accordo'
    : item?.canRespond ? 'risposta' : undefined;
  const target = !item ? null
    : item.canRespond ? { id: 'risposta', label: recipient ? 'Conferma la disponibilità' : 'Invia la proposta' }
      : ['in_agreement', 'confirmed'].includes(item.stage) && agreementActionable(item.agreement, role, { confirmed: agreementConfirmed })
        ? { id: 'accordo', label: agreementConfirmed ? 'Conferma fine lavoro' : 'Vai all’accordo' }
        : null;
  const nextStepBar = item && <NextStepBar target={target || undefined}>{nextStepText(item, role)}</NextStepBar>;
  // The map is mounted once: next to the action on wide screens, among the details otherwise.
  const map = item && !recipient && (
    <GooglePickupMap
      origin={{ address: item.pickupAddress, lat: item.pickupLat, lng: item.pickupLng }}
      destinations={item.destinations || []}
    />
  );
  const selectedPackage = item?.agreement && (
    <Card id="pacchetto-scelto" title="Pacchetto scelto" className="!p-4">
      <AgreementSummary agreement={item.agreement} compact />
    </Card>
  );
  const aside = item && (
    <>
      {sideColumn && selectedPackage}
      {map && sideColumn && <Card>{map}</Card>}
      <Card title="Avanzamento">
        <ProgressTimeline steps={STAGES} current={stageIndex} cancelled={['cancelled', 'closed'].includes(item.stage)} />
      </Card>
      <Card title="La tua risposta" action={<Badge tone={responseTone(response.status)}>{RESPONSE_LABELS[response.status]}</Badge>}>
        <div className="space-y-3 text-sm">
          {recipient && hasConditions && (
            <div className="rounded-2xl bg-slate-50 p-4">
              <p className="text-xs font-medium text-slate-500">Trattamento</p>
              <p className="mt-1 font-display text-2xl font-bold text-slate-900">{formatEuro(response.unitPrice)}/{item.quantityUnit === 'liter' ? 'litro' : 'kg'}</p>
              <p className="mt-1 text-slate-600">{response.destinationAddress}</p>
            </div>
          )}
          {!recipient && hasConditions && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-slate-500">Le tue offerte per sede</p>
              <ul className="space-y-2">
                {response.offers.map((offer) => (
                  <li key={offer.recipientAvailabilityId} className="rounded-2xl bg-slate-50 p-4">
                    <p className="font-display text-xl font-bold text-slate-900">{formatEuro(offer.price)}</p>
                    <p className="text-slate-700">{offer.destinationAddress}</p>
                    <p className="text-xs text-slate-500">
                      {offer.pricingMode === 'per_km'
                        ? `${formatEuro(offer.unitPrice)}/km × ${Number(offer.distanceKm).toFixed(1)} km`
                        : 'Prezzo fisso'}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {!hasConditions && <p className="text-slate-600">Non hai inviato condizioni per questa richiesta.</p>}
        </div>
      </Card>
      {showCancelOffer && (
        <section className="space-y-3 rounded-2xl bg-red-50 p-5">
          <div>
            <h2 className="font-semibold text-red-900">Ritira la tua offerta</h2>
            <p className="mt-1 text-sm text-red-800">I pacchetti che la includono verranno esclusi; la richiesta continuerà con le altre offerte disponibili.</p>
          </div>
          <Button type="button" variant="danger" disabled={cancelMutation.isPending} onClick={() => setConfirmCancel(true)}>
            Annulla la mia offerta
          </Button>
        </section>
      )}
    </>
  );

  return (
    <RoleLayout title="Dettaglio richiesta di ritiro" links={recipient ? recipientLinks : transporterLinks}>
      <BackLink to={`/${role}/requests`}>Torna alle richieste</BackLink>
      {query.isLoading && <p role="status">Caricamento richiesta...</p>}
      {query.isError && (
        <StatusAlert variant="error" action={<button type="button" className="text-sm font-semibold underline" onClick={() => query.refetch()}>Riprova</button>}>
          {errorMessage(query.error, 'Impossibile caricare la richiesta.')}
        </StatusAlert>
      )}
      {item && (
        <DetailLayout nextStep={nextStepBar} aside={aside}>
          {actionFeedback && <StatusAlert variant={actionFeedback.variant} title={actionFeedback.title}>{actionFeedback.body}</StatusAlert>}
          <ActiveFirst activeId={activeSection} secondaryId="pacchetto-scelto">
            <Card id="riepilogo" title={item.requestCode || '—'} action={<StatusBadge status={item.stage} kind="stage" />}>
              <PickupSummary pickup={item} showCode={false} part="headline" />
            </Card>
            <Card id="dettagli" title="Dettagli della richiesta">
              <PickupSummary pickup={item} part="details" extra={!sideColumn && map} />
            </Card>
            {!sideColumn && selectedPackage}
            {item.canRespond && (
              <Card id="risposta" title={recipient ? 'Conferma la tua disponibilità' : 'Invia la tua proposta'}>
                {recipient
                  ? <AvailabilityForm key={item.id} item={item} onDone={onResponseDone} />
                  : <ProposalForm key={item.id} item={item} onDone={onResponseDone} />}
              </Card>
            )}
            <AgreementPanel
              id="accordo"
              key={item.agreement?.activeSlot?.id || item.id}
              pickupId={id}
              agreement={item.agreement}
              role={role}
              showNextStep={false}
              showSummary={false}
              confirmed={['confirmed', 'completed'].includes(item.stage)}
              completed={item.stage === 'completed'}
              onChanged={refresh}
            />
          </ActiveFirst>
        </DetailLayout>
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
