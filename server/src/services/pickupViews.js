// Read models. Each role gets its own serializer so that no role can ever receive
// data that does not concern it (recipients/transporters never see each other's offers).
const { Op } = require('sequelize');
const sequelize = require('../config/db');
const {
  PickupRequest,
  RecipientAvailability,
  TransportProposal,
  TransportProposalOffer,
  PickupPackage,
  SlotProposal,
  PickupStatusHistory,
  User,
  PickupPhoto,
} = require('../models');
const {
  REQUEST_STATUS: S,
  RECIPIENT_RESPONSE: RR,
  PROPOSAL_STATUS: PS,
  PACKAGE_STATUS: PK,
  SLOT_STATUS: SL,
  settings,
} = require('../config/pickupFlow');
const { WorkflowError } = require('./pickupStateMachine');
const { distanceUnavailableReason } = require('./roadDistanceService');

const notFound = () => new WorkflowError('Richiesta di ritiro non trovata', 404);

function requestListOrderFor(role, userId) {
  const qi = sequelize.getQueryInterface();
  const requestId = `${qi.quoteIdentifier(PickupRequest.name)}.${qi.quoteIdentifier('id')}`;
  const quoteTable = (table) => qi.queryGenerator.quoteTable(
    process.env.DB_SCHEMA ? { tableName: table, schema: process.env.DB_SCHEMA } : table
  );
  const user = sequelize.escape(userId);
  let rejectedByUser = 'FALSE';

  if (role === 'recipient') {
    rejectedByUser = `EXISTS (
      SELECT 1 FROM ${quoteTable('recipient_availabilities')} AS rejected_availability
      WHERE rejected_availability.pickup_request_id = ${requestId}
        AND rejected_availability.recipient_id = ${user}
        AND rejected_availability.status = 'unavailable'
    ) OR EXISTS (
      SELECT 1 FROM ${quoteTable('pickup_packages')} AS rejected_package
      WHERE rejected_package.pickup_request_id = ${requestId}
        AND rejected_package.recipient_id = ${user}
        AND rejected_package.status = 'rejected'
        AND rejected_package.failure_reason = 'recipient_rejected'
    )`;
  } else if (role === 'transporter') {
    rejectedByUser = `EXISTS (
      SELECT 1 FROM ${quoteTable('transport_proposals')} AS rejected_proposal
      WHERE rejected_proposal.pickup_request_id = ${requestId}
        AND rejected_proposal.transporter_id = ${user}
        AND rejected_proposal.status = 'declined'
    ) OR EXISTS (
      SELECT 1 FROM ${quoteTable('pickup_packages')} AS rejected_package
      WHERE rejected_package.pickup_request_id = ${requestId}
        AND rejected_package.transporter_id = ${user}
        AND rejected_package.status = 'rejected'
        AND rejected_package.failure_reason = 'transporter_rejected'
    )`;
  }

  return [
    [sequelize.literal(`CASE WHEN ${qi.quoteIdentifier(PickupRequest.name)}.status IN ('cancelled', 'completed') OR (${rejectedByUser}) THEN 1 ELSE 0 END`), 'ASC'],
    ['created_at', 'DESC'],
    ['id', 'DESC'],
  ];
}

async function companyNames(ids) {
  const users = await User.findAll({ where: { id: { [Op.in]: [...new Set(ids.filter(Boolean))] } }, attributes: ['id', 'companyName'] });
  return new Map(users.map((u) => [u.id, u.companyName]));
}

function publicRequestFields(request) {
  return {
    id: request.id,
    requestCode: request.requestCode,
    cerCode: request.cerCode,
    quantity: request.quantity,
    quantityUnit: request.quantityUnit,
    pickupAddress: request.pickupAddress,
    pickupLat: request.pickupLat,
    pickupLng: request.pickupLng,
    deadline: request.deadline,
    notes: request.notes,
    wasteDescription: request.wasteDescription,
    containment: request.containment,
    specialInfo: request.specialInfo,
    technicalDocuments: request.technicalDocuments,
    status: request.status,
    created_at: request.created_at,
  };
}

async function photosByRequest(requestIds) {
  const rows = await PickupPhoto.findAll({
    where: { pickupRequestId: { [Op.in]: requestIds } },
    attributes: ['id', 'pickupRequestId', 'fileName', 'mimeType'],
    order: [['created_at', 'ASC']],
  });
  const photos = new Map();
  rows.forEach((photo) => {
    const items = photos.get(photo.pickupRequestId) || [];
    items.push({
      id: photo.id,
      fileName: photo.fileName,
      mimeType: photo.mimeType,
      url: `/pickups/${photo.pickupRequestId}/photos/${photo.id}`,
    });
    photos.set(photo.pickupRequestId, items);
  });
  return photos;
}

function packagesByRequest(packages) {
  const grouped = new Map();
  packages.forEach((pkg) => {
    const items = grouped.get(pkg.pickupRequestId) || [];
    items.push(pkg);
    grouped.set(pkg.pickupRequestId, items);
  });
  return grouped;
}

// ---------------------------------------------------------------------------
// Agreement (selected package + day/time negotiation), tailored per role
// ---------------------------------------------------------------------------

async function buildAgreement(request, role) {
  if (![S.IN_AGREEMENT, S.CONFIRMED, S.COMPLETED].includes(request.status) || !request.selectedPackageId) return null;

  const pkg = await PickupPackage.findByPk(request.selectedPackageId);
  if (!pkg) return null;

  const [slots, availability, proposal, names] = await Promise.all([
    SlotProposal.findAll({ where: { pickupRequestId: request.id, packageId: pkg.id }, order: [['created_at', 'ASC']] }),
    RecipientAvailability.findByPk(pkg.recipientAvailabilityId),
    TransportProposal.findByPk(pkg.transportProposalId),
    companyNames([request.producerId, pkg.recipientId, pkg.transporterId]),
  ]);

  const active = slots.find((slot) => slot.status === SL.ACTIVE) || slots.find((slot) => slot.status === SL.AGREED) || null;
  const flag = `${role}Accepted`;
  const inAgreement = request.status === S.IN_AGREEMENT;
  const completion = {
    producer: Boolean(request.producerCompletionConfirmedAt),
    recipient: Boolean(request.recipientCompletionConfirmedAt),
    transporter: Boolean(request.transporterCompletionConfirmedAt),
  };

  const parties = { producer: { companyName: names.get(request.producerId) } };
  const pricing = {};
  if (role === 'producer') {
    parties.recipient = { companyName: names.get(pkg.recipientId), destinationAddress: availability?.destinationAddress };
    parties.transporter = { companyName: names.get(pkg.transporterId), vehicleType: proposal?.vehicleType };
    Object.assign(pricing, {
      treatmentPrice: pkg.treatmentPrice,
      transportPrice: pkg.transportPrice,
      totalPrice: pkg.totalPrice,
    });
  } else if (role === 'recipient') {
    parties.transporter = { companyName: names.get(pkg.transporterId) };
    Object.assign(pricing, { treatmentPrice: pkg.treatmentPrice, destinationAddress: availability?.destinationAddress });
  } else {
    parties.recipient = { companyName: names.get(pkg.recipientId), destinationAddress: availability?.destinationAddress };
    Object.assign(pricing, { transportPrice: pkg.transportPrice, vehicleType: proposal?.vehicleType });
  }

  return {
    packageId: pkg.id,
    parties,
    pricing,
    agreementDeadline: request.agreementDeadline,
    confirmedSlotAt: request.confirmedSlotAt,
    completedAt: request.completedAt,
    completion,
    activeSlot: active
      ? {
          id: active.id,
          scheduledAt: active.scheduledAt,
          proposedByRole: active.proposedByRole,
          status: active.status,
          accepted: {
            producer: active.producerAccepted,
            recipient: active.recipientAccepted,
            transporter: active.transporterAccepted,
          },
          acceptedByMe: Boolean(active[flag]),
        }
      : null,
    slotHistory: slots.map((slot) => ({
      id: slot.id,
      scheduledAt: slot.scheduledAt,
      proposedByRole: slot.proposedByRole,
      status: slot.status,
    })),
    actions: {
      canProposeSlot: inAgreement && (Boolean(active) || role === 'producer'),
      canAccept: inAgreement && Boolean(active) && active.status === SL.ACTIVE && !active[flag],
      canCancelOffer: inAgreement && role !== 'producer',
      canWithdraw: inAgreement && role === 'producer',
      canConfirmCompletion: request.status === S.CONFIRMED && !completion[role],
    },
  };
}

// ---------------------------------------------------------------------------
// Producer
// ---------------------------------------------------------------------------

async function producerList(userId) {
  const requests = await PickupRequest.findAll({
    where: { producerId: userId },
    order: requestListOrderFor('producer', userId),
  });
  if (requests.length === 0) return [];

  const ids = requests.map((r) => r.id);
  const [availabilities, proposals, packages, slots] = await Promise.all([
    RecipientAvailability.findAll({ where: { pickupRequestId: { [Op.in]: ids } }, attributes: ['pickupRequestId', 'status'] }),
    TransportProposal.findAll({ where: { pickupRequestId: { [Op.in]: ids } }, attributes: ['pickupRequestId', 'status'] }),
    PickupPackage.findAll({ where: { pickupRequestId: { [Op.in]: ids }, status: PK.PROPOSED }, attributes: ['pickupRequestId'] }),
    SlotProposal.findAll({
      where: { pickupRequestId: { [Op.in]: ids }, status: SL.ACTIVE },
      attributes: ['pickupRequestId', 'packageId', 'producerAccepted', 'recipientAccepted', 'transporterAccepted'],
    }),
  ]);

  const count = (rows, id, status) =>
    rows.filter((row) => row.pickupRequestId === id && (!status || row.status === status)).length;

  return requests.map((request) => {
    const slot = slots.find((item) => item.pickupRequestId === request.id && item.packageId === request.selectedPackageId);
    const pendingAgreementRoles = request.status === S.IN_AGREEMENT
      ? slot
        ? ['producer', 'recipient', 'transporter'].filter((role) => !slot[`${role}Accepted`])
        : ['producer']
      : [];
    const actionRequired = (request.status === S.DRAFT && request.cerKnown)
      || request.status === S.PACKAGES_READY
      || pendingAgreementRoles.includes('producer')
      || (request.status === S.CONFIRMED && !request.producerCompletionConfirmedAt)
      || (request.status === S.AWAITING_RECIPIENTS && count(availabilities, request.id, 'available') > 0)
      || (request.status === S.AWAITING_TRANSPORTERS && count(proposals, request.id, 'submitted') > 0);
    return {
      ...request.toJSON(),
      actionRequired,
      pendingAgreementRoles,
      counts: {
        recipientsInvited: count(availabilities, request.id),
        recipientsAvailable: count(availabilities, request.id, 'available'),
        recipientsPending: count(availabilities, request.id, 'pending'),
        transportersInvited: count(proposals, request.id),
        proposalsSubmitted: count(proposals, request.id, 'submitted'),
        packagesAvailable: count(packages, request.id),
      },
    };
  });
}

async function producerRecurring(userId) {
  return PickupRequest.findAll({
    where: { producerId: userId, recurring: true },
    order: [['created_at', 'DESC']],
  });
}

function serializePackage(pkg, request, names, availabilityById, proposalById, offerByPair, revealIdentities = false) {
  const availability = availabilityById.get(pkg.recipientAvailabilityId);
  const proposal = proposalById.get(pkg.transportProposalId);
  const offer = offerByPair.get(`${pkg.transportProposalId}:${pkg.recipientAvailabilityId}`);
  return {
    id: pkg.id,
    rank: pkg.rank,
    score: pkg.score,
    status: pkg.status,
    failureReason: pkg.failureReason,
    treatmentPrice: pkg.treatmentPrice,
    transportPrice: pkg.transportPrice,
    totalPrice: pkg.totalPrice,
    recipient: {
      ...(revealIdentities ? { companyName: names.get(pkg.recipientId) } : {}),
      unitPrice: availability?.unitPrice,
      quantityUnit: request.quantityUnit,
      destinationAddress: availability?.destinationAddress,
      availabilityWindow: availability?.availabilityWindow,
    },
    transporter: {
      ...(revealIdentities ? { companyName: names.get(pkg.transporterId) } : {}),
      vehicleType: proposal?.vehicleType,
      availabilityNote: proposal?.availabilityNote,
      pricingMode: offer?.pricingMode,
      unitPrice: offer?.unitPrice,
      distanceKm: offer?.distanceKm,
    },
  };
}

async function producerDetail(userId, requestId) {
  const request = await PickupRequest.findOne({ where: { id: requestId, producerId: userId } });
  if (!request) throw notFound();

  const [availabilities, proposals, packages, history, photos] = await Promise.all([
    RecipientAvailability.findAll({ where: { pickupRequestId: request.id }, order: [['created_at', 'ASC']] }),
    TransportProposal.findAll({ where: { pickupRequestId: request.id }, order: [['created_at', 'ASC']] }),
    PickupPackage.findAll({ where: { pickupRequestId: request.id }, order: [['rank', 'ASC']] }),
    PickupStatusHistory.findAll({ where: { pickupRequestId: request.id }, order: [['created_at', 'ASC']] }),
    photosByRequest([request.id]),
  ]);
  const offers = proposals.length
    ? await TransportProposalOffer.findAll({
        where: { transportProposalId: { [Op.in]: proposals.map((proposal) => proposal.id) } },
      })
    : [];
  const names = await companyNames([
    ...availabilities.map((a) => a.recipientId),
    ...proposals.map((p) => p.transporterId),
  ]);
  const availabilityById = new Map(availabilities.map((a) => [a.id, a]));
  const proposalById = new Map(proposals.map((p) => [p.id, p]));
  const offerByPair = new Map(offers.map((offer) => [
    `${offer.transportProposalId}:${offer.recipientAvailabilityId}`,
    offer,
  ]));
  const proposed = packages.filter((pkg) => pkg.status === PK.PROPOSED);
  const failed = packages.filter((pkg) => [PK.REJECTED, PK.EXPIRED].includes(pkg.status));
  const current = packages.find((pkg) => [PK.SELECTED, PK.CONFIRMED].includes(pkg.status));
  const serialize = (pkg) => serializePackage(
    pkg,
    request,
    names,
    availabilityById,
    proposalById,
    offerByPair,
    [PK.SELECTED, PK.CONFIRMED].includes(pkg.status)
  );

  return {
    request: { ...request.toJSON(), photos: photos.get(request.id) || [] },
    photos: photos.get(request.id) || [],
    recipients: availabilities.map((a) => ({
      id: a.id,
      ...(current?.recipientId === a.recipientId ? { companyName: names.get(a.recipientId) } : {}),
      status: a.status,
      unitPrice: a.unitPrice,
      quantityTolerancePercent: a.quantityTolerancePercent,
      availabilityWindow: a.availabilityWindow,
      destinationAddress: a.destinationAddress,
      destinationLat: a.destinationLat,
      destinationLng: a.destinationLng,
      destinationPlaceId: a.destinationPlaceId,
      roadDistanceMeters: a.roadDistanceMeters,
      notes: a.notes,
      respondedAt: a.respondedAt,
    })),
    proposals: proposals.map((p) => ({
      id: p.id,
      ...(current?.transporterId === p.transporterId ? { companyName: names.get(p.transporterId) } : {}),
      status: p.status,
      price: p.price,
      pricingMode: p.pricingMode,
      unitPrice: p.unitPrice,
      distanceKm: p.distanceKm,
      offers: offers.filter((offer) => offer.transportProposalId === p.id).map((offer) => ({
        recipientAvailabilityId: offer.recipientAvailabilityId,
        destinationAddress: availabilityById.get(offer.recipientAvailabilityId)?.destinationAddress,
        pricingMode: offer.pricingMode,
        unitPrice: offer.unitPrice,
        distanceKm: offer.distanceKm,
        price: offer.price,
      })),
      vehicleType: p.vehicleType,
      availabilityNote: p.availabilityNote,
      respondedAt: p.respondedAt,
    })),
    packages: proposed.slice(0, settings.packagesTopN).map(serialize),
    hiddenPackages: Math.max(0, proposed.length - settings.packagesTopN),
    failedPackages: failed.map(serialize),
    currentPackage: current ? serialize(current) : null,
    agreement: await buildAgreement(request, 'producer'),
    history: history.map((h) => ({ from: h.fromStatus, to: h.toStatus, note: h.note, at: h.created_at })),
  };
}

// ---------------------------------------------------------------------------
// Recipient
// ---------------------------------------------------------------------------

function recipientStage(request, availability, myPackage) {
  if (request.status === S.CANCELLED) return 'cancelled';
  if (request.status === S.COMPLETED) return myPackage?.status === PK.CONFIRMED ? 'completed' : 'closed';
  if (myPackage?.status === PK.CONFIRMED) return 'confirmed';
  if (myPackage?.status === PK.SELECTED) return 'in_agreement';
  if (request.status === S.CONFIRMED) return 'closed';
  if (request.status === S.AWAITING_RECIPIENTS) return availability.status === 'pending' ? 'to_respond' : 'responded';
  if (availability.status === 'unavailable' || availability.status === 'expired') return 'closed';
  return 'waiting';
}

async function loadRecipientItems(userId, requestIds) {
  const where = { recipientId: userId };
  if (requestIds) where.pickupRequestId = { [Op.in]: requestIds };
  const availabilities = await RecipientAvailability.findAll({ where });
  if (availabilities.length === 0) return [];

  const ids = availabilities.map((a) => a.pickupRequestId);
  const [requests, packages] = await Promise.all([
    PickupRequest.findAll({ where: { id: { [Op.in]: ids } }, order: requestListOrderFor('recipient', userId) }),
    PickupPackage.findAll({
      where: {
        pickupRequestId: { [Op.in]: ids },
        recipientId: userId,
        [Op.or]: [
          { status: { [Op.in]: [PK.SELECTED, PK.CONFIRMED] } },
          { status: PK.REJECTED, failureReason: 'recipient_rejected' },
        ],
      },
    }),
  ]);
  const photos = await photosByRequest(ids);
  const availabilityByRequest = new Map(availabilities.map((a) => [a.pickupRequestId, a]));
  const packagesByRequestId = packagesByRequest(packages);

  return requests.map((request) => {
    const availability = availabilityByRequest.get(request.id);
    const requestPackages = packagesByRequestId.get(request.id) || [];
    const myPackage = requestPackages.find((pkg) => [PK.SELECTED, PK.CONFIRMED].includes(pkg.status));
    const rejectedByMe = availability.status === 'unavailable'
      || requestPackages.some((pkg) => pkg.status === PK.REJECTED && pkg.failureReason === 'recipient_rejected');
    return {
      ...publicRequestFields(request),
      photos: photos.get(request.id) || [],
      stage: recipientStage(request, availability, myPackage),
      rejectedByMe,
      myResponse: {
        status: availability.status,
        unitPrice: availability.unitPrice,
        quantityTolerancePercent: availability.quantityTolerancePercent,
        availabilityWindow: availability.availabilityWindow,
        destinationAddress: availability.destinationAddress,
        destinationLat: availability.destinationLat,
        destinationLng: availability.destinationLng,
        destinationPlaceId: availability.destinationPlaceId,
        notes: availability.notes,
        respondedAt: availability.respondedAt,
      },
      canCancelOffer: availability.status === RR.AVAILABLE
        && [S.AWAITING_RECIPIENTS, S.AWAITING_TRANSPORTERS, S.PACKAGES_READY, S.IN_AGREEMENT].includes(request.status),
      canRespond: request.status === S.AWAITING_RECIPIENTS,
      scheduledAt: myPackage?.status === PK.CONFIRMED ? request.confirmedSlotAt : null,
      confirmedValue: myPackage?.status === PK.CONFIRMED ? myPackage.treatmentPrice : null,
      _involved: Boolean(myPackage),
      _request: request,
    };
  });
}

async function recipientList(userId) {
  const items = await loadRecipientItems(userId);
  return items.map(({ _request, _involved, ...item }) => item);
}

async function recipientDetail(userId, requestId) {
  const [item] = await loadRecipientItems(userId, [requestId]);
  if (!item) throw notFound();
  const { _request, _involved, ...rest } = item;
  return {
    ...rest,
    agreement: _involved ? await buildAgreement(_request, 'recipient') : null,
  };
}

// ---------------------------------------------------------------------------
// Transporter
// ---------------------------------------------------------------------------

function transporterStage(request, proposal, myPackage) {
  if (request.status === S.CANCELLED) return 'cancelled';
  if (request.status === S.COMPLETED) return myPackage?.status === PK.CONFIRMED ? 'completed' : 'closed';
  if (myPackage?.status === PK.CONFIRMED) return 'confirmed';
  if (myPackage?.status === PK.SELECTED) return 'in_agreement';
  if (request.status === S.CONFIRMED) return 'closed';
  if (request.status === S.AWAITING_TRANSPORTERS) return proposal.status === 'invited' ? 'to_respond' : 'responded';
  if (['declined', 'expired'].includes(proposal.status)) return 'closed';
  return 'waiting';
}

async function loadTransporterItems(userId, requestIds) {
  const where = { transporterId: userId };
  if (requestIds) where.pickupRequestId = { [Op.in]: requestIds };
  const proposals = await TransportProposal.findAll({ where });
  if (proposals.length === 0) return [];

  const ids = proposals.map((p) => p.pickupRequestId);
  const [requests, packages, availabilities, offers] = await Promise.all([
    PickupRequest.findAll({ where: { id: { [Op.in]: ids } }, order: requestListOrderFor('transporter', userId) }),
    PickupPackage.findAll({
      where: {
        pickupRequestId: { [Op.in]: ids },
        transporterId: userId,
        [Op.or]: [
          { status: { [Op.in]: [PK.SELECTED, PK.CONFIRMED] } },
          { status: PK.REJECTED, failureReason: 'transporter_rejected' },
        ],
      },
    }),
    RecipientAvailability.findAll({
      where: { pickupRequestId: { [Op.in]: ids }, status: RR.AVAILABLE },
    }),
    TransportProposalOffer.findAll({
      where: { transportProposalId: { [Op.in]: proposals.map((proposal) => proposal.id) } },
    }),
  ]);
  const photos = await photosByRequest(ids);
  const proposalByRequest = new Map(proposals.map((p) => [p.pickupRequestId, p]));
  const packagesByRequestId = packagesByRequest(packages);
  const availabilitiesByRequestId = packagesByRequest(availabilities);
  const availabilityById = new Map(availabilities.map((availability) => [availability.id, availability]));
  const offersByProposalId = new Map();
  offers.forEach((offer) => {
    const items = offersByProposalId.get(offer.transportProposalId) || [];
    items.push(offer);
    offersByProposalId.set(offer.transportProposalId, items);
  });

  return requests.map((request) => {
    const proposal = proposalByRequest.get(request.id);
    const requestPackages = packagesByRequestId.get(request.id) || [];
    const myPackage = requestPackages.find((pkg) => [PK.SELECTED, PK.CONFIRMED].includes(pkg.status));
    const rejectedByMe = proposal.status === 'declined'
      || requestPackages.some((pkg) => pkg.status === PK.REJECTED && pkg.failureReason === 'transporter_rejected');
    return {
      ...publicRequestFields(request),
      photos: photos.get(request.id) || [],
      destinations: (availabilitiesByRequestId.get(request.id) || []).map((availability) => ({
        id: availability.id,
        address: availability.destinationAddress,
        lat: availability.destinationLat,
        lng: availability.destinationLng,
        roadDistanceMeters: availability.roadDistanceMeters,
        roadDistanceUnavailableReason: distanceUnavailableReason(request, availability),
      })),
      stage: transporterStage(request, proposal, myPackage),
      rejectedByMe,
      myProposal: {
        status: proposal.status,
        price: proposal.price,
        pricingMode: proposal.pricingMode,
        unitPrice: proposal.unitPrice,
        distanceKm: proposal.distanceKm,
        offers: (offersByProposalId.get(proposal.id) || []).map((offer) => {
          const availability = availabilityById.get(offer.recipientAvailabilityId);
          return {
            recipientAvailabilityId: offer.recipientAvailabilityId,
            destinationAddress: availability?.destinationAddress,
            pricingMode: offer.pricingMode,
            unitPrice: offer.unitPrice,
            distanceKm: offer.distanceKm,
            price: offer.price,
          };
        }),
        vehicleType: proposal.vehicleType,
        availabilityNote: proposal.availabilityNote,
        respondedAt: proposal.respondedAt,
      },
      canCancelOffer: proposal.status === PS.SUBMITTED
        && [S.AWAITING_TRANSPORTERS, S.PACKAGES_READY, S.IN_AGREEMENT].includes(request.status),
      canRespond: request.status === S.AWAITING_TRANSPORTERS,
      scheduledAt: myPackage?.status === PK.CONFIRMED ? request.confirmedSlotAt : null,
      _involved: Boolean(myPackage),
      _request: request,
    };
  });
}

async function transporterList(userId) {
  const items = await loadTransporterItems(userId);
  return items.map(({ _request, _involved, ...item }) => item);
}

async function transporterDetail(userId, requestId) {
  const [item] = await loadTransporterItems(userId, [requestId]);
  if (!item) throw notFound();
  const { _request, _involved, ...rest } = item;
  return {
    ...rest,
    agreement: _involved ? await buildAgreement(_request, 'transporter') : null,
  };
}

async function transporterEarnings(userId) {
  const packages = await PickupPackage.findAll({ where: { transporterId: userId, status: PK.CONFIRMED } });
  const gross = packages.reduce((sum, pkg) => sum + Number(pkg.transportPrice || 0), 0);
  return { gross, jobs: packages.length, currency: 'EUR' };
}

module.exports = {
  producerList,
  producerDetail,
  producerRecurring,
  recipientList,
  recipientDetail,
  transporterList,
  transporterDetail,
  transporterEarnings,
};
