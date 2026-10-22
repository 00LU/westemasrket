import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import Card from '../ui/Card';
import Button from '../ui/Button';
import { acceptSlot, proposeSlot, rejectPackage } from '../../services/pickupApi';
import { withdrawProducerSelection } from '../../services/producerApi';
import { ROLE_LABELS, errorMessage, formatDateTime, formatEuro } from '../../services/labels';

function AcceptanceRow({ label, accepted }) {
  return (
    <li className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2">
      <span>{label}</span>
      <span className={accepted ? 'font-semibold text-emerald-700' : 'text-amber-700'}>{accepted ? 'Accettato' : 'In attesa'}</span>
    </li>
  );
}

// Step 6 of the flow, identical for the three roles: only the actions allowed to `role` are shown.
export default function AgreementPanel({ pickupId, agreement, role, confirmed, onChanged }) {
  const [scheduledAt, setScheduledAt] = useState('');
  const [message, setMessage] = useState('');

  const done = {
    onSuccess: () => {
      setMessage('');
      setScheduledAt('');
      onChanged();
    },
    onError: (error) => setMessage(errorMessage(error)),
  };
  const proposeMutation = useMutation({ mutationFn: proposeSlot, ...done });
  const acceptMutation = useMutation({ mutationFn: acceptSlot, ...done });
  const rejectMutation = useMutation({ mutationFn: rejectPackage, ...done });
  const withdrawMutation = useMutation({ mutationFn: withdrawProducerSelection, ...done });

  if (!agreement) return null;
  const { activeSlot, actions, parties, pricing } = agreement;
  const busy = proposeMutation.isPending || acceptMutation.isPending || rejectMutation.isPending || withdrawMutation.isPending;

  const submitSlot = (event) => {
    event.preventDefault();
    if (!scheduledAt) return;
    proposeMutation.mutate({ id: pickupId, scheduledAt: new Date(scheduledAt).toISOString() });
  };

  return (
    <Card title={confirmed ? 'Ritiro confermato' : 'Accordo su giorno e orario'}>
      <div className="space-y-4 text-sm">
        <div className="grid gap-2 sm:grid-cols-3">
          {Object.entries(parties).map(([key, party]) => (
            <div key={key} className="rounded-xl border border-slate-200 p-3">
              <p className="text-xs uppercase tracking-wide text-slate-500">{ROLE_LABELS[key]}</p>
              <p className="font-semibold text-slate-800">{party.companyName}</p>
              {party.destinationAddress && <p className="text-slate-600">{party.destinationAddress}</p>}
              {party.vehicleType && <p className="text-slate-600">{party.vehicleType}</p>}
            </div>
          ))}
        </div>

        <div className="flex flex-wrap gap-4 text-slate-700">
          {pricing.totalPrice !== undefined && <span>Totale: <strong>{formatEuro(pricing.totalPrice)}</strong></span>}
          {pricing.treatmentPrice !== undefined && <span>Smaltimento: {formatEuro(pricing.treatmentPrice)}</span>}
          {pricing.transportPrice !== undefined && <span>Trasporto: {formatEuro(pricing.transportPrice)}</span>}
        </div>

        {confirmed ? (
          <p className="rounded-xl bg-emerald-50 px-4 py-3 font-semibold text-emerald-800">
            Ritiro concordato per {formatDateTime(agreement.confirmedSlotAt)}
          </p>
        ) : (
          <>
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
              {actions.canReject && (
                <Button
                  type="button"
                  variant="danger"
                  disabled={busy}
                  onClick={() => window.confirm('Confermi di rifiutare questo ritiro?') && rejectMutation.mutate(pickupId)}
                >
                  Rifiuta il ritiro
                </Button>
              )}
              {actions.canWithdraw && (
                <Button type="button" variant="secondary" disabled={busy} onClick={() => withdrawMutation.mutate(pickupId)}>
                  Torna all&apos;elenco dei pacchetti
                </Button>
              )}
            </div>
            {agreement.agreementDeadline && (
              <p className="text-xs text-slate-500">
                Risposta attesa entro {formatDateTime(agreement.agreementDeadline)}, altrimenti il pacchetto decade.
              </p>
            )}
          </>
        )}
        {message && <p className="text-red-600">{message}</p>}
      </div>
    </Card>
  );
}
