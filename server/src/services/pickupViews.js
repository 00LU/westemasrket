// Read models. Each role gets its own serializer so that no role can ever receive
// data that does not concern it (e.g. only the producer sees prices of other parties
// and the max price; recipients/transporters never see each other's offers).
const { Op } = require('sequelize');
const {
  PickupRequest,
  RecipientAvailability,
  TransportProposal,
  PickupPackage,
  SlotProposal,
  PickupStatusHistory,
  User,
} = require('../models');
const { REQUEST_STATUS: S, PACKAGE_STATUS: PK, SLOT_STATUS: SL, settings } = require('../config/pickupFlow');
const { WorkflowError } = require('./pickupStateMachine');

const notFound = () => new WorkflowError('Richiesta di ritiro non trovata', 404);

async function companyNames(ids) {
  const users = await User.findAll({ where: { id: { [Op.in]: [...new Set(ids.filter(Boolean))] } }, attributes: ['id', 'companyName'] });
  return new Map(users.map((u) => [u.id, u.companyName]));
}

function publicRequestFields(request, { withPhoto = false } = {}) {
  return {
    id: request.id,
    cerCode: request.cerCode,
    quantityTon: request.quantityTon,
    pickupAddress: request.pickupAddress,
    deadline: request.deadline,
    notes: request.notes,
    wasteDescription: request.wasteDescription,
    containment: request.containment,
    specialInfo: request.specialInfo,
    technicalDocuments: request.technicalDocuments,
    photoFileName: request.photoFileName,
    ...(withPhoto ? { photoData: request.photoData } : {}),
    status: request.status,
    created_at: request.created_at,
  };
}

// ---------------------------------------------------------------------------
// Agreement (selected package + day/time negotiation), tailored per role
// ---------------------------------------------------------------------------

async function buildAgreement(request, role) {
  if (![S.IN_AGREEMENT, S.CONFIRMED].includes(request.status) || !request.selectedPackageId) return null;

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
      canReject: inAgreement && role !== 'producer',
      canWithdraw: inAgreement && role === 'producer',
    },
  };
}

// ---------------------------------------------------------------------------
// Producer
// ---------------------------------------------------------------------------

async function producerList(userId) {
  const requests = await PickupRequest.findAll({
    where: { producerId: userId },
    attributes: { exclude: ['photoData'] },
    order: [['created_at', 'DESC']],
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
    attributes: { exclude: ['photoData'] },
    order: [['created_at', 'DESC']],
  });
}

function serializePackage(pkg, request, names, availabilityById, proposalById, revealIdentities = false) {
  const availability = availabilityById.get(pkg.recipientAvailabilityId);
  const proposal = proposalById.get(pkg.transportProposalId);
  return {
    id: pkg.id,
    rank: pkg.rank,
    score: pkg.score,
    status: pkg.status,
    failureReason: pkg.failureReason,
    treatmentPrice: pkg.treatmentPrice,
    transportPrice: pkg.transportPrice,
    totalPrice: pkg.totalPrice,
    overBudget: request.maxPrice > 0 && pkg.totalPrice > request.maxPrice,
    recipient: {
      ...(revealIdentities ? { companyName: names.get(pkg.recipientId) } : {}),
      pricePerTon: availability?.pricePerTon,
      pricingUnit: availability?.pricingUnit,
      unitPrice: availability?.unitPrice,
      destinationAddress: availability?.destinationAddress,
      availabilityWindow: availability?.availabilityWindow,
    },
    transporter: {
      ...(revealIdentities ? { companyName: names.get(pkg.transporterId) } : {}),
      vehicleType: proposal?.vehicleType,
      availabilityNote: proposal?.availabilityNote,
      pricingMode: proposal?.pricingMode,
      distanceKm: proposal?.distanceKm,
    },
  };
}

async function producerDetail(userId, requestId) {
  const request = await PickupRequest.findOne({ where: { id: requestId, producerId: userId } });
  if (!request) throw notFound();

  const [availabilities, proposals, packages, history] = await Promise.all([
    RecipientAvailability.findAll({ where: { pickupRequestId: request.id }, order: [['created_at', 'ASC']] }),
    TransportProposal.findAll({ where: { pickupRequestId: request.id }, order: [['created_at', 'ASC']] }),
    PickupPackage.findAll({ where: { pickupRequestId: request.id }, order: [['rank', 'ASC']] }),
    PickupStatusHistory.findAll({ where: { pickupRequestId: request.id }, order: [['created_at', 'ASC']] }),
  ]);
  const names = await companyNames([
    ...availabilities.map((a) => a.recipientId),
    ...proposals.map((p) => p.transporterId),
  ]);
  const availabilityById = new Map(availabilities.map((a) => [a.id, a]));
  const proposalById = new Map(proposals.map((p) => [p.id, p]));
  const proposed = packages.filter((pkg) => pkg.status === PK.PROPOSED);
  const failed = packages.filter((pkg) => [PK.REJECTED, PK.EXPIRED].includes(pkg.status));
  const current = packages.find((pkg) => [PK.SELECTED, PK.CONFIRMED].includes(pkg.status));
  const serialize = (pkg) => serializePackage(
    pkg,
    request,
    names,
    availabilityById,
    proposalById,
    [PK.SELECTED, PK.CONFIRMED].includes(pkg.status)
  );

  return {
    request: request.toJSON(),
    recipients: availabilities.map((a) => ({
      id: a.id,
      ...(current?.recipientId === a.recipientId ? { companyName: names.get(a.recipientId) } : {}),
      status: a.status,
      pricePerTon: a.pricePerTon,
      pricingUnit: a.pricingUnit,
      unitPrice: a.unitPrice,
      quantityTolerancePercent: a.quantityTolerancePercent,
      availabilityWindow: a.availabilityWindow,
      destinationAddress: a.destinationAddress,
      availableCapacityTon: a.availableCapacityTon,
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
    PickupRequest.findAll({ where: { id: { [Op.in]: ids } }, order: [['created_at', 'DESC']] }),
    PickupPackage.findAll({
      where: { pickupRequestId: { [Op.in]: ids }, recipientId: userId, status: { [Op.in]: [PK.SELECTED, PK.CONFIRMED] } },
    }),
  ]);
  const availabilityByRequest = new Map(availabilities.map((a) => [a.pickupRequestId, a]));

  return requests.map((request) => {
    const availability = availabilityByRequest.get(request.id);
    const myPackage = packages.find((pkg) => pkg.pickupRequestId === request.id);
    return {
      ...publicRequestFields(request),
      stage: recipientStage(request, availability, myPackage),
      myResponse: {
        status: availability.status,
        pricePerTon: availability.pricePerTon,
        pricingUnit: availability.pricingUnit,
        unitPrice: availability.unitPrice,
        quantityTolerancePercent: availability.quantityTolerancePercent,
        availabilityWindow: availability.availabilityWindow,
        destinationAddress: availability.destinationAddress,
        availableCapacityTon: availability.availableCapacityTon,
        notes: availability.notes,
        respondedAt: availability.respondedAt,
      },
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
    photoData: _request.photoData,
    agreement: _involved ? await buildAgreement(_request, 'recipient') : null,
  };
}

// ---------------------------------------------------------------------------
// Transporter
// ---------------------------------------------------------------------------

function transporterStage(request, proposal, myPackage) {
  if (request.status === S.CANCELLED) return 'cancelled';
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
  const [requests, packages] = await Promise.all([
    PickupRequest.findAll({ where: { id: { [Op.in]: ids } }, order: [['created_at', 'DESC']] }),
    PickupPackage.findAll({
      where: { pickupRequestId: { [Op.in]: ids }, transporterId: userId, status: { [Op.in]: [PK.SELECTED, PK.CONFIRMED] } },
    }),
  ]);
  const proposalByRequest = new Map(proposals.map((p) => [p.pickupRequestId, p]));

  return requests.map((request) => {
    const proposal = proposalByRequest.get(request.id);
    const myPackage = packages.find((pkg) => pkg.pickupRequestId === request.id);
    return {
      ...publicRequestFields(request),
      stage: transporterStage(request, proposal, myPackage),
      myProposal: {
        status: proposal.status,
        price: proposal.price,
        pricingMode: proposal.pricingMode,
        unitPrice: proposal.unitPrice,
        distanceKm: proposal.distanceKm,
        vehicleType: proposal.vehicleType,
        availabilityNote: proposal.availabilityNote,
        respondedAt: proposal.respondedAt,
      },
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
    photoData: _request.photoData,
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
