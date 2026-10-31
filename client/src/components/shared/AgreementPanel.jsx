import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import Card from '../ui/Card';
import Button from '../ui/Button';
import ConfirmDialog from '../ui/ConfirmDialog';
import StatusAlert from '../ui/StatusAlert';
import { acceptSlot, cancelOffer, confirmCompletion, proposeSlot } from '../../services/pickupApi';
import { withdrawProducerSelection } from '../../services/producerApi';
import { ROLE_LABELS, errorMessage, formatDateTime } from '../../services/labels';
import { agreementNextStep } from '../../services/pickupGuidance';
import AgreementSummary from './AgreementSummary';

function AcceptanceRow({ label, accepted, acceptedLabel = 'Accettato' }) {
  return (
    <li className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3">
      <span className="font-medium text-slate-800">{label}</span>
      <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${accepted ? 'bg-emerald-100 text-emerald-700' : 'bg-accent-100 text-accent-700'}`}>{accepted ? acceptedLabel : 'In attesa'}</span>
    </li>
  );
}

// Step 6 of the flow, identical for the three roles: only the actions allowed to `role` are shown.
export default function AgreementPanel({ id = 'accordo', pickupId, agreement, role, confirmed, completed = false, onChanged, showNextStep = true, showSummary = true }) {
  const [scheduledAt, setScheduledAt] = useState('');
  const [message, setMessage] = useState('');
  const [confirmation, setConfirmation] = useState(null);

  const mutationHandlers = (getSuccessFeedback) => ({
    onMutate: () => setMessage(null),
    onSuccess: () => {
      setMessage(null);
      setScheduledAt('');
      setConfirmation(null);
      onChanged?.(getSuccessFeedback());
    },
    onError: (error) => {
      setConfirmation(null);
      setMessage({ variant: 'error', title: 'Operazione non riuscita', body: errorMessage(error) });
    },
  });
  const proposeMutation = useMutation({
    mutationFn: proposeSlot,
    ...mutationHandlers(() => ({
      variant: 'success',
      title: 'Data proposta',
      body: 'La proposta è stata inviata. Le altre parti dovranno accettarla.',
    })),
  });
  const acceptMutation = useMutation({
    mutationFn: acceptSlot,
    ...mutationHandlers(() => ({
      variant: 'success',
      title: 'Conferma registrata',
      body: 'La data sarà confermata quando tutte le parti l’avranno accettata.',
    })),
  });
  const cancelOfferMutation = useMutation({
    mutationFn: cancelOffer,
    ...mutationHandlers(() => ({
      variant: 'success',
      title: 'Offerta annullata',
      body: 'La richiesta prosegue con le offerte rimaste.',
    })),
  });
  const withdrawMutation = useMutation({
    mutationFn: withdrawProducerSelection,
    ...mutationHandlers(() => ({
      variant: 'success',
      title: 'Selezione ritirata',
      body: 'Le parti sono state avvisate e il pacchetto è nuovamente selezionabile.',
    })),
  });
  const completionMutation = useMutation({
    mutationFn: confirmCompletion,
    ...mutationHandlers(() => ({
      variant: 'success',
      title: 'Fine lavoro confermata',
      body: 'Il ritiro sarà completato quando anche le altre parti avranno confermato.',
    })),
  });

  if (!agreement) return null;
  const { activeSlot, actions } = agreement;
  const completion = agreement.completion || { producer: false, recipient: false, transporter: false };
  const canConfirmCompletion = actions?.canConfirmCompletion
    ?? (confirmed && !completed && !completion[role]);
  const busy = proposeMutation.isPending || acceptMutation.isPending || cancelOfferMutation.isPending
    || withdrawMutation.isPending || completionMutation.isPending;

  const submitSlot = (event) => {
    event.preventDefault();
    if (!scheduledAt) return;
    const submit = () => proposeMutation.mutate({ id: pickupId, scheduledAt: new Date(scheduledAt).toISOString() });
    if (activeSlot) {
      setConfirmation({
        title: 'Inviare una nuova data?',
        description: 'La nuova data sostituirà quella attuale e le altre parti dovranno accettarla nuovamente.',
        confirmLabel: 'Invia nuova data',
        onConfirm: submit,
      });
    } else {
      submit();
    }
  };

  return (
    <>
      <Card id={id} title={completed ? 'Ritiro completato' : confirmed ? 'Ritiro confermato' : 'Accordo su giorno e orario'}>
      <div className="space-y-4 text-sm">
        {showSummary && <AgreementSummary agreement={agreement} />}

        {confirmed ? (
          <>
            <p className="rounded-xl bg-emerald-50 px-4 py-3 font-semibold text-emerald-800">
              Ritiro concordato per {formatDateTime(agreement.confirmedSlotAt)}
            </p>
            <div className="space-y-2">
              <p className="font-semibold text-slate-800">Conferme di fine lavoro</p>
              <ul className="space-y-1">
                <AcceptanceRow label="Produttore" accepted={completion.producer} acceptedLabel="Terminato" />
                <AcceptanceRow label="Destinatario" accepted={completion.recipient} acceptedLabel="Terminato" />
                <AcceptanceRow label="Trasportatore" accepted={completion.transporter} acceptedLabel="Terminato" />
              </ul>
            </div>
            {completed ? (
              <p className="rounded-xl bg-emerald-50 px-4 py-3 font-semibold text-emerald-800">
                Tutte le parti hanno confermato il termine del ritiro{agreement.completedAt ? ` il ${formatDateTime(agreement.completedAt)}` : ''}.
              </p>
            ) : canConfirmCompletion ? (
              <Button
                type="button"
                disabled={busy}
                onClick={() => setConfirmation({
                  title: 'Confermare la fine del tuo lavoro?',
                  description: 'La conferma non potrà essere revocata. Il ritiro sarà completato quando tutte e tre le parti avranno confermato.',
                  confirmLabel: 'Conferma fine lavoro',
                  onConfirm: () => completionMutation.mutate(pickupId),
                })}
              >
                Conferma fine del tuo lavoro
              </Button>
            ) : (
              <p role="status" className="text-sm text-slate-600">
                La tua conferma è registrata. Il ritiro sarà completato quando anche le altre parti confermeranno.
              </p>
            )}
          </>
        ) : (
          <>
            {showNextStep && (
              <p role="status" className="rounded-xl bg-brand-50 p-3 font-semibold text-brand-900">
                {agreementNextStep(agreement, role)}
              </p>
            )}
            {activeSlot ? (
              <div className="space-y-2">
                <p className="text-slate-700">
                  Data proposta da <strong>{ROLE_LABELS[activeSlot.proposedByRole]}</strong>:{' '}
                  <strong>{formatDateTime(activeSlot.scheduledAt)}</strong>
                </p>
                <ul className="space-y-1">
                  <AcceptanceRow label="Produttore" accepted={activeSlot.accepted.producer} />
                  <AcceptanceRow label="Destinatario" accepted={activeSlot.accepted.recipient} />
                  <AcceptanceRow label="Trasportatore" accepted={activeSlot.accepted.transporter} />
                </ul>
              </div>
            ) : (
              <p className="text-slate-600">
                {role === 'producer'
                  ? 'Proponi un giorno e un orario per il ritiro.'
                  : 'In attesa che il produttore proponga giorno e orario.'}
              </p>
            )}

            {actions.canAccept && (
              <Button type="button" disabled={busy} onClick={() => acceptMutation.mutate({ id: pickupId, slotId: activeSlot.id })}>
                Accetta questa data
              </Button>
            )}

            {actions.canProposeSlot && (
              <form className="flex flex-wrap items-end gap-2" onSubmit={submitSlot}>
                <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
                  {activeSlot ? 'Proponi un\'alternativa' : 'Giorno e orario'}
                  <input
                    type="datetime-local"
                    className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
                    value={scheduledAt}
                    onChange={(event) => setScheduledAt(event.target.value)}
                    required
                  />
                </label>
                <Button type="submit" variant={activeSlot ? 'secondary' : 'primary'} disabled={busy}>
                  {activeSlot ? 'Invia alternativa' : 'Proponi'}
                </Button>
              </form>
            )}

            <div className="flex flex-wrap gap-2">
              {actions.canCancelOffer && (
                <Button
                  type="button"
                  variant="danger"
                  disabled={busy}
                  onClick={() => setConfirmation({
                    title: 'Annullare la tua offerta?',
                    description: 'I pacchetti che la includono saranno esclusi. La richiesta proseguirà con le altre offerte disponibili.',
                    confirmLabel: 'Annulla offerta',
                    variant: 'danger',
                    onConfirm: () => cancelOfferMutation.mutate(pickupId),
                  })}
                >
                  Annulla la mia offerta
                </Button>
              )}
              {actions.canWithdraw && (
                <Button type="button" variant="secondary" disabled={busy} onClick={() => setConfirmation({
                  title: 'Ritirare la selezione?',
                  description: 'L’accordo verrà interrotto, le parti saranno avvisate e il pacchetto tornerà selezionabile.',
                  confirmLabel: 'Ritira selezione',
                  variant: 'danger',
                  onConfirm: () => withdrawMutation.mutate(pickupId),
                })}>
                  Torna all&apos;elenco dei pacchetti
                </Button>
              )}
            </div>
            {agreement.agreementDeadline && (
              <p className="text-xs text-slate-500">
                Termine dell’accordo: {formatDateTime(agreement.agreementDeadline)}. Senza tutte le conferme l’accordo viene interrotto.
              </p>
            )}
          </>
        )}
        {message && <StatusAlert variant={message.variant} title={message.title}>{message.body}</StatusAlert>}
      </div>
      </Card>
      <ConfirmDialog
        open={Boolean(confirmation)}
        title={confirmation?.title}
        description={confirmation?.description}
        confirmLabel={confirmation?.confirmLabel}
        variant={confirmation?.variant}
        busy={busy}
        onClose={() => setConfirmation(null)}
        onConfirm={() => confirmation?.onConfirm()}
      />
    </>
  );
}
