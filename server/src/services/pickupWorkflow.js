const { Op, UniqueConstraintError } = require('sequelize');
const sequelize = require('../config/db');
const {
  PickupRequest,
  RecipientAvailability,
  TransportProposal,
  TransportProposalOffer,
  PickupPackage,
  PickupPhoto,
  ProductionSite,
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
const { generateRequestCode, REQUEST_CODE_INDEX } = require('./requestCode');
const { cacheRoadDistances } = require('./roadDistanceService');

function fail(message, status = 400) {
  throw new WorkflowError(message, status);
}

async function createRequestWithCode(values) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      return await PickupRequest.create({ ...values, requestCode: generateRequestCode() });
    } catch (error) {
      const isCodeCollision = error instanceof UniqueConstraintError
        && (error.original?.constraint === REQUEST_CODE_INDEX
          || Object.hasOwn(error.fields || {}, 'request_code')
          || Object.hasOwn(error.fields || {}, 'requestCode'));
      if (!isCodeCollision || attempt === 4) throw error;
    }
  }
  throw new Error('Impossibile generare un codice univoco per la richiesta');
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

function validateIdempotencyKey(value, required = false) {
  if (!value) {
    if (required) fail('Chiave idempotente obbligatoria', 400);
    return null;
  }
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
    fail('Chiave idempotente non valida', 400);
  }
  return value;
}

const TEXT_FIELDS = [
  'wasteDescription',
  'technicalDocuments',
  'containment',
  'specialInfo',
  'notes',
  'recurrenceFrequency',
];

function optionalDate(value, label) {
  if (value === undefined || value === null || value === '') return null;
  if (Number.isNaN(new Date(value).getTime())) fail(`${label} non valida`);
  return value;
}

function validateRequestInput(data, { partial = false } = {}) {
  const out = {};
  const has = (key) => data[key] !== undefined;

  if (has('cerKnown')) out.cerKnown = data.cerKnown !== false;
  if (out.cerKnown === false) {
    // Unknown CER: the admin proposes one before the request can be published.
    out.cerCode = 'UNKNOWN';
    out.cerRequestNote = data.cerRequestNote || 'Il produttore richiede una proposta CER all\'intermediario';
  } else if (!partial || has('cerCode')) {
    if (!String(data.cerCode || '').trim()) fail('Codice CER obbligatorio');
    out.cerCode = String(data.cerCode).trim();
    if (out.cerKnown) out.cerRequestNote = null;
  }
  if (!partial || has('quantity')) {
    const quantity = toNumber(data.quantity);
    if (!(quantity > 0)) fail('La quantità deve essere maggiore di zero');
    out.quantity = quantity;
  }
  if (!partial || has('quantityUnit')) {
    if (!['kg', 'liter'].includes(data.quantityUnit)) fail('Seleziona kg o litri come unità di misura');
    out.quantityUnit = data.quantityUnit;
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
  ['pickupLat', 'pickupLng', 'pickupPlaceId', 'productionSiteId'].forEach((field) => {
    if (has(field)) out[field] = data[field] || null;
  });
  TEXT_FIELDS.forEach((field) => {
    if (has(field)) out[field] = data[field] ? String(data[field]) : null;
  });
  if (has('recurring')) out.recurring = Boolean(data.recurring);
  if (has('recurrenceStartDate')) out.recurrenceStartDate = optionalDate(data.recurrenceStartDate, 'Data di inizio ricorrenza');
  if (has('recurrenceEndDate')) out.recurrenceEndDate = optionalDate(data.recurrenceEndDate, 'Data di fine ricorrenza');
  return out;
}

// ---------------------------------------------------------------------------
// Step 1-2: producer creates & publishes, recipients are invited
// ---------------------------------------------------------------------------

async function createDraft(user, data) {
  const idempotencyKey = validateIdempotencyKey(data.idempotencyKey);
  if (idempotencyKey) {
    const existing = await PickupRequest.findOne({ where: { producerId: user.id, idempotencyKey } });
    if (existing) return existing;
  }
  await assertOwnedProductionSite(user.id, data.productionSiteId);
  const values = {
    ...validateRequestInput(data),
    producerId: user.id,
    status: S.DRAFT,
    idempotencyKey,
  };
  if (!idempotencyKey) return createRequestWithCode(values);

  const [request] = await PickupRequest.findOrCreate({
    where: { producerId: user.id, idempotencyKey },
    defaults: values,
  });
  return request;
}

async function assertOwnedProductionSite(userId, siteId, transaction) {
  if (!siteId) return;
  const site = await ProductionSite.findOne({ where: { id: siteId, userId }, attributes: ['id'], transaction });
  if (!site) fail('La sede produttiva selezionata non è valida', 400);
}

// A recurring order is reused as a template; it is published after its photos upload.
async function repeatRecurring(user, requestId, body) {
  const idempotencyKey = validateIdempotencyKey(body.idempotencyKey, true);
  const existing = await PickupRequest.findOne({ where: { producerId: user.id, idempotencyKey } });
  if (existing) return existing;
  const original = await PickupRequest.findOne({ where: { id: requestId, producerId: user.id, recurring: true } });
  if (!original) fail('Ordine ricorrente non trovato', 404);
  if (!body.confirmStableData) fail('Conferma che processo e caratteristiche del rifiuto siano invariati');
  if (!(Number(body.quantity) > 0) || !body.deadline) {
    fail('Quantità e tempistiche sono obbligatorie per ripetere un ordine');
  }

  const [request] = await PickupRequest.findOrCreate({
    where: { producerId: user.id, idempotencyKey },
    defaults: {
    ...validateRequestInput({
      quantity: body.quantity,
      quantityUnit: original.quantityUnit,
      deadline: body.deadline,
      pickupAddress: original.pickupAddress,
      pickupLat: original.pickupLat,
      pickupLng: original.pickupLng,
      pickupPlaceId: original.pickupPlaceId,
      productionSiteId: original.productionSiteId,
    }, { partial: true }),
    producerId: user.id,
    status: S.DRAFT,
    idempotencyKey,
    cerCode: original.cerCode,
    cerKnown: original.cerKnown,
    cerRequestNote: original.cerRequestNote,
    wasteDescription: original.wasteDescription,
    technicalDocuments: original.technicalDocuments,
    containment: original.containment,
    specialInfo: original.specialInfo,
    notes: original.notes,
    recurring: false,
    },
  });
  return request;
}

async function updateDraft(user, requestId, data) {
  return withRequestLock(requestId, async (request, t) => {
    assertProducer(request, user);
    const idempotencyKey = data.idempotencyKey;
    if (request.status !== S.DRAFT) {
      validateIdempotencyKey(idempotencyKey, true);
      const existing = await PickupRequest.findOne({
        where: { producerId: user.id, idempotencyKey },
        transaction: t,
      });
      if (existing) return existing;
      if (request.supersededById) fail('La richiesta è già stata sostituita da una nuova versione', 409);
    }
    await assertOwnedProductionSite(user.id, data.productionSiteId, t);
    const values = validateRequestInput(data, { partial: true });
    if (request.status === S.DRAFT) {
      await request.update(values, { transaction: t });
      return request;
    }

    const sourceValues = { ...request.get({ plain: true }) };
    [
      'id', 'requestCode', 'created_at', 'updated_at', 'status', 'selectedPackageId',
      'agreementDeadline', 'confirmedSlotAt', 'cancelReason', 'idempotencyKey',
      'supersedesId', 'supersededById',
    ].forEach((field) => delete sourceValues[field]);
    const [revision] = await PickupRequest.findOrCreate({
      where: { producerId: user.id, idempotencyKey },
      defaults: {
        ...sourceValues,
        ...values,
        producerId: user.id,
        status: S.DRAFT,
        idempotencyKey,
        supersedesId: request.id,
        supersededById: null,
        selectedPackageId: null,
        agreementDeadline: null,
        confirmedSlotAt: null,
        cancelReason: null,
      },
      transaction: t,
    });
    const photos = await PickupPhoto.findAll({ where: { pickupRequestId: request.id }, transaction: t });
    if (photos.length > 0) {
      await PickupPhoto.bulkCreate(photos.map((photo) => ({
        pickupRequestId: revision.id,
        storageKey: photo.storageKey,
        fileName: photo.fileName,
        mimeType: photo.mimeType,
      })), { transaction: t });
    }

    if (request.status !== S.CANCELLED) {
      const interested = await collectInvitedUsers(request, t);
      const packages = await PickupPackage.findAll({
        where: {
          pickupRequestId: request.id,
          status: { [Op.in]: [PK.PROPOSED, PK.SELECTED, PK.CONFIRMED] },
        },
        attributes: ['recipientId', 'transporterId'],
        transaction: t,
      });
      await transition(request, S.CANCELLED, {
        actorId: user.id,
        note: 'request_edited',
        transaction: t,
        patch: { cancelReason: 'request_edited', supersededById: revision.id },
      });
      await notifyUsers(
        [...interested, ...packages.flatMap((pkg) => [pkg.recipientId, pkg.transporterId])]
          .filter((id) => id !== user.id),
        'pickup_cancelled',
        { pickupRequestId: request.id, reason: 'request_edited', supersededById: revision.id },
        { transaction: t }
      );
    } else {
      await request.update({ supersededById: revision.id }, { transaction: t });
    }
    return revision;
  });
}

async function publish(user, requestId) {
  return withRequestLock(requestId, async (request, t) => {
    assertProducer(request, user);
    assertStatus(request, S.DRAFT);

    if (!request.cerKnown) fail('Il codice CER deve essere proposto dall\'amministratore prima della pubblicazione', 409);
    if (new Date(request.deadline) <= new Date()) fail('La scadenza deve essere nel futuro');
    if (await PickupPhoto.count({ where: { pickupRequestId: request.id }, transaction: t }) === 0) {
      fail('Carica almeno una foto del rifiuto prima di pubblicare', 409);
    }

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
      const unitPrice = toNumber(body.unitPrice);
      if (!(unitPrice >= 0)) fail('Prezzo non valido');
      if (!String(body.destinationAddress || '').trim()) fail('Indirizzo di destinazione obbligatorio');
      if (body.quantityUnit !== undefined && body.quantityUnit !== request.quantityUnit) {
        fail(`Questa richiesta richiede una tariffa in ${request.quantityUnit === 'kg' ? 'kg' : 'litri'}`);
      }
      const tolerance = body.quantityTolerancePercent === undefined || body.quantityTolerancePercent === ''
        ? null
        : toNumber(body.quantityTolerancePercent);
      if (tolerance !== null && !(tolerance >= 0)) fail('Tolleranza sulla quantità non valida');

      await availability.update(
        {
          status: RR.AVAILABLE,
          unitPrice,
          destinationAddress: String(body.destinationAddress).trim(),
          destinationLat: body.destinationLat ?? null,
          destinationLng: body.destinationLng ?? null,
          destinationPlaceId: body.destinationPlaceId || null,
          quantityTolerancePercent: tolerance,
          availabilityWindow: body.availabilityWindow || null,
          notes: body.notes || null,
          respondedAt: new Date(),
        },
        { transaction: t }
      );
    } else if (body.available === false) {
      await availability.update(
        {
          status: RR.UNAVAILABLE,
          unitPrice: null,
          destinationAddress: null,
          destinationLat: null,
          destinationLng: null,
          destinationPlaceId: null,
          notes: body.notes || null,
          respondedAt: new Date(),
        },
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
  const availabilities = await RecipientAvailability.findAll({
    where: { pickupRequestId: request.id, status: RR.AVAILABLE },
    transaction: t,
  });
  if (availabilities.length === 0) {
    return cancelRequest(request, 'no_recipient_available', { actorId, transaction: t });
  }

  await cacheRoadDistances(request, availabilities, { transaction: t });

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
      await TransportProposalOffer.destroy({ where: { transportProposalId: proposal.id }, transaction: t });
      await proposal.update({ status: PS.DECLINED, price: null, respondedAt: new Date() }, { transaction: t });
    } else {
      const availabilities = await RecipientAvailability.findAll({
        where: { pickupRequestId: request.id, status: RR.AVAILABLE },
        transaction: t,
      });
      if (availabilities.length === 0) fail('Nessuna sede destinataria disponibile per questa proposta', 409);

      const requestedOffers = Array.isArray(body.offers)
        ? body.offers
        : availabilities.map((availability) => ({
            recipientAvailabilityId: availability.id,
            pricingMode: body.pricingMode || 'fixed_trip',
            unitPrice: body.unitPrice ?? body.price,
          }));
      if (requestedOffers.length !== availabilities.length) {
        fail('Invia una sola offerta per ogni sede destinataria disponibile');
      }

      const availabilityById = new Map(availabilities.map((availability) => [availability.id, availability]));
      const seenAvailabilityIds = new Set();
      const offers = requestedOffers.map((input) => {
        const availability = availabilityById.get(input.recipientAvailabilityId);
        if (!availability || seenAvailabilityIds.has(input.recipientAvailabilityId)) {
          fail('Una sede destinataria è mancante o ripetuta nella proposta');
        }
        seenAvailabilityIds.add(input.recipientAvailabilityId);

        const pricingMode = input.pricingMode || 'fixed_trip';
        if (!['fixed_trip', 'per_km'].includes(pricingMode)) fail('Modalità di prezzo non valida');
        const unitPrice = toNumber(input.unitPrice);
        if (!(unitPrice > 0)) fail('Il prezzo del trasporto deve essere maggiore di zero');

        const distanceKm = availability.roadDistanceMeters == null
          ? null
          : availability.roadDistanceMeters / 1000;
        if (pricingMode === 'per_km' && !(distanceKm > 0)) {
          fail('Tariffa €/km non disponibile: manca la distanza stradale calcolata per questa sede', 409);
        }

        return {
          transportProposalId: proposal.id,
          recipientAvailabilityId: availability.id,
          pricingMode,
          unitPrice,
          distanceKm,
          price: pricingMode === 'per_km' ? unitPrice * distanceKm : unitPrice,
        };
      });
      const firstOffer = offers[0];
      const lowestPrice = Math.min(...offers.map((offer) => offer.price));
      await TransportProposalOffer.destroy({ where: { transportProposalId: proposal.id }, transaction: t });
      await proposal.update(
        {
          status: PS.SUBMITTED,
          price: lowestPrice,
          pricingMode: offers.length === 1 ? firstOffer.pricingMode : 'per_destination',
          unitPrice: offers.length === 1 ? firstOffer.unitPrice : null,
          distanceKm: offers.length === 1 ? firstOffer.distanceKm : null,
          vehicleType: body.vehicleType || null,
          availabilityNote: body.availabilityNote || null,
          respondedAt: new Date(),
        },
        { transaction: t }
      );
      await TransportProposalOffer.bulkCreate(offers, { transaction: t });
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

  const offers = await TransportProposalOffer.findAll({
    where: {
      transportProposalId: { [Op.in]: proposals.map((proposal) => proposal.id) },
      recipientAvailabilityId: { [Op.in]: availabilities.map((availability) => availability.id) },
    },
    transaction: t,
  });
  const offerByPair = new Map(offers.map((offer) => [
    `${offer.transportProposalId}:${offer.recipientAvailabilityId}`,
    offer,
  ]));

  await TransportProposal.update(
    { status: PS.EXPIRED },
    { where: { pickupRequestId: request.id, status: PS.INVITED }, transaction: t }
  );

  const candidates = [];
  availabilities.forEach((availability) => {
    proposals.forEach((proposal) => {
      const offer = offerByPair.get(`${proposal.id}:${availability.id}`);
      if (!offer) return;
      const treatmentPrice = availability.unitPrice * request.quantity;
      candidates.push({
        availabilityId: availability.id,
        proposalId: proposal.id,
        offerId: offer.id,
        recipientId: availability.recipientId,
        transporterId: proposal.transporterId,
        treatmentPrice,
        transportPrice: offer.price,
        totalPrice: treatmentPrice + offer.price,
      });
    });
  });

  if (candidates.length === 0) {
    return cancelRequest(request, 'no_transport_proposals', { actorId, transaction: t });
  }

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
    const competingPackages = await PickupPackage.findAll({
      where: {
        pickupRequestId: request.id,
        id: { [Op.ne]: pkg.id },
        status: PK.PROPOSED,
      },
      attributes: ['recipientId', 'transporterId'],
      transaction: t,
    });
    const selectedParties = new Set([pkg.recipientId, pkg.transporterId]);
    const competingUsers = [...new Set(competingPackages.flatMap((candidate) =>
      [candidate.recipientId, candidate.transporterId]
    ))].filter((id) => !selectedParties.has(id));
    await notifyUsers(competingUsers, 'package_not_selected', { pickupRequestId: request.id }, { transaction: t });
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

async function confirmWorkCompletion(user, requestId) {
  return withRequestLock(requestId, async (request, t) => {
    if (![S.CONFIRMED, S.COMPLETED].includes(request.status)) {
      const involved = request.producerId === user.id || await isInvolved(user, request, t);
      if (!involved) fail('Richiesta di ritiro non trovata', 404);
      fail(`Operazione non consentita nello stato "${request.status}"`, 409);
    }

    const pkg = await PickupPackage.findByPk(request.selectedPackageId, { transaction: t });
    if (!pkg) fail('Pacchetto confermato non trovato', 409);
    const role = partyOf(user, request, pkg);
    if (!role) fail('Richiesta di ritiro non trovata', 404);
    if (request.status === S.COMPLETED) return request;

    const confirmationField = `${role}CompletionConfirmedAt`;
    if (request[confirmationField]) return request;
    await request.update({ [confirmationField]: new Date() }, { transaction: t });

    const completionFields = [
      'producerCompletionConfirmedAt',
      'recipientCompletionConfirmedAt',
      'transporterCompletionConfirmedAt',
    ];
    if (completionFields.every((field) => request[field])) {
      await transition(request, S.COMPLETED, {
        actorId: user.id,
        note: 'all_parties_confirmed_completion',
        transaction: t,
        patch: { completedAt: new Date() },
      });
      await notifyUsers(
        [request.producerId, pkg.recipientId, pkg.transporterId],
        'pickup_completed',
        { pickupRequestId: request.id },
        { transaction: t }
      );
      return request;
    }

    await notifyUsers(
      otherParties(role, request, pkg),
      'pickup_completion_confirmed',
      { pickupRequestId: request.id, byRole: role },
      { transaction: t }
    );
    return request;
  });
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
// Step 7: offer withdrawal / no answer -> continue with the remaining packages
// ---------------------------------------------------------------------------

async function cancelOffer(user, requestId) {
  return withRequestLock(requestId, async (request, t) => {
    if (!['recipient', 'transporter'].includes(user.role)) fail('Richiesta di ritiro non trovata', 404);
    if (![S.AWAITING_RECIPIENTS, S.AWAITING_TRANSPORTERS, S.PACKAGES_READY, S.IN_AGREEMENT].includes(request.status)) {
      const involved = request.producerId === user.id || await isInvolved(user, request, t);
      if (!involved) fail('Richiesta di ritiro non trovata', 404);
      fail(`Non puoi annullare un’offerta nello stato "${request.status}"`, 409);
    }

    let agreementExpired = false;
    if (request.status === S.IN_AGREEMENT
      && request.agreementDeadline
      && request.agreementDeadline <= new Date()) {
      agreementExpired = await expireAgreement(request, t, new Date());
    }
    if (![S.AWAITING_RECIPIENTS, S.AWAITING_TRANSPORTERS, S.PACKAGES_READY, S.IN_AGREEMENT].includes(request.status)) {
      return request;
    }

    const role = user.role;
    const activeAvailability = role === 'recipient'
      ? await RecipientAvailability.findOne({
          where: { pickupRequestId: request.id, recipientId: user.id },
          transaction: t,
        })
      : null;
    const activeProposal = role === 'transporter'
      ? await TransportProposal.findOne({
          where: { pickupRequestId: request.id, transporterId: user.id },
          transaction: t,
        })
      : null;

    if (role === 'recipient' && !activeAvailability) fail('Richiesta di ritiro non trovata', 404);
    if (role === 'transporter' && !activeProposal) fail('Richiesta di ritiro non trovata', 404);
    const offerIsActive = role === 'recipient'
      ? activeAvailability?.status === RR.AVAILABLE
      : activeProposal?.status === PS.SUBMITTED;
    if (!offerIsActive) {
      if (agreementExpired) return request;
      fail('Non hai un’offerta attiva da annullare', 409);
    }

    if (request.status === S.AWAITING_RECIPIENTS && role === 'recipient') {
      await activeAvailability.update({ status: RR.UNAVAILABLE }, { transaction: t });
      await notifyRemainingAuctionParticipants(request, [user.id], t);
      const pending = await RecipientAvailability.count({
        where: { pickupRequestId: request.id, status: RR.PENDING },
        transaction: t,
      });
      if (pending === 0) {
        await openTransporterPhase(request, t, { actorId: user.id, note: 'recipient offer cancelled' });
      }
      return request;
    }

    if (request.status === S.AWAITING_TRANSPORTERS && role === 'transporter') {
      await activeProposal.update(
        { status: PS.DECLINED, price: null, respondedAt: new Date() },
        { transaction: t }
      );
      await notifyRemainingAuctionParticipants(request, [user.id], t);
      const invited = await TransportProposal.count({
        where: { pickupRequestId: request.id, status: PS.INVITED },
        transaction: t,
      });
      if (invited === 0) {
        await buildPackages(request, t, { actorId: user.id, note: 'transporter offer cancelled' });
      }
      return request;
    }

    await releaseFailedPackage(
      request,
      null,
      PK.REJECTED,
      `${role}_cancelled`,
      user.id,
      t
    );
    return request;
  });
}

async function releaseFailedPackage(request, pkg, packageStatus, reason, actorId, t) {
  const role = reason.startsWith('recipient_') ? 'recipient' : 'transporter';
  const activeStatuses = [PK.PROPOSED, PK.SELECTED];
  const participantWhere = role === 'recipient'
    ? { recipientId: pkg?.recipientId }
    : { transporterId: pkg?.transporterId };
  if (!pkg && actorId) {
    if (role === 'recipient') participantWhere.recipientId = actorId;
    else participantWhere.transporterId = actorId;
  }
  const participantPackages = await PickupPackage.findAll({
    where: {
      pickupRequestId: request.id,
      status: { [Op.in]: activeStatuses },
      ...participantWhere,
    },
    transaction: t,
  });
  if (participantPackages.length === 0 && !pkg) {
    fail('Non hai offerte attive da annullare', 409);
  }

  const participantId = actorId || (pkg && (role === 'recipient' ? pkg.recipientId : pkg.transporterId));

  if (role === 'recipient' && participantId) {
    await RecipientAvailability.update(
      { status: RR.UNAVAILABLE },
      { where: { pickupRequestId: request.id, recipientId: participantId, status: RR.AVAILABLE }, transaction: t }
    );
  } else if (role === 'transporter' && participantId) {
    await TransportProposal.update(
      { status: PS.DECLINED },
      { where: { pickupRequestId: request.id, transporterId: participantId, status: PS.SUBMITTED }, transaction: t }
    );
  }
  if (request.status === S.IN_AGREEMENT && request.selectedPackageId) {
    const selectedPackage = await PickupPackage.findByPk(request.selectedPackageId, { transaction: t });
    if (selectedPackage && !participantPackages.some((candidate) => candidate.id === selectedPackage.id)) {
      await selectedPackage.update({ status: PK.PROPOSED }, { transaction: t });
    }
  }
  await PickupPackage.update(
    { status: packageStatus, failureReason: reason },
    {
      where: {
        pickupRequestId: request.id,
        status: { [Op.in]: activeStatuses },
        ...participantWhere,
      },
      transaction: t,
    }
  );
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

  if (request.status === S.IN_AGREEMENT) {
    await transition(request, S.PACKAGES_READY, {
      actorId,
      note: reason,
      transaction: t,
      patch: { selectedPackageId: null, agreementDeadline: null },
    });
  }
  await rerankProposedPackages(request.id, t);

  const byRole = reason.split('_')[0];
  await notifyUsers(request.producerId, 'package_failed', { pickupRequestId: request.id, reason, byRole }, { transaction: t });
  const affectedParties = new Set(participantPackages.flatMap((candidate) =>
    [candidate.recipientId, candidate.transporterId]
  ));
  const counterparts = [...affectedParties].filter((id) => id !== actorId);
  await notifyUsers(
    counterparts,
    reason.endsWith('_no_response') ? 'package_not_selected' : 'package_released',
    { pickupRequestId: request.id },
    { transaction: t }
  );
  await notifyRemainingAuctionParticipants(
    request,
    [actorId, ...counterparts],
    t,
    { includeProducer: false, type: 'auction_reopened' }
  );
  return request;
}

async function rerankProposedPackages(requestId, t) {
  const packages = await PickupPackage.findAll({
    where: { pickupRequestId: requestId, status: PK.PROPOSED },
    order: [['score', 'ASC'], ['transportPrice', 'ASC'], ['treatmentPrice', 'ASC'], ['id', 'ASC']],
    transaction: t,
  });
  for (const [index, pkg] of packages.entries()) {
    if (pkg.rank !== index + 1) {
      await pkg.update({ rank: index + 1 }, { transaction: t });
    }
  }
}

async function notifyRemainingAuctionParticipants(
  request,
  excludeIds,
  t,
  { includeProducer = true, type = 'offer_cancelled' } = {}
) {
  const [availabilities, proposals] = await Promise.all([
    RecipientAvailability.findAll({
      where: { pickupRequestId: request.id, status: RR.AVAILABLE },
      attributes: ['recipientId'],
      transaction: t,
    }),
    TransportProposal.findAll({
      where: { pickupRequestId: request.id, status: PS.SUBMITTED },
      attributes: ['transporterId'],
      transaction: t,
    }),
  ]);
  const excluded = new Set(excludeIds);
  const recipients = availabilities.map((availability) => availability.recipientId);
  const transporters = proposals.map((proposal) => proposal.transporterId);
  const users = [...recipients, ...transporters];
  if (includeProducer) users.push(request.producerId);
  await notifyUsers(
    users.filter((id) => !excluded.has(id)),
    type,
    { pickupRequestId: request.id },
    { transaction: t }
  );
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
async function expireAgreement(request, t, now) {
  if (request.status !== S.IN_AGREEMENT || !request.agreementDeadline || request.agreementDeadline >= now) return false;

  const { pkg, slot } = await loadAgreementContext(request, t);
  let silent = null;
  if (slot) {
    if (!slot.recipientAccepted) silent = 'recipient';
    else if (!slot.transporterAccepted) silent = 'transporter';
  }

  if (silent) {
    await releaseFailedPackage(request, pkg, PK.EXPIRED, `${silent}_no_response`, null, t);
  } else {
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
  return true;
}

async function expireStaleAgreements(now = new Date()) {
  const stale = await PickupRequest.findAll({
    where: { status: S.IN_AGREEMENT, agreementDeadline: { [Op.lt]: now } },
    attributes: ['id'],
  });

  let handled = 0;
  for (const { id } of stale) {
    // eslint-disable-next-line no-await-in-loop
    await withRequestLock(id, async (request, t) => {
      if (await expireAgreement(request, t, now)) handled += 1;
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
    if (request.status === S.COMPLETED) fail('Un ritiro completato non può essere annullato', 409);
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
  repeatRecurring,
  recipientRespond,
  closeRecipientPhase,
  transporterRespond,
  closeTransporterPhase,
  getVisiblePackages,
  selectPackage,
  withdrawSelection,
  proposeSlot,
  acceptSlot,
  cancelOffer,
  confirmWorkCompletion,
  cancelByProducer,
  expireStaleAgreements,
};
