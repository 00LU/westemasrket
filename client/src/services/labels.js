export const REQUEST_STATUS_LABELS = {
  draft: 'Bozza',
  awaiting_recipients: 'In attesa destinatari',
  awaiting_transporters: 'In attesa trasportatori',
  packages_ready: 'Pacchetti pronti',
  in_agreement: 'In accordo',
  confirmed: 'Confermata',
  completed: 'Completata',
  cancelled: 'Annullata',
};

export const STAGE_LABELS = {
  to_respond: 'Da rispondere',
  responded: 'Risposta inviata',
  waiting: 'In attesa del produttore',
  in_agreement: 'Accordo su data e ora',
  confirmed: 'Ritiro confermato',
  completed: 'Ritiro completato',
  closed: 'Partecipazione conclusa',
  cancelled: 'Annullata',
};

export const RESPONSE_LABELS = {
  pending: 'In attesa',
  available: 'Disponibile',
  unavailable: 'Non disponibile',
  expired: 'Non risposto',
  invited: 'In attesa',
  submitted: 'Proposta inviata',
  declined: 'Rifiutato',
};

export const FAILURE_LABELS = {
  recipient_rejected: 'Rifiutato dal destinatario',
  transporter_rejected: 'Rifiutato dal trasportatore',
  recipient_cancelled: 'Offerta annullata dal destinatario',
  transporter_cancelled: 'Offerta annullata dal trasportatore',
  recipient_no_response: 'Nessuna risposta dal destinatario',
  transporter_no_response: 'Nessuna risposta dal trasportatore',
};

export const CANCEL_LABELS = {
  no_recipient_available: 'Nessun destinatario disponibile',
  no_transporter_available: 'Nessun trasportatore disponibile',
  no_transport_proposals: 'Nessuna proposta di trasporto',
  no_packages_left: 'Nessun pacchetto rimasto',
  producer_cancelled: 'Annullata dal produttore',
  request_edited: 'Sostituita da una nuova versione',
};

export const ROLE_LABELS = { producer: 'Produttore', recipient: 'Destinatario', transporter: 'Trasportatore' };

export function formatDateTime(value) {
  return value ? new Date(value).toLocaleString('it-IT', { dateStyle: 'medium', timeStyle: 'short' }) : '-';
}

export function formatEuro(value) {
  return `EUR ${Number(value || 0).toLocaleString('it-IT', { maximumFractionDigits: 2 })}`;
}

export function formatQuantity(value, unit) {
  const label = unit === 'liter' ? 'litri' : 'kg';
  return `${Number(value || 0).toLocaleString('it-IT')} ${label}`;
}

export function errorMessage(error, fallback = 'Operazione non riuscita.') {
  if (error?.response?.status === 401) return 'Sessione scaduta: effettua di nuovo il login.';
  if (error?.response?.status === 403) return 'Il tuo account non è autorizzato a eseguire questa azione. Verifica di aver effettuato l’accesso con il ruolo corretto.';
  return error?.response?.data?.message || fallback;
}
