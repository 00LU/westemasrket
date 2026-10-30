import { ROLE_LABELS, formatDateTime } from './labels.js';

export function agreementNextStep(agreement, role) {
  if (!agreement.activeSlot) {
    return role === 'producer'
      ? 'Ora tocca a te: proponi giorno e orario.'
      : 'Ora tocca al Produttore: deve proporre giorno e orario.';
  }
  const pending = Object.keys(ROLE_LABELS).filter((key) => !agreement.activeSlot.accepted[key]);
  if (pending.includes(role)) return 'Ora tocca a te: accetta la data o proponi un’alternativa.';
  return `Hai accettato. In attesa di: ${pending.map((key) => ROLE_LABELS[key]).join(', ')}.`;
}

export function producerNextStep(request) {
  switch (request.status) {
    case 'draft':
      return request.cerKnown
        ? 'Ora tocca a te: verifica i dati e pubblica la richiesta.'
        : 'In attesa dell’amministratore: deve proporre il codice CER.';
    case 'awaiting_recipients':
      return `Destinatari disponibili: ${request.counts.recipientsAvailable}; in attesa: ${request.counts.recipientsPending}. ${
        request.counts.recipientsAvailable > 0
          ? 'Puoi aspettare altre risposte o chiudere la raccolta e avvisare i trasportatori.'
          : 'I trasportatori saranno avvisati solo dopo almeno una disponibilità.'}`;
    case 'awaiting_transporters':
      return `${request.counts.proposalsSubmitted} proposte ricevute su ${request.counts.transportersInvited} invitati. ${
        request.counts.proposalsSubmitted > 0
          ? 'Puoi aspettare altre proposte o chiudere la raccolta per confrontare i pacchetti.'
          : 'In attesa delle proposte dei trasportatori.'}`;
    case 'packages_ready':
      return 'Ora tocca a te: confronta i pacchetti disponibili e scegli con chi concordare il ritiro.';
    case 'in_agreement':
      return request.pendingAgreementRoles.includes('producer')
        ? 'Ora tocca a te: proponi o accetta giorno e orario.'
        : `In attesa di: ${request.pendingAgreementRoles.map((role) => ROLE_LABELS[role]).join(', ')}.`;
    case 'confirmed':
      return `Tutti hanno accettato. Ritiro confermato per ${formatDateTime(request.confirmedSlotAt)}. Dopo aver terminato il tuo lavoro, confermalo dal dettaglio.`;
    case 'completed':
      return 'Produttore, destinatario e trasportatore hanno confermato il termine del ritiro.';
    case 'cancelled':
      return 'Richiesta annullata. Non sono richieste altre risposte.';
    default:
      return '';
  }
}

export function operatorNextStep(stage, role) {
  if (stage === 'to_respond') {
    return role === 'recipient'
      ? 'Rispondi alla richiesta indicando disponibilità e condizioni, oppure comunica che non sei disponibile.'
      : 'Invia le tue tariffe per i destinatari disponibili, oppure comunica che non partecipi.';
  }
  if (stage === 'responded') {
    return role === 'recipient'
      ? 'Disponibilità inviata. Attendi la chiusura della raccolta e la scelta del produttore.'
      : 'Proposta inviata. Attendi la chiusura dell’asta e la scelta del produttore.';
  }
  if (stage === 'in_agreement') return 'Concorda giorno e orario del ritiro con le altre parti.';
  if (stage === 'confirmed') return 'Ritiro confermato. Dopo aver terminato il tuo lavoro, confermalo dal dettaglio.';
  if (stage === 'completed') return 'Ritiro completato: tutte le parti hanno confermato la fine del lavoro.';
  if (stage === 'closed') return 'La tua partecipazione è conclusa. Non sono richieste altre azioni.';
  if (stage === 'cancelled') return 'Richiesta annullata. Non sono richieste altre azioni.';
  return 'Nessuna azione richiesta. Attendi gli aggiornamenti del produttore.';
}

export function notificationPickupPath(role, pickupId) {
  if (!['producer', 'recipient', 'transporter'].includes(role) || !pickupId) return null;
  return `/${role}/pickups/${encodeURIComponent(pickupId)}`;
}

export function filterPickups(items, status, search) {
  const needle = search.trim().toLocaleLowerCase('it-IT');
  return items.filter((item) => {
    const matchesStatus = status === 'all'
      || (status === 'action' && item.stage === 'to_respond')
      || (status === 'waiting' && ['responded', 'waiting'].includes(item.stage))
      || (status === 'agreement' && ['in_agreement', 'confirmed'].includes(item.stage))
      || (status === 'closed' && ['closed', 'cancelled', 'completed'].includes(item.stage));
    return matchesStatus && (!needle || `${item.requestCode || ''} ${item.cerCode} ${item.pickupAddress} ${item.wasteDescription || ''}`.toLocaleLowerCase('it-IT').includes(needle));
  });
}
