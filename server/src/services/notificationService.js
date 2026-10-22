const { Notification } = require('../models');

let ioServer = null;

const MESSAGES = {
  recipient_invited: 'Nuova richiesta di ritiro: conferma la tua disponibilità.',
  recipient_availability_received: 'Un destinatario ha risposto alla tua richiesta di ritiro.',
  transporters_invited: 'Nuova richiesta di ritiro: invia la tua proposta di trasporto.',
  transporters_notified: 'Disponibilità dei destinatari raccolte: i trasportatori sono stati avvisati.',
  transport_proposal_received: 'Un trasportatore ha inviato una proposta per la tua richiesta.',
  packages_ready: 'I pacchetti sono pronti: scegli il migliore per la tua richiesta.',
  package_selected: 'Sei stato scelto per un ritiro: concorda giorno e orario.',
  slot_proposed: 'È stata proposta una data per il ritiro: accetta o proponi un\'alternativa.',
  slot_accepted: 'Una parte ha accettato la data proposta per il ritiro.',
  pickup_confirmed: 'Ritiro confermato: tutte le parti sono d\'accordo su giorno e orario.',
  pickup_closed: 'La richiesta di ritiro è stata assegnata ad altri operatori.',
  package_failed: 'Il pacchetto scelto non è andato a buon fine: scegline un altro.',
  package_released: 'Il ritiro non è più in corso con te: il produttore ha scelto un\'altra soluzione.',
  pickup_cancelled: 'La richiesta di ritiro è stata annullata.',
  cer_proposed_by_admin: 'L\'amministratore ha proposto un codice CER per la tua richiesta: verificalo e pubblica.',
};

function setSocketServer(io) {
  ioServer = io;
}

function emitToUser(row) {
  if (!ioServer) return;
  ioServer.of('/notifications').to(`user:${row.userId}`).emit('notification:new', {
    id: row.id,
    type: row.type,
    payload: row.payloadJson,
    read: row.read,
    createdAt: row.created_at,
  });
}

// Persists one notification per recipient and pushes it only to that user's socket room.
async function notifyUsers(userIds, type, payload = {}, { transaction } = {}) {
  const uniqueIds = [...new Set((Array.isArray(userIds) ? userIds : [userIds]).filter(Boolean))];
  if (uniqueIds.length === 0) return [];

  const body = { message: MESSAGES[type] || type, ...payload };
  const rows = await Notification.bulkCreate(
    uniqueIds.map((userId) => ({ userId, type, payloadJson: body })),
    { transaction }
  );

  const flush = () => rows.forEach(emitToUser);
  if (transaction) transaction.afterCommit(flush);
  else flush();

  return rows;
}

module.exports = {
  setSocketServer,
  notifyUsers,
  MESSAGES,
};
