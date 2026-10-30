import { Link, useLocation, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import RoleLayout from '../../components/shared/RoleLayout';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import StatusAlert from '../../components/ui/StatusAlert';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import StatusBadge from '../../components/shared/StatusBadge';
import PickupSummary from '../../components/shared/PickupSummary';
import AgreementPanel from '../../components/shared/AgreementPanel';
import { producerLinks } from '../../components/shared/navLinks';
import {
  cancelProducerPickup,
  closeRecipientPhase,
  closeTransporterPhase,
  fetchProducerPickup,
  publishProducerPickup,
  selectProducerPackage,
} from '../../services/producerApi';
import { CANCEL_LABELS, FAILURE_LABELS, REQUEST_STATUS_LABELS, RESPONSE_LABELS, errorMessage, formatDateTime, formatEuro } from '../../services/labels';
import { producerNextStep, agreementNextStep } from '../../services/pickupGuidance';

const STEPS = [
  ['draft', 'Bozza'],
  ['awaiting_recipients', 'Destinatari'],
  ['awaiting_transporters', 'Trasportatori'],
  ['packages_ready', 'Pacchetti'],
  ['in_agreement', 'Accordo'],
  ['confirmed', 'Confermata'],
  ['completed', 'Completata'],
];

function Stepper({ status }) {
  const index = STEPS.findIndex(([key]) => key === status);
  return (
    <ol className="flex flex-wrap gap-2 text-xs">
      {STEPS.map(([key, label], position) => (
        <li
          key={key}
          className={`rounded-full px-3 py-1 font-semibold ${
            status === 'cancelled'
              ? 'bg-slate-100 text-slate-400'
              : position < index
                ? 'bg-emerald-100 text-emerald-700'
                : position === index
                  ? 'bg-brand-900 text-white'
                  : 'bg-slate-100 text-slate-500'
          }`}
        >
          {label}
        </li>
      ))}
    </ol>
  );
}

function PackageCard({ pkg, onSelect, disabled }) {
  return (
    <div className="space-y-2 rounded-xl border border-slate-200 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-semibold text-slate-800">#{pkg.rank} | {formatEuro(pkg.totalPrice)}</span>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-500">Destinatario</p>
          <p className="font-medium">{pkg.recipient.companyName || 'Destinatario disponibile'}</p>
          <p className="text-slate-600">{pkg.recipient.destinationAddress}</p>
          <p className="text-slate-600">Smaltimento: {formatEuro(pkg.treatmentPrice)} ({formatEuro(pkg.recipient.unitPrice)}/{pkg.recipient.quantityUnit === 'liter' ? 'litro' : 'kg'})</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-500">Trasportatore</p>
          <p className="font-medium">{pkg.transporter.companyName || 'Trasportatore disponibile'}</p>
          <p className="text-slate-600">{[pkg.transporter.vehicleType, pkg.transporter.availabilityNote].filter(Boolean).join(' | ')}</p>
          <p className="text-slate-600">Trasporto: {formatEuro(pkg.transportPrice)}</p>
        </div>
      </div>
      {onSelect && (
        <Button type="button" disabled={disabled} onClick={() => onSelect(pkg.id)}>
          Scegli questo pacchetto
        </Button>
      )}
    </div>
  );
}

export default function ProducerPickupPage() {
  const { id } = useParams();
  const notice = useLocation().state?.notice;
  const queryClient = useQueryClient();
  const [feedback, setFeedback] = useState(null);
  const [confirmAction, setConfirmAction] = useState(null);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['producer', 'pickup', id],
    queryFn: () => fetchProducerPickup(id),
  });

  const refresh = (notice) => {
    if (notice) setFeedback(notice);
    queryClient.invalidateQueries({ queryKey: ['producer'] });
  };
  const mutationHandlers = (title, description) => ({
    onMutate: () => setFeedback(null),
    onSuccess: () => {
      setConfirmAction(null);
      setFeedback({ variant: 'success', title, description });
      refresh();
    },
    onError: (err) => {
      setConfirmAction(null);
      setFeedback({ variant: 'error', title: 'Operazione non riuscita', description: errorMessage(err) });
    },
  });
  const publishMutation = useMutation({
    mutationFn: publishProducerPickup,
    ...mutationHandlers('Richiesta pubblicata', 'I destinatari sono stati invitati. I trasportatori saranno avvisati dopo le disponibilità.'),
  });
  const closeRecipientsMutation = useMutation({
    mutationFn: closeRecipientPhase,
    ...mutationHandlers('Raccolta destinatari chiusa', 'I trasportatori sono stati avvisati e possono inviare le loro proposte.'),
  });
  const closeTransportersMutation = useMutation({
    mutationFn: closeTransporterPhase,
    ...mutationHandlers('Asta trasportatori chiusa', 'I pacchetti disponibili sono pronti per essere confrontati.'),
  });
  const selectMutation = useMutation({
    mutationFn: selectProducerPackage,
    ...mutationHandlers('Pacchetto selezionato', 'Ora proponi un giorno e un orario per il ritiro.'),
  });
  const cancelMutation = useMutation({
    mutationFn: cancelProducerPickup,
    ...mutationHandlers('Richiesta annullata', 'Le parti coinvolte sono state avvisate. La richiesta non proseguirà.'),
  });

  if (isLoading) {
    return <RoleLayout title="Dettaglio ritiro" links={producerLinks}><p className="text-sm text-slate-600">Caricamento...</p></RoleLayout>;
  }
  if (isError) {
    return (
      <RoleLayout title="Dettaglio ritiro" links={producerLinks}>
        <StatusAlert variant="error">{errorMessage(error, 'Richiesta non trovata.')}</StatusAlert>
      </RoleLayout>
    );
  }

  const { request, recipients, proposals, packages, failedPackages, agreement } = data;
  const busy = [publishMutation, closeRecipientsMutation, closeTransportersMutation, selectMutation, cancelMutation].some((m) => m.isPending);
  const availableRecipients = recipients.filter((r) => r.status === 'available').length;
  const submittedProposals = proposals.filter((p) => p.status === 'submitted').length;
  const pendingRecipients = recipients.filter((r) => r.status === 'pending').length;
  const pendingTransporters = proposals.filter((p) => p.status === 'invited').length;
  const nextStep = agreement && request.status === 'in_agreement'
    ? agreementNextStep(agreement, 'producer')
    : producerNextStep({
        ...request,
        counts: {
          recipientsAvailable: availableRecipients,
          recipientsPending: pendingRecipients,
          proposalsSubmitted: submittedProposals,
          transportersInvited: proposals.length,
        },
      });
  const canCancel = !['cancelled', 'completed'].includes(request.status);

  const askCancel = () => {
    setConfirmAction({
      title: 'Annullare questa richiesta?',
      description: 'Le parti coinvolte verranno avvisate e l’asta non proseguirà. Questa azione non può essere annullata.',
      confirmLabel: 'Annulla richiesta',
      variant: 'danger',
      onConfirm: () => cancelMutation.mutate({ id }),
    });
  };

  return (
    <RoleLayout title="Dettaglio ritiro" links={producerLinks}>
      <Card title={request.requestCode || '—'} action={<StatusBadge status={request.status} />}>
        <div className="space-y-3">
          <PickupSummary pickup={request} showCode={false} />
          <Stepper status={request.status} />
          <section aria-label="Prossimo passo" className="rounded-xl border border-brand-100 bg-brand-50 p-3 text-sm">
            <p className="font-semibold">Prossimo passo</p>
            <p>{nextStep}</p>
          </section>
          {request.status === 'cancelled' && (
            <StatusAlert variant="error" title="Richiesta annullata">
              {CANCEL_LABELS[request.cancelReason] || request.cancelReason}
            </StatusAlert>
          )}
          <div className="flex flex-wrap gap-2">
            {request.supersededById
              ? <Link className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50" to={`/producer/pickups/${request.supersededById}`}>Apri la nuova versione</Link>
              : <Link className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50" to={`/producer/pickups/${id}/edit`}>Modifica e riavvia il flusso</Link>}
          </div>
          {request.status === 'draft' && !request.cerKnown && (
            <StatusAlert variant="warning" title="Pubblicazione non ancora disponibile">
              In attesa della proposta del codice CER da parte dell&apos;amministratore. Potrai pubblicare dopo averla ricevuta.
            </StatusAlert>
          )}
          {request.status === 'draft' && request.cerKnown && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-brand-100 bg-brand-50 p-3">
              <p className="text-sm text-slate-700">La pubblicazione avvia la raccolta delle disponibilità dei destinatari.</p>
              <Button type="button" disabled={busy} onClick={() => publishMutation.mutate(id)}>
                {publishMutation.isPending ? 'Pubblicazione...' : 'Pubblica richiesta'}
              </Button>
            </div>
          )}
          {notice && !feedback && <StatusAlert variant="warning">{notice}</StatusAlert>}
          {feedback && (
            <StatusAlert variant={feedback.variant} title={feedback.title}>
              {feedback.description || feedback.body}
            </StatusAlert>
          )}
        </div>
      </Card>

      {recipients.length > 0 && (
        <Card title="Destinatari">
          <div className="space-y-2 text-sm">
            {recipients.map((item, index) => (
              <div key={item.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 px-3 py-2">
                <span className="font-medium">{`Destinatario ${index + 1}`}</span>
                <span className="text-slate-600">
                  {item.status === 'available' ? `${formatEuro(item.unitPrice)}/${request.quantityUnit === 'liter' ? 'litro' : 'kg'} | ${item.destinationAddress}` : ''}
                </span>
                <Badge tone={item.status === 'available' ? 'success' : item.status === 'pending' ? 'warning' : 'neutral'}>
                  {RESPONSE_LABELS[item.status]}
                </Badge>
              </div>
            ))}
            {request.status === 'awaiting_recipients' && (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-slate-50 p-3">
                <p className="text-slate-700">
                  {availableRecipients} {availableRecipients === 1 ? 'destinatario disponibile' : 'destinatari disponibili'}.
                  {pendingRecipients > 0 ? ` ${pendingRecipients} destinatari non hanno ancora risposto.` : ' Tutti i destinatari hanno risposto.'}
                </p>
                <Button type="button" disabled={busy || availableRecipients === 0} onClick={() => setConfirmAction({
                  title: 'Chiudere ora la raccolta?',
                  description: `${pendingRecipients} destinatari senza risposta verranno esclusi e i trasportatori saranno avvisati.`,
                  confirmLabel: 'Chiudi raccolta',
                  variant: 'primary',
                  onConfirm: () => closeRecipientsMutation.mutate(id),
                })}>
                  {closeRecipientsMutation.isPending ? 'Chiusura...' : 'Chiudi raccolta e avvisa i trasportatori'}
                </Button>
              </div>
            )}
          </div>
        </Card>
      )}

      {proposals.length > 0 && (
        <Card title="Proposte dei trasportatori">
          <div className="space-y-2 text-sm">
            {proposals.map((item, index) => (
              <div key={item.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 px-3 py-2">
                <span className="font-medium">{`Trasportatore ${index + 1}`}</span>
                <span className="text-slate-600">{item.status === 'submitted' ? `Da ${formatEuro(item.price)} | ${item.vehicleType || ''}` : ''}</span>
                <Badge tone={item.status === 'submitted' ? 'success' : item.status === 'invited' ? 'warning' : 'neutral'}>
                  {RESPONSE_LABELS[item.status]}
                </Badge>
                {item.status === 'submitted' && (
                  <div className="w-full space-y-1 text-slate-600">
                    {item.offers.map((offer) => (
                      <p key={offer.recipientAvailabilityId}>
                        {offer.destinationAddress}: {formatEuro(offer.price)}
                        {offer.pricingMode === 'per_km' ? ` (${formatEuro(offer.unitPrice)}/km × ${Number(offer.distanceKm || 0).toFixed(1)} km)` : ' (fisso)'}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            ))}
            {request.status === 'awaiting_transporters' && (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-slate-50 p-3">
                <p className="text-slate-700">
                  {submittedProposals} {submittedProposals === 1 ? 'proposta ricevuta' : 'proposte ricevute'}.
                  {pendingTransporters > 0 ? ` ${pendingTransporters} trasportatori non hanno ancora risposto.` : ' Tutti i trasportatori hanno risposto.'}
                </p>
                <Button type="button" disabled={busy || submittedProposals === 0} onClick={() => setConfirmAction({
                  title: 'Chiudere l’asta?',
                  description: `${pendingTransporters} trasportatori senza risposta verranno esclusi e saranno generati i pacchetti delle proposte ricevute.`,
                  confirmLabel: 'Chiudi l’asta',
                  variant: 'primary',
                  onConfirm: () => closeTransportersMutation.mutate(id),
                })}>
                  {closeTransportersMutation.isPending ? 'Chiusura...' : 'Chiudi l’asta e genera i pacchetti'}
                </Button>
              </div>
            )}
          </div>
        </Card>
      )}

      {request.status === 'packages_ready' && (
        <Card title="I migliori pacchetti (ordinati per prezzo più basso)">
          <div className="space-y-3 text-sm">
            <p className="text-slate-600">Confronto basato solo sul totale delle proposte. Distanza e tempi non influiscono sulla classifica. IVA ed eventuali extra non sono calcolati separatamente: verifica le condizioni prima della scelta.</p>
            {packages.map((pkg) => (
              <PackageCard key={pkg.id} pkg={pkg} disabled={busy} onSelect={(packageId) => {
                selectMutation.mutate({ id, packageId });
              }} />
            ))}
            {data.hiddenPackages > 0 && (
              <p className="text-xs text-slate-500">Altri {data.hiddenPackages} pacchetti disponibili compariranno se questi non andranno a buon fine.</p>
            )}
          </div>
        </Card>
      )}

      {['in_agreement', 'confirmed', 'completed'].includes(request.status) && data.currentPackage && (
        <Card title="Pacchetto scelto">
          <PackageCard pkg={data.currentPackage} />
        </Card>
      )}

      <AgreementPanel
        pickupId={id}
        agreement={agreement}
        role="producer"
        confirmed={['confirmed', 'completed'].includes(request.status)}
        completed={request.status === 'completed'}
        onChanged={refresh}
      />

      {failedPackages.length > 0 && (
        <Card title="Pacchetti non andati a buon fine">
          <div className="space-y-2 text-sm">
            {failedPackages.map((pkg) => (
              <div key={pkg.id} className="rounded-xl border border-slate-200 px-3 py-2 text-slate-600">
                #{pkg.rank} {pkg.recipient.companyName || 'Destinatario'} + {pkg.transporter.companyName || 'Trasportatore'} ({formatEuro(pkg.totalPrice)}) -{' '}
                {FAILURE_LABELS[pkg.failureReason] || pkg.failureReason}
              </div>
            ))}
          </div>
        </Card>
      )}

      {canCancel && (
        <section className="rounded-xl border border-red-200 bg-red-50 p-4">
          <h2 className="font-semibold text-red-900">Annulla questa richiesta</h2>
          <p className="mt-1 text-sm text-red-800">
            L’asta verrà interrotta e le parti coinvolte saranno avvisate. Questa azione non può essere annullata.
          </p>
          <Button type="button" className="mt-3" variant="danger" disabled={busy} onClick={askCancel}>
            {cancelMutation.isPending ? 'Annullamento...' : 'Annulla richiesta'}
          </Button>
        </section>
      )}

      <Card title="Cronologia">
        <ul className="space-y-1 text-xs text-slate-600">
          {data.history.map((item, index) => (
            <li key={index}>{formatDateTime(item.at)} - {REQUEST_STATUS_LABELS[item.from] || 'Nuova richiesta'} → {REQUEST_STATUS_LABELS[item.to] || item.to}</li>
          ))}
        </ul>
      </Card>

      <ConfirmDialog
        open={Boolean(confirmAction)}
        title={confirmAction?.title}
        description={confirmAction?.description}
        confirmLabel={confirmAction?.confirmLabel}
        variant={confirmAction?.variant}
        busy={busy}
        onClose={() => setConfirmAction(null)}
        onConfirm={() => confirmAction?.onConfirm()}
      />
    </RoleLayout>
  );
}
