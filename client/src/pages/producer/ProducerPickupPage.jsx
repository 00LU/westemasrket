import { Link, useLocation, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import RoleLayout from '../../components/shared/RoleLayout';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import StatusBadge from '../../components/shared/StatusBadge';
import PickupSummary from '../../components/shared/PickupSummary';
import AgreementPanel from '../../components/shared/AgreementPanel';
import Badge from '../../components/ui/Badge';
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
        {pkg.overBudget && <Badge tone="warning">Oltre il budget indicativo</Badge>}
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-500">Destinatario</p>
          <p className="font-medium">{pkg.recipient.companyName || 'Destinatario disponibile'}</p>
          <p className="text-slate-600">{pkg.recipient.destinationAddress}</p>
          <p className="text-slate-600">Smaltimento: {formatEuro(pkg.treatmentPrice)} ({formatEuro(pkg.recipient.pricePerTon)}/ton)</p>
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
  const [message, setMessage] = useState('');

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['producer', 'pickup', id],
    queryFn: () => fetchProducerPickup(id),
  });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['producer'] });
  };
  const handlers = {
    onSuccess: () => {
      setMessage('');
      refresh();
    },
    onError: (err) => setMessage(errorMessage(err)),
  };
  const publishMutation = useMutation({ mutationFn: publishProducerPickup, ...handlers });
  const closeRecipientsMutation = useMutation({ mutationFn: closeRecipientPhase, ...handlers });
  const closeTransportersMutation = useMutation({ mutationFn: closeTransporterPhase, ...handlers });
  const selectMutation = useMutation({ mutationFn: selectProducerPackage, ...handlers });
  const cancelMutation = useMutation({ mutationFn: cancelProducerPickup, ...handlers });

  if (isLoading) {
    return <RoleLayout title="Dettaglio ritiro" links={producerLinks}><p className="text-sm text-slate-600">Caricamento...</p></RoleLayout>;
  }
  if (isError) {
    return (
      <RoleLayout title="Dettaglio ritiro" links={producerLinks}>
        <p className="text-sm text-red-600">{errorMessage(error, 'Richiesta non trovata.')}</p>
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
  const canCancel = !['cancelled'].includes(request.status);

  const askCancel = () => {
    if (window.confirm('Vuoi annullare questa richiesta di ritiro? Tutte le parti coinvolte verranno avvisate.')) {
      cancelMutation.mutate({ id });
    }
  };

  return (
    <RoleLayout title="Dettaglio ritiro" links={producerLinks}>
      <Card title={request.requestCode || '—'} action={<StatusBadge status={request.status} />}>
        <div className="space-y-3">
          <PickupSummary pickup={request}>
            <p className="text-slate-600">Budget indicativo: {request.maxPrice > 0 ? formatEuro(request.maxPrice) : 'non indicato'}</p>
          </PickupSummary>
          <Stepper status={request.status} />
          <section aria-label="Prossimo passo" className="rounded-xl border border-brand-100 bg-brand-50 p-3 text-sm">
            <p className="font-semibold">Prossimo passo</p>
            <p>{nextStep}</p>
          </section>
          {request.status === 'cancelled' && (
            <p className="text-sm text-red-700">Annullata: {CANCEL_LABELS[request.cancelReason] || request.cancelReason}</p>
          )}
          <div className="flex flex-wrap gap-2">
            {request.status === 'draft' && <Link className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold" to={`/producer/pickups/${id}/edit`}>Modifica bozza</Link>}
            {request.status === 'draft' && (
              <Button type="button" disabled={busy || !request.cerKnown} onClick={() => publishMutation.mutate(id)}>Pubblica richiesta</Button>
            )}
            {canCancel && <Button type="button" variant="danger" disabled={busy} onClick={askCancel}>Annulla richiesta</Button>}
          </div>
          {request.status === 'draft' && !request.cerKnown && (
            <p className="text-sm text-amber-700">In attesa della proposta del codice CER da parte dell&apos;amministratore: potrai pubblicare dopo la proposta.</p>
          )}
          {notice && !message && <p className="text-sm text-amber-700">{notice}</p>}
          {message && <p className="text-sm text-red-600">{message}</p>}
        </div>
      </Card>

      {recipients.length > 0 && (
        <Card
          title="Destinatari"
          action={
            request.status === 'awaiting_recipients' && (
              <Button type="button" variant="secondary" disabled={busy || availableRecipients === 0} onClick={() => {
                if (window.confirm(`Destinatari disponibili: ${availableRecipients}. Destinatari senza risposta che verranno esclusi: ${pendingRecipients}. Vuoi chiudere la raccolta e avvisare i trasportatori?`)) closeRecipientsMutation.mutate(id);
              }}>
                Chiudi raccolta e avvisa i trasportatori
              </Button>
            )
          }
        >
          <div className="space-y-2 text-sm">
            {recipients.map((item, index) => (
              <div key={item.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 px-3 py-2">
                <span className="font-medium">{`Destinatario ${index + 1}`}</span>
                <span className="text-slate-600">
                  {item.status === 'available' ? `${formatEuro(item.pricePerTon)}/ton | ${item.destinationAddress}` : ''}
                </span>
                <Badge tone={item.status === 'available' ? 'success' : item.status === 'pending' ? 'warning' : 'neutral'}>
                  {RESPONSE_LABELS[item.status]}
                </Badge>
              </div>
            ))}
          </div>
        </Card>
      )}

      {proposals.length > 0 && (
        <Card
          title="Proposte dei trasportatori"
          action={
            request.status === 'awaiting_transporters' && (
              <Button type="button" variant="secondary" disabled={busy || submittedProposals === 0} onClick={() => {
                if (window.confirm(`Proposte ricevute per generare i pacchetti: ${submittedProposals}. Trasportatori senza risposta che verranno esclusi: ${pendingTransporters}. Vuoi chiudere la raccolta?`)) closeTransportersMutation.mutate(id);
              }}>
                Chiudi l&apos;asta e genera i pacchetti
              </Button>
            )
          }
        >
          <div className="space-y-2 text-sm">
            {proposals.map((item, index) => (
              <div key={item.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 px-3 py-2">
                <span className="font-medium">{`Trasportatore ${index + 1}`}</span>
                <span className="text-slate-600">{item.status === 'submitted' ? `${formatEuro(item.price)} | ${item.vehicleType || ''}` : ''}</span>
                <Badge tone={item.status === 'submitted' ? 'success' : item.status === 'invited' ? 'warning' : 'neutral'}>
                  {RESPONSE_LABELS[item.status]}
                </Badge>
              </div>
            ))}
          </div>
        </Card>
      )}

      {request.status === 'packages_ready' && (
        <Card title="I migliori pacchetti (ordinati per prezzo più basso)">
          <div className="space-y-3 text-sm">
            <p className="text-slate-600">Confronto basato solo sul totale delle proposte. Distanza e tempi non influiscono sulla classifica. IVA ed eventuali extra non sono calcolati separatamente: verifica le condizioni prima della scelta.</p>
            {packages.map((pkg) => (
              <PackageCard key={pkg.id} pkg={pkg} disabled={busy} onSelect={(packageId) => {
                if (pkg.overBudget && !window.confirm(`Totale del pacchetto: ${formatEuro(pkg.totalPrice)}. Supera il tuo budget indicativo di ${formatEuro(pkg.totalPrice - request.maxPrice)}. Vuoi selezionarlo comunque?`)) return;
                selectMutation.mutate({ id, packageId });
              }} />
            ))}
            {data.hiddenPackages > 0 && (
              <p className="text-xs text-slate-500">Altri {data.hiddenPackages} pacchetti disponibili compariranno se questi non andranno a buon fine.</p>
            )}
          </div>
        </Card>
      )}

      {['in_agreement', 'confirmed'].includes(request.status) && data.currentPackage && (
        <Card title="Pacchetto scelto">
          <PackageCard pkg={data.currentPackage} />
        </Card>
      )}

      <AgreementPanel pickupId={id} agreement={agreement} role="producer" confirmed={request.status === 'confirmed'} onChanged={refresh} />

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

      <Card title="Cronologia">
        <ul className="space-y-1 text-xs text-slate-600">
          {data.history.map((item, index) => (
            <li key={index}>{formatDateTime(item.at)} - {REQUEST_STATUS_LABELS[item.from] || 'Nuova richiesta'} → {REQUEST_STATUS_LABELS[item.to] || item.to}</li>
          ))}
        </ul>
      </Card>
    </RoleLayout>
  );
}
