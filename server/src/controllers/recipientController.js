const { Op } = require('sequelize');
const { RecipientOffer, WasteRequest } = require('../models');
const { matchOperators } = require('../services/matchingEngine');
const { notifyUser } = require('../services/notificationService');

const RECIPIENT_OFFERABLE_STATUSES = ['recipient_matching', 'recipient_options_ready'];

const STATUS_TRANSITIONS = {
  assigned: ['in_execution', 'cancelled'],
  in_execution: ['delivered', 'cancelled'],
  delivered: ['completed'],
};

async function getNotificationsFeed(req, res, next) {
  try {
    const requests = await WasteRequest.findAll({
      where: {
        [Op.or]: [
          { status: { [Op.in]: RECIPIENT_OFFERABLE_STATUSES } },
          { status: 'recipient_selected', selectedRecipientId: req.user.id },
        ],
      },
      attributes: ['id', 'cerCode', 'quantityTon', 'pickupAddress', 'deadline', 'status', 'workflowStatus', 'transporterConfirmed', 'recipientConfirmed', 'selectedRecipientId', 'created_at'],
      order: [['created_at', 'DESC']],
    });

    const existingOffers = await RecipientOffer.findAll({
      where: {
        recipientId: req.user.id,
        wasteRequestId: { [Op.in]: requests.map((item) => item.id) },
      },
      attributes: ['wasteRequestId', 'pricePerTon', 'pricingUnit', 'availableCapacityTon', 'quantityTolerancePercent', 'availabilityWindow', 'availabilityStatus', 'destinationAddress'],
    });

    const offersByRequestId = new Map(existingOffers.map((offer) => [offer.wasteRequestId, offer]));

    return res.json(
      requests.map((request) => ({
        id: request.id,
        cerCode: request.cerCode,
        quantityTon: request.quantityTon,
        pickupAddress: request.pickupAddress,
        deadline: request.deadline,
        status: request.status,
        canAcceptSelection: request.status === 'recipient_selected' && request.selectedRecipientId === req.user.id,
        canConfirmCombination: ['awaiting_operator_confirmation', 'awaiting_transporter_confirmation', 'awaiting_recipient_confirmation'].includes(request.workflowStatus) && request.selectedRecipientId === req.user.id && !request.recipientConfirmed,
        myOffer: offersByRequestId.get(request.id) || null,
      }))
    );
  } catch (error) {
    return next(error);
  }
}

async function acceptRecipientSelection(req, res, next) {
  try {
    const { id } = req.params;

    const request = await WasteRequest.findByPk(id);
    if (!request) {
      return res.status(404).json({ message: 'Waste request not found' });
    }

    if (request.selectedRecipientId !== req.user.id) {
      return res.status(403).json({ message: 'You are not the selected recipient for this request' });
    }

    if (request.status !== 'recipient_selected') {
      return res.status(400).json({ message: 'Request is not awaiting recipient acceptance' });
    }

    await request.update({ status: 'transporter_matching' });

    const matches = await matchOperators({
      cerCode: request.cerCode,
      pickupLat: request.pickupLat,
      pickupLng: request.pickupLng,
    });

    await Promise.all([
      ...matches.transporters.map((item) =>
        notifyUser(item.id, 'transport_phase_match', {
          wasteRequestId: request.id,
          selectedRecipientOfferId: request.selectedRecipientOfferId,
        })
      ),
      notifyUser(request.producerId, 'recipient_selection_accepted', {
        wasteRequestId: request.id,
        recipientId: req.user.id,
      }),
    ]);

    return res.json({
      message: 'Recipient selection accepted',
      requestId: request.id,
      status: request.status,
    });
  } catch (error) {
    return next(error);
  }
}

async function confirmCombination(req, res, next) {
  try {
    const request = await WasteRequest.findByPk(req.params.id);
    if (!request || request.selectedRecipientId !== req.user.id) return res.status(403).json({ message: 'Combinazione non assegnata a questo destinatario' });
    if (!['awaiting_operator_confirmation', 'awaiting_transporter_confirmation', 'awaiting_recipient_confirmation'].includes(request.workflowStatus)) return res.status(400).json({ message: 'La combinazione non attende conferma' });

    const bothOperatorsConfirmed = request.transporterConfirmed;
    const workflowStatus = bothOperatorsConfirmed ? 'confirmed' : 'awaiting_transporter_confirmation';
    const status = bothOperatorsConfirmed ? 'assigned' : request.status;
    await request.update({ recipientConfirmed: true, workflowStatus, status });

    await notifyUser(request.producerId, 'recipient_combination_confirmed', { wasteRequestId: request.id, workflowStatus });
    if (bothOperatorsConfirmed) {
      await notifyUser(request.producerId, 'combination_accepted', { wasteRequestId: request.id, status });
    }

    return res.json({ requestId: request.id, workflowStatus, status });
  } catch (error) {
    return next(error);
  }
}

async function createRecipientOffer(req, res, next) {
  try {
    const {
      wasteRequestId,
      pricePerTon,
      pricingUnit,
      destinationAddress,
      availableCapacityTon,
      quantityTolerancePercent,
      availabilityWindow,
      availabilityStatus,
      notes,
    } = req.body;

    const request = await WasteRequest.findByPk(wasteRequestId);
    if (!request) {
      return res.status(404).json({ message: 'Waste request not found' });
    }

    if (!RECIPIENT_OFFERABLE_STATUSES.includes(request.status)) {
      return res.status(400).json({ message: 'Waste request is not accepting recipient offers' });
    }

    const existingOffer = await RecipientOffer.findOne({
      where: {
        wasteRequestId,
        recipientId: req.user.id,
      },
    });

    if (existingOffer) {
      await existingOffer.update({
        pricePerTon,
        pricingUnit: pricingUnit || 'per_ton',
        destinationAddress,
        availableCapacityTon,
        quantityTolerancePercent: quantityTolerancePercent ?? 1,
        availabilityWindow,
        availabilityStatus: availabilityStatus || 'available',
        notes,
      });

      if (request.status === 'recipient_matching') {
        await request.update({ status: 'recipient_options_ready' });
      }

      return res.json({ offer: existingOffer, requestStatus: request.status === 'recipient_matching' ? 'recipient_options_ready' : request.status });
    }

    const offer = await RecipientOffer.create({
      wasteRequestId,
      recipientId: req.user.id,
      pricePerTon,
      pricingUnit: pricingUnit || 'per_ton',
      destinationAddress,
      availableCapacityTon,
      quantityTolerancePercent: quantityTolerancePercent ?? 1,
      availabilityWindow,
      availabilityStatus: availabilityStatus || 'available',
      notes,
    });

    if (request.status === 'recipient_matching') {
      await request.update({ status: 'recipient_options_ready' });
    }

    return res.status(201).json({ offer, requestStatus: request.status === 'recipient_matching' ? 'recipient_options_ready' : request.status });
  } catch (error) {
    return next(error);
  }
}

async function setCerPricing(req, res) {
  return res.json({
    message: 'CER pricing updated (placeholder)',
    payload: req.body,
  });
}

async function setCapacity(req, res) {
  return res.json({
    message: 'Capacity calendar updated (placeholder)',
    payload: req.body,
  });
}

async function getIncomingShipments(req, res, next) {
  try {
    const requests = await WasteRequest.findAll({
      where: {
        selectedRecipientId: req.user.id,
      },
      attributes: ['id', 'cerCode', 'quantityTon', 'pickupAddress', 'deadline', 'status', 'selectedTransporterId', 'created_at'],
      order: [['created_at', 'DESC']],
    });

    const offers = await RecipientOffer.findAll({
      where: {
        recipientId: req.user.id,
        wasteRequestId: { [Op.in]: requests.map((item) => item.id) },
      },
      attributes: ['wasteRequestId', 'pricePerTon', 'destinationAddress'],
    });

    const offerByRequestId = new Map(offers.map((item) => [item.wasteRequestId, item]));

    return res.json(
      requests.map((item) => {
        const offer = offerByRequestId.get(item.id);
        return {
          id: item.id,
          cerCode: item.cerCode,
          quantityTon: item.quantityTon,
          pickupAddress: item.pickupAddress,
          deadline: item.deadline,
          status: item.status,
          destinationAddress: offer?.destinationAddress || '-',
          recipientPricePerTon: offer?.pricePerTon || 0,
          canUpdateStatus: Boolean(STATUS_TRANSITIONS[item.status]),
          allowedNextStatuses: STATUS_TRANSITIONS[item.status] || [],
        };
      })
    );
  } catch (error) {
    return next(error);
  }
}

async function updateIncomingStatus(req, res, next) {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const request = await WasteRequest.findByPk(id);
    if (!request) {
      return res.status(404).json({ message: 'Waste request not found' });
    }

    if (request.selectedRecipientId !== req.user.id) {
      return res.status(403).json({ message: 'You are not assigned as recipient for this request' });
    }

    const allowed = STATUS_TRANSITIONS[request.status] || [];
    if (!allowed.includes(status)) {
      return res.status(400).json({ message: `Transition ${request.status} -> ${status} is not allowed` });
    }

    await request.update({ status });

    await notifyUser(request.producerId, 'activity_status_updated', {
      wasteRequestId: request.id,
      actorRole: 'recipient',
      recipientId: req.user.id,
      status: request.status,
    });

    if (request.selectedTransporterId) {
      await notifyUser(request.selectedTransporterId, 'activity_status_updated', {
        wasteRequestId: request.id,
        actorRole: 'recipient',
        recipientId: req.user.id,
        status: request.status,
      });
    }

    return res.json({
      message: 'Activity status updated',
      requestId: request.id,
      status: request.status,
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  getNotificationsFeed,
  createRecipientOffer,
  acceptRecipientSelection,
  confirmCombination,
  setCerPricing,
  setCapacity,
  getIncomingShipments,
  updateIncomingStatus,
};
