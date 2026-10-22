const { Op } = require('sequelize');
const sequelize = require('../config/db');
const {
  PickupRequest,
  RecipientAvailability,
  TransportProposal,
  PickupPackage,
  SlotProposal,
  Transaction,
} = require('../models');
const {
  REQUEST_STATUS: S,
  RECIPIENT_RESPONSE: RR,
  PROPOSAL_STATUS: PS,
  PACKAGE_STATUS: PK,
  SLOT_STATUS: SL,
  settings,
} = require('../config/pickupFlow');
const { WorkflowError, transition } = require('./pickupStateMachine');
const { findEligibleRecipients, findEligibleTransporters } = require('./matchingEngine');
const { rankPackages } = require('./packageOptimizer');
const { notifyUsers } = require('./notificationService');

function fail(message, status = 400) {
  throw new WorkflowError(message, status);
}

// Every mutation runs inside a transaction holding a row lock on the request,
// so concurrent responses can never trigger the same phase change twice.
async function withRequestLock(requestId, fn) {
  return sequelize.transaction(async (t) => {
    const request = await PickupRequest.findByPk(requestId, { transaction: t, lock: t.LOCK.UPDATE });
    if (!request) fail('Richiesta di ritiro non trovata', 404);
    return fn(request, t);
  });
}

function assertProducer(request, user) {
  if (request.producerId !== user.id) fail('Richiesta di ritiro non trovata', 404);
}

function assertStatus(request, ...allowed) {
  if (!allowed.includes(request.status)) {
    fail(`Operazione non consentita nello stato "${request.status}"`, 409);
  }
}

function toNumber(value) {
  if (value === '' || value === null || value === undefined) return NaN;
  return Number(value);
}

function validateRequestInput(data, { partial = false } = {}) {
  const out = {};
  const has = (key) => data[key] !== undefined;

  if (!partial || has('cerCode')) {
    if (!String(data.cerCode || '').trim()) fail('Codice CER obbligatorio');
    out.cerCode = String(data.cerCode).trim();
  }
  if (!partial || has('quantityTon')) {
    const qty = toNumber(data.quantityTon);
    if (!(qty > 0)) fail('La quantità deve essere maggiore di zero');
    out.quantityTon = qty;
  }
  if (!partial || has('pickupAddress')) {
    if (!String(data.pickupAddress || '').trim()) fail('Indirizzo di ritiro obbligatorio');
    out.pickupAddress = String(data.pickupAddress).trim();
  }
  if (!partial || has('deadline')) {
    const deadline = new Date(data.deadline);
    if (Number.isNaN(deadline.getTime())) fail('Scadenza non valida');
    out.deadline = deadline;
  }
  if (!partial || has('maxPrice')) {
    const maxPrice = toNumber(data.maxPrice);
    if (!(maxPrice > 0)) fail('Il prezzo massimo deve essere maggiore di zero');
    out.maxPrice = maxPrice;
  }
  if (has('pickupLat')) out.pickupLat = data.pickupLat;
  if (has('pickupLng')) out.pickupLng = data.pickupLng;
  if (has('notes')) out.notes = data.notes ? String(data.notes) : null;
  return out;
}

// ---------------------------------------------------------------------------
// Step 1-2: producer creates & publishes, recipients are invited
// ---------------------------------------------------------------------------

async function createDraft(user, data) {
  return PickupRequest.create({
    ...validateRequestInput(data),
    producerId: user.id,
    status: S.DRAFT,
  });
}

async function updateDraft(user, requestId, data) {
  return withRequestLock(requestId, async (request, t) => {
    assertProducer(request, user);
    assertStatus(request, S.DRAFT);
    await request.update(validateRequestInput(data, { partial: true }), { transaction: t });
    return request;
  });
}

async function publish(user, requestId) {
  return withRequestLock(requestId, async (request, t) => {
    assertProducer(request, user);
    assertStatus(request, S.DRAFT);

    if (new Date(request.deadline) <= new Date()) fail('La scadenza deve essere nel futuro');

    const recipients = await findEligibleRecipients(request, { transaction: t });
    if (recipients.length === 0) fail('Nessun destinatario verificato disponibile per questa richiesta', 409);

    await RecipientAvailability.bulkCreate(
      recipients.map((r) => ({ pickupRequestId: request.id, recipientId: r.id, status: RR.PENDING })),
      { transaction: t }
    );
    await transition(request, S.AWAITING_RECIPIENTS, { actorId: user.id, note: 'published', transaction: t });
    await notifyUsers(recipients.map((r) => r.id), 'recipient_invited', { pickupRequestId: request.id }, { transaction: t });
    return request;
  });
}

// ---------------------------------------------------------------------------
// Step 2: recipients confirm availability
// ---------------------------------------------------------------------------

async function recipientRespond(user, requestId, body) {
  return withRequestLock(requestId, async (request, t) => {
    const availability = await RecipientAvailability.findOne({
      where: { pickupRequestId: request.id, recipientId: user.id },
      transaction: t,
    });
    if (!availability) fail('Richiesta di ritiro non trovata', 404);
    assertStatus(request, S.AWAITING_RECIPIENTS);

    if (body.available === true) {
      const pricePerTon = toNumber(body.pricePerTon);
      if (!(pricePerTon >= 0)) fail('Prezzo per tonnellata non valido');
      if (!String(body.destinationAddress || '').trim()) fail('Indirizzo di destinazione obbligatorio');
      const capacity = body.availableCapacityTon === undefined || body.availableCapacityTon === ''
        ? null
        : toNumber(body.availableCapacityTon);
      if (capacity !== null && !(capacity >= request.quantityTon)) {
        fail('La capacità disponibile è inferiore alla quantità richiesta');
      }

      await availability.update(
        {
          status: RR.AVAILABLE,
          pricePerTon,
          destinationAddress: String(body.destinationAddress).trim(),
          availableCapacityTon: capacity,
          notes: body.notes || null,
          respondedAt: new Date(),
        },
        { transaction: t }
      );
    } else if (body.available === false) {
      await availability.update(
        { status: RR.UNAVAILABLE, pricePerTon: null, destinationAddress: null, availableCapacityTon: null, notes: body.notes || null, respondedAt: new Date() },
        { transaction: t }
      );
    } else {
      fail('Indica se sei disponibile (available: true/false)');
    }

    await notifyUsers(
      request.producerId,
      'recipient_availability_received',
      { pickupRequestId: request.id, available: body.available === true },
      { transaction: t }
    );

    const pending = await RecipientAvailability.count({
      where: { pickupRequestId: request.id, status: RR.PENDING },
      transaction: t,
    });
    if (pending === 0) await openTransporterPhase(request, t, { actorId: null, note: 'all recipients responded' });

    return availability;
  });
}

async function closeRecipientPhase(user, requestId) {
  return withRequestLock(requestId, async (request, t) => {
    assertProducer(request, user);
    assertStatus(request, S.AWAITING_RECIPIENTS);

    const available = await RecipientAvailability.count({
      where: { pickupRequestId: request.id, status: RR.AVAILABLE },
      transaction: t,
    });
    if (available === 0) fail('Nessun destinatario ha ancora confermato la disponibilità', 409);

    await openTransporterPhase(request, t, { actorId: user.id, note: 'closed by producer' });
    return request;
  });
}

// ---------------------------------------------------------------------------
// Step 3: transporters are invited only if at least one recipient is available
// ---------------------------------------------------------------------------

async function openTransporterPhase(request, t, { actorId, note }) {
  const available = await RecipientAvailability.count({
    where: { pickupRequestId: request.id, status: RR.AVAILABLE },
    transaction: t,
  });
  if (available === 0) {
    return cancelRequest(request, 'no_recipient_available', { actorId, transaction: t });
  }

  await RecipientAvailability.update(
    { status: RR.EXPIRED },
    { where: { pickupRequestId: request.id, status: RR.PENDING }, transaction: t }
  );

  const transporters = await findEligibleTransporters(request, { transaction: t });
  if (transporters.length === 0) {
    return cancelRequest(request, 'no_transporter_available', { actorId, transaction: t });
  }

  await TransportProposal.bulkCreate(
    transporters.map((tr) => ({ pickupRequestId: request.id, transporterId: tr.id, status: PS.INVITED })),
    { transaction: t }
  );
  await transition(request, S.AWAITING_TRANSPORTERS, { actorId, note, transaction: t });
  await notifyUsers(transporters.map((tr) => tr.id), 'transporters_invited', { pickupRequestId: request.id }, { transaction: t });
  await notifyUsers(request.producerId, 'transporters_notified', { pickupRequestId: request.id }, { transaction: t });
  return request;
}

async function transporterRespond(user, requestId, body) {
  return withRequestLock(requestId, async (request, t) => {
    const proposal = await TransportProposal.findOne({
      where: { pickupRequestId: request.id, transporterId: user.id },
      transaction: t,
    });
    if (!proposal) fail('Richiesta di ritiro non trovata', 404);
    assertStatus(request, S.AWAITING_TRANSPORTERS);

    if (body.decline === true) {
      await proposal.update({ status: PS.DECLINED, price: null, respondedAt: new Date() }, { transaction: t });
    } else {
      const price = toNumber(body.price);
      if (!(price > 0)) fail('Il prezzo del trasporto deve essere maggiore di zero');
      await proposal.update(
        {
          status: PS.SUBMITTED,
          price,
          vehicleType: body.vehicleType || null,
          availabilityNote: body.availabilityNote || null,
          respondedAt: new Date(),
        },
        { transaction: t }
      );
      await notifyUsers(request.producerId, 'transport_proposal_received', { pickupRequestId: request.id }, { transaction: t });
    }

    const invited = await TransportProposal.count({
      where: { pickupRequestId: request.id, status: PS.INVITED },
      transaction: t,
    });
    if (invited === 0) await buildPackages(request, t, { actorId: null, note: 'all transporters responded' });

    return proposal;
  });
}

async function closeTransporterPhase(user, requestId) {
  return withRequestLock(requestId, async (request, t) => {
    assertProducer(request, user);
    assertStatus(request, S.AWAITING_TRANSPORTERS);

    const submitted = await TransportProposal.count({
      where: { pickupRequestId: request.id, status: PS.SUBMITTED },
      transaction: t,
    });
    if (submitted === 0) fail('Nessun trasportatore ha ancora inviato una proposta', 409);

    await buildPackages(request, t, { actorId: user.id, note: 'closed by producer' });
    return request;
  });
}

// ---------------------------------------------------------------------------
// Step 4: packages = available recipient x submitted transport proposal, ranked
// ---------------------------------------------------------------------------

async function buildPackages(request, t, { actorId, note }) {
  const [availabilities, proposals] = await Promise.all([
    RecipientAvailability.findAll({
      where: { pickupRequestId: request.id, status: RR.AVAILABLE },
      transaction: t,
    }),
    TransportProposal.findAll({
      where: { pickupRequestId: request.id, status: PS.SUBMITTED },
      transaction: t,
    }),
  ]);

  if (proposals.length === 0) {
    return cancelRequest(request, 'no_transport_proposals', { actorId, transaction: t });
  }

  await TransportProposal.update(
    { status: PS.EXPIRED },
    { where: { pickupRequestId: request.id, status: PS.INVITED }, transaction: t }
  );

  const candidates = [];
  availabilities.forEach((availability) => {
    proposals.forEach((proposal) => {
      const treatmentPrice = availability.pricePerTon * request.quantityTon;
      candidates.push({
        availabilityId: availability.id,
        proposalId: proposal.id,
        recipientId: availability.recipientId,
        transporterId: proposal.transporterId,
        treatmentPrice,
        transportPrice: proposal.price,
        totalPrice: treatmentPrice + proposal.price,
      });
    });
  });

  const ranked = rankPackages(candidates, settings.optimizationStrategy);
  await PickupPackage.bulkCreate(
    ranked.map((pkg) => ({
      pickupRequestId: request.id,
      recipientAvailabilityId: pkg.availabilityId,
      transportProposalId: pkg.proposalId,
      recipientId: pkg.recipientId,
      transporterId: pkg.transporterId,
      treatmentPrice: pkg.treatmentPrice,
      transportPrice: pkg.transportPrice,
      totalPrice: pkg.totalPrice,
      score: pkg.score,
      rank: pkg.rank,
      status: PK.PROPOSED,
    })),
    { transaction: t }
  );

  await transition(request, S.PACKAGES_READY, { actorId, note, transaction: t });
  await notifyUsers(request.producerId, 'packages_ready', { pickupRequestId: request.id }, { transaction: t });
  return request;
}

// The packages currently shown to the producer: best N still-proposed ones.
async function getVisiblePackages(requestId, { transaction } = {}) {
  return PickupPackage.findAll({
    where: { pickupRequestId: requestId, status: PK.PROPOSED },
    order: [['rank', 'ASC']],
    limit: settings.packagesTopN,
    transaction,
  });
}

// ---------------------------------------------------------------------------
// Step 5: producer picks a package, then the three parties agree on a slot
// ---------------------------------------------------------------------------

async function selectPackage(user, requestId, packageId) {
  return withRequestLock(requestId, async (request, t) => {
    assertProducer(request, user);
    assertStatus(request, S.PACKAGES_READY);

    const visible = await getVisiblePackages(request.id, { transaction: t });
    const pkg = visible.find((item) => item.id === packageId);
    if (!pkg) fail('Pacchetto non disponibile', 404);

    await pkg.update({ status: PK.SELECTED }, { transaction: t });
    await transition(request, S.IN_AGREEMENT, {
      actorId: user.id,
      note: 'package selected',
      transaction: t,
      patch: { selectedPackageId: pkg.id, agreementDeadline: agreementDeadlineFromNow() },
    });
    await notifyUsers([pkg.recipientId, pkg.transporterId], 'package_selected', { pickupRequestId: request.id }, { transaction: t });
    return pkg;
  });
}

function agreementDeadlineFromNow() {
  return new Date(Date.now() + settings.agreementResponseHours * 3600 * 1000);
}

async function loadAgreementContext(request, t) {
  const pkg = await PickupPackage.findByPk(request.selectedPackageId, { transaction: t });
  const slot = await SlotProposal.findOne({
    where: { pickupRequestId: request.id, packageId: pkg.id, status: SL.ACTIVE },
    transaction: t,
  });
  return { pkg, slot };
}

function partyOf(user, request, pkg) {
  if (user.id === request.producerId) return 'producer';
  if (user.id === pkg.recipientId) return 'recipient';
  if (user.id === pkg.transporterId) return 'transporter';
  return null;
}

async function proposeSlot(user, requestId, scheduledAtInput) {
  return withRequestLock(requestId, async (request, t) => {
    if (request.status !== S.IN_AGREEMENT) {
      // Hide the request from users who are not part of it.
      const isProducer = request.producerId === user.id;
      const involved = isProducer || (await isInvolved(user, request, t));
      if (!involved) fail('Richiesta di ritiro non trovata', 404);
      fail(`Operazione non consentita nello stato "${request.status}"`, 409);
    }

    const { pkg, slot } = await loadAgreementContext(request, t);
    const role = partyOf(user, request, pkg);
    if (!role) fail('Richiesta di ritiro non trovata', 404);

    const scheduledAt = new Date(scheduledAtInput);
    if (Number.isNaN(scheduledAt.getTime())) fail('Data e orario non validi');
    if (scheduledAt <= new Date()) fail('Il ritiro deve essere pianificato nel futuro');

    if (!slot && role !== 'producer') fail('Attendi la proposta di giorno e orario del produttore', 409);

    if (slot) {
      await slot.update({ status: SL.SUPERSEDED }, { transaction: t });
    }
    const created = await SlotProposal.create(
      {
        pickupRequestId: request.id,
        packageId: pkg.id,
        proposedById: user.id,
        proposedByRole: role,
        scheduledAt,
        producerAccepted: role === 'producer',
        recipientAccepted: role === 'recipient',
        transporterAccepted: role === 'transporter',
        status: SL.ACTIVE,
      },
      { transaction: t }
    );
    await request.update({ agreementDeadline: agreementDeadlineFromNow() }, { transaction: t });

    const others = otherParties(role, request, pkg);
    await notifyUsers(
      others,
      'slot_proposed',
      { pickupRequestId: request.id, scheduledAt: scheduledAt.toISOString(), proposedByRole: role },
      { transaction: t }
    );
    return created;
  });
}

async function isInvolved(user, request, t) {
  const count = await PickupPackage.count({
    where: {
      pickupRequestId: request.id,
      [Op.or]: [{ recipientId: user.id }, { transporterId: user.id }],
    },
    transaction: t,
  });
  return count > 0;
}

function otherParties(role, request, pkg) {
  const parties = { producer: request.producerId, recipient: pkg.recipientId, transporter: pkg.transporterId };
  return Object.entries(parties).filter(([key]) => key !== role).map(([, id]) => id);
}

async function acceptSlot(user, requestId, slotId) {
  return withRequestLock(requestId, async (request, t) => {
    if (request.status !== S.IN_AGREEMENT) {
      const involved = request.producerId === user.id || (await isInvolved(user, request, t));
      if (!involved) fail('Richiesta di ritiro non trovata', 404);
      fail(`Operazione non consentita nello stato "${request.status}"`, 409);
    }

    const { pkg, slot } = await loadAgreementContext(request, t);
    const role = partyOf(user, request, pkg);
    if (!role) fail('Richiesta di ritiro non trovata', 404);
    if (!slot || slot.id !== slotId) fail('La proposta non è più attiva', 409);

    const flag = `${role}Accepted`;
    const alreadyAccepted = slot[flag];
    if (!alreadyAccepted) {
      await slot.update({ [flag]: true }, { transaction: t });
    }

    if (slot.producerAccepted && slot.recipientAccepted && slot.transporterAccepted) {
      await confirmPickup(request, pkg, slot, user, t);
    } else if (!alreadyAccepted) {
      await notifyUsers(
        otherParties(role, request, pkg),
        'slot_accepted',
        { pickupRequestId: request.id, byRole: role },
        { transaction: t }
      );
    }
    return slot;
  });
}

// Confirmed only when producer, recipient and transporter all accepted the same slot.
async function confirmPickup(request, pkg, slot, actor, t) {
  await slot.update({ status: SL.AGREED }, { transaction: t });
  await pkg.update({ status: PK.CONFIRMED }, { transaction: t });
  await transition(request, S.CONFIRMED, {
    actorId: actor.id,
    note: 'all parties agreed',
    transaction: t,
    patch: { confirmedSlotAt: slot.scheduledAt, agreementDeadline: null },
  });

  const otherPackages = await PickupPackage.findAll({
    where: { pickupRequestId: request.id, id: { [Op.ne]: pkg.id }, status: PK.PROPOSED },
    transaction: t,
  });
  await PickupPackage.update(
    { status: PK.DISCARDED },
    { where: { id: { [Op.in]: otherPackages.map((p) => p.id) } }, transaction: t }
  );

  await Transaction.create(
    {
      pickupRequestId: request.id,
      packageId: pkg.id,
      platformFee: pkg.totalPrice * settings.platformFeeRatio,
      status: 'open',
    },
    { transaction: t }
  );

  await notifyUsers(
    [request.producerId, pkg.recipientId, pkg.transporterId],
    'pickup_confirmed',
    { pickupRequestId: request.id, scheduledAt: slot.scheduledAt.toISOString() },
    { transaction: t }
  );

  const stillInvolved = await collectInvitedUsers(request, t);
  const outsiders = stillInvolved.filter((id) => id !== pkg.recipientId && id !== pkg.transporterId);
  await notifyUsers(outsiders, 'pickup_closed', { pickupRequestId: request.id }, { transaction: t });
}

// Recipients still in play (pending/available) and transporters (invited/submitted).
async function collectInvitedUsers(request, t) {
  const [availabilities, proposals] = await Promise.all([
    RecipientAvailability.findAll({
      where: { pickupRequestId: request.id, status: { [Op.in]: [RR.PENDING, RR.AVAILABLE] } },
      transaction: t,
    }),
    TransportProposal.findAll({
      where: { pickupRequestId: request.id, status: { [Op.in]: [PS.INVITED, PS.SUBMITTED] } },
      transaction: t,
    }),
  ]);
  return [...availabilities.map((a) => a.recipientId), ...proposals.map((p) => p.transporterId)];
}

// ---------------------------------------------------------------------------
// Step 7: refusal / no answer -> back to the remaining packages
// ---------------------------------------------------------------------------

async function rejectPackage(user, requestId) {
  return withRequestLock(requestId, async (request, t) => {
    if (request.status !== S.IN_AGREEMENT) {
      const involved = await isInvolved(user, request, t);
      if (!involved) fail('Richiesta di ritiro non trovata', 404);
      fail(`Operazione non consentita nello stato "${request.status}"`, 409);
    }

    const { pkg } = await loadAgreementContext(request, t);
    const role = partyOf(user, request, pkg);
    if (role !== 'recipient' && role !== 'transporter') fail('Richiesta di ritiro non trovata', 404);

    await releaseFailedPackage(request, pkg, PK.REJECTED, `${role}_rejected`, user.id, t);
    return request;
  });
}

async function releaseFailedPackage(request, pkg, packageStatus, reason, actorId, t) {
  await pkg.update({ status: packageStatus, failureReason: reason }, { transaction: t });
  await SlotProposal.update(
    { status: SL.CLOSED },
    { where: { pickupRequestId: request.id, status: SL.ACTIVE }, transaction: t }
  );

  const remaining = await PickupPackage.count({
    where: { pickupRequestId: request.id, status: PK.PROPOSED },
    transaction: t,
  });
  if (remaining === 0) {
    return cancelRequest(request, 'no_packages_left', { actorId, transaction: t });
  }

  await transition(request, S.PACKAGES_READY, {
    actorId,
    note: reason,
    transaction: t,
    patch: { selectedPackageId: null, agreementDeadline: null },
  });

  const byRole = reason.split('_')[0];
  await notifyUsers(request.producerId, 'package_failed', { pickupRequestId: request.id, reason, byRole }, { transaction: t });
  const counterparts = [pkg.recipientId, pkg.transporterId].filter((id) => id !== actorId);
  await notifyUsers(counterparts, 'package_released', { pickupRequestId: request.id }, { transaction: t });
  return request;
}

// Producer goes back to the list on their own: the package stays selectable.
async function withdrawSelection(user, requestId) {
  return withRequestLock(requestId, async (request, t) => {
    assertProducer(request, user);
    assertStatus(request, S.IN_AGREEMENT);

    const { pkg } = await loadAgreementContext(request, t);
    await pkg.update({ status: PK.PROPOSED }, { transaction: t });
    await SlotProposal.update(
      { status: SL.CLOSED },
      { where: { pickupRequestId: request.id, status: SL.ACTIVE }, transaction: t }
    );
    await transition(request, S.PACKAGES_READY, {
      actorId: user.id,
      note: 'selection withdrawn',
      transaction: t,
      patch: { selectedPackageId: null, agreementDeadline: null },
    });
    await notifyUsers([pkg.recipientId, pkg.transporterId], 'package_released', { pickupRequestId: request.id }, { transaction: t });
    return request;
  });
}

// Parties that never answered within the deadline are treated as a refusal.
async function expireStaleAgreements(now = new Date()) {
  const stale = await PickupRequest.findAll({
    where: { status: S.IN_AGREEMENT, agreementDeadline: { [Op.lt]: now } },
    attributes: ['id'],
  });

  let handled = 0;
  for (const { id } of stale) {
    // eslint-disable-next-line no-await-in-loop
    await withRequestLock(id, async (request, t) => {
      if (request.status !== S.IN_AGREEMENT || !request.agreementDeadline || request.agreementDeadline >= now) return;

      const { pkg, slot } = await loadAgreementContext(request, t);
      let silent = null;
      if (slot) {
        if (!slot.recipientAccepted) silent = 'recipient';
        else if (!slot.transporterAccepted) silent = 'transporter';
      }

      if (silent) {
        await releaseFailedPackage(request, pkg, PK.EXPIRED, `${silent}_no_response`, null, t);
      } else {
        // The producer is the one who did not move: just give the package back.
        await pkg.update({ status: PK.PROPOSED }, { transaction: t });
        await SlotProposal.update(
          { status: SL.CLOSED },
          { where: { pickupRequestId: request.id, status: SL.ACTIVE }, transaction: t }
        );
        await transition(request, S.PACKAGES_READY, {
          actorId: null,
          note: 'producer_no_response',
          transaction: t,
          patch: { selectedPackageId: null, agreementDeadline: null },
        });
        await notifyUsers(request.producerId, 'package_failed', { pickupRequestId: request.id, reason: 'producer_no_response', byRole: 'producer' }, { transaction: t });
        await notifyUsers([pkg.recipientId, pkg.transporterId], 'package_released', { pickupRequestId: request.id }, { transaction: t });
      }
      handled += 1;
    });
  }
  return handled;
}

// ---------------------------------------------------------------------------
// Cancellation
// ---------------------------------------------------------------------------

async function cancelRequest(request, reason, { actorId = null, transaction: t } = {}) {
  const interested = await collectInvitedUsers(request, t);
  const packages = await PickupPackage.findAll({
    where: {
      pickupRequestId: request.id,
      status: { [Op.in]: [PK.PROPOSED, PK.SELECTED, PK.CONFIRMED] },
    },
    transaction: t,
  });

  await transition(request, S.CANCELLED, {
    actorId,
    note: reason,
    transaction: t,
    patch: { cancelReason: reason, selectedPackageId: null, agreementDeadline: null },
  });
  await PickupPackage.update(
    { status: PK.DISCARDED },
    { where: { id: { [Op.in]: packages.map((p) => p.id) } }, transaction: t }
  );
  await SlotProposal.update(
    { status: SL.CLOSED },
    { where: { pickupRequestId: request.id, status: SL.ACTIVE }, transaction: t }
  );

  const audience = [...interested, ...packages.flatMap((p) => [p.recipientId, p.transporterId])];
  if (actorId !== request.producerId) audience.push(request.producerId);
  await notifyUsers(
    audience.filter((id) => id !== actorId),
    'pickup_cancelled',
    { pickupRequestId: request.id, reason },
    { transaction: t }
  );
  return request;
}

async function cancelByProducer(user, requestId, reason) {
  return withRequestLock(requestId, async (request, t) => {
    assertProducer(request, user);
    if (request.status === S.CANCELLED) fail('La richiesta è già annullata', 409);
    return cancelRequest(request, reason ? `producer: ${String(reason).slice(0, 200)}` : 'producer_cancelled', {
      actorId: user.id,
      transaction: t,
    });
  });
}

module.exports = {
  WorkflowError,
  createDraft,
  updateDraft,
  publish,
  recipientRespond,
  closeRecipientPhase,
  transporterRespond,
  closeTransporterPhase,
  getVisiblePackages,
  selectPackage,
  withdrawSelection,
  proposeSlot,
  acceptSlot,
  rejectPackage,
  cancelByProducer,
  expireStaleAgreements,
};
