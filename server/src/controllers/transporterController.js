const { Op } = require('sequelize');
const { Bid, RecipientOffer, WasteRequest } = require('../models');
const { notifyUser } = require('../services/notificationService');

const TRANSPORTER_VISIBLE_STATUSES = ['recipient_matching', 'recipient_options_ready', 'transporter_matching', 'package_options_ready'];
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
          {
            status: { [Op.in]: TRANSPORTER_VISIBLE_STATUSES },
          },
          {
            status: 'package_selected',
            selectedTransporterId: req.user.id,
            selectedRecipientOfferId: { [Op.not]: null },
          },
        ],
      },
      attributes: ['id', 'cerCode', 'quantityTon', 'pickupAddress', 'deadline', 'status', 'workflowStatus', 'transporterConfirmed', 'recipientConfirmed', 'selectedRecipientOfferId', 'selectedTransporterId', 'selectedBidId'],
      order: [['created_at', 'DESC']],
    });

    if (requests.length === 0) {
      return res.json([]);
    }

    const offerIds = requests.map((item) => item.selectedRecipientOfferId).filter(Boolean);
    const recipientOffers = await RecipientOffer.findAll({ where: { id: { [Op.in]: offerIds } } });
    const recipientOfferById = new Map(recipientOffers.map((item) => [item.id, item]));

    const myBids = await Bid.findAll({
      where: {
        transporterId: req.user.id,
        wasteRequestId: { [Op.in]: requests.map((item) => item.id) },
      },
      order: [['created_at', 'DESC']],
    });
    const myBidByRequestId = new Map(myBids.map((item) => [item.wasteRequestId, item]));

    return res.json(
      requests.map((request) => {
        const selectedOffer = recipientOfferById.get(request.selectedRecipientOfferId);
        const myBid = myBidByRequestId.get(request.id);
        return {
          id: request.id,
          cerCode: request.cerCode,
          quantityTon: request.quantityTon,
          pickupAddress: request.pickupAddress,
          destinationAddress: selectedOffer?.destinationAddress || '-',
          deadline: request.deadline,
          status: request.status,
          recipientPricePerTon: selectedOffer?.pricePerTon || 0,
          myBid: myBid
            ? {
                id: myBid.id,
                transportPrice: myBid.transportPrice,
                pricingMode: myBid.pricingMode,
                distanceKm: myBid.distanceKm,
                totalPrice: myBid.totalPrice,
                vehicleType: myBid.vehicleType,
                availability: myBid.availability,
                status: myBid.status,
              }
            : null,
          canAcceptSelection:
            request.status === 'package_selected'
            && request.selectedTransporterId === req.user.id
            && Boolean(myBid)
            && request.selectedBidId === myBid.id,
          canConfirmCombination: ['awaiting_operator_confirmation', 'awaiting_transporter_confirmation', 'awaiting_recipient_confirmation'].includes(request.workflowStatus) && request.selectedTransporterId === req.user.id && !request.transporterConfirmed,
        };
      })
    );
  } catch (error) {
    return next(error);
  }
}

async function acceptTransportSelection(req, res, next) {
  try {
    const { id } = req.params;

    const request = await WasteRequest.findByPk(id);
    if (!request) {
      return res.status(404).json({ message: 'Waste request not found' });
    }

    if (request.selectedTransporterId !== req.user.id) {
      return res.status(403).json({ message: 'You are not the selected transporter for this request' });
    }

    if (request.status !== 'package_selected') {
      return res.status(400).json({ message: 'Request is not awaiting transporter acceptance' });
    }

    await request.update({ status: 'assigned' });

    await Promise.all([
      notifyUser(request.producerId, 'transport_selection_accepted', {
        wasteRequestId: request.id,
        transporterId: req.user.id,
      }),
      request.selectedRecipientId
        ? notifyUser(request.selectedRecipientId, 'transport_confirmed', {
            wasteRequestId: request.id,
            transporterId: req.user.id,
          })
        : Promise.resolve(),
    ]);

    return res.json({
      message: 'Transport selection accepted',
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
    if (!request || request.selectedTransporterId !== req.user.id) return res.status(403).json({ message: 'Combinazione non assegnata a questo trasportatore' });
    if (!['awaiting_operator_confirmation', 'awaiting_transporter_confirmation', 'awaiting_recipient_confirmation'].includes(request.workflowStatus)) return res.status(400).json({ message: 'La combinazione non attende conferma' });

    const workflowStatus = request.recipientConfirmed ? 'confirmed' : 'awaiting_recipient_confirmation';
    await request.update({ transporterConfirmed: true, workflowStatus });
    await notifyUser(request.producerId, 'transporter_combination_confirmed', { wasteRequestId: request.id, workflowStatus });
    return res.json({ requestId: request.id, workflowStatus });
  } catch (error) {
    return next(error);
  }
}

async function getActiveJobs(req, res, next) {
  try {
    const requests = await WasteRequest.findAll({
      where: {
        selectedTransporterId: req.user.id,
      },
      attributes: ['id', 'cerCode', 'quantityTon', 'pickupAddress', 'deadline', 'status', 'selectedBidId', 'created_at'],
      order: [['created_at', 'DESC']],
    });

    const myBids = await Bid.findAll({
      where: {
        transporterId: req.user.id,
        wasteRequestId: { [Op.in]: requests.map((item) => item.id) },
      },
      attributes: ['id', 'wasteRequestId', 'transportPrice', 'totalPrice', 'vehicleType', 'availability', 'status'],
      order: [['created_at', 'DESC']],
    });

    const bidByRequestId = new Map(myBids.map((item) => [item.wasteRequestId, item]));

    return res.json(
      requests.map((item) => ({
        id: item.id,
        cerCode: item.cerCode,
        quantityTon: item.quantityTon,
        pickupAddress: item.pickupAddress,
        deadline: item.deadline,
        status: item.status,
        myBid: bidByRequestId.get(item.id) || null,
        canUpdateStatus: Boolean(STATUS_TRANSITIONS[item.status]),
        allowedNextStatuses: STATUS_TRANSITIONS[item.status] || [],
      }))
    );
  } catch (error) {
    return next(error);
  }
}

async function updateJobStatus(req, res, next) {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const request = await WasteRequest.findByPk(id);
    if (!request) {
      return res.status(404).json({ message: 'Waste request not found' });
    }

    if (request.selectedTransporterId !== req.user.id) {
      return res.status(403).json({ message: 'You are not assigned as transporter for this request' });
    }

    const allowed = STATUS_TRANSITIONS[request.status] || [];
    if (!allowed.includes(status)) {
      return res.status(400).json({ message: `Transition ${request.status} -> ${status} is not allowed` });
    }

    await request.update({ status });

    await notifyUser(request.producerId, 'activity_status_updated', {
      wasteRequestId: request.id,
      actorRole: 'transporter',
      transporterId: req.user.id,
      status: request.status,
    });

    if (request.selectedRecipientId) {
      await notifyUser(request.selectedRecipientId, 'activity_status_updated', {
        wasteRequestId: request.id,
        actorRole: 'transporter',
        transporterId: req.user.id,
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

async function getEarnings(req, res, next) {
  try {
    const bids = await Bid.findAll({ where: { transporterId: req.user.id, status: 'accepted' } });
    const gross = bids.reduce((sum, item) => sum + Number(item.transportPrice || 0), 0);
    return res.json({
      gross,
      jobs: bids.length,
      currency: 'EUR',
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  getNotificationsFeed,
  acceptTransportSelection,
  confirmCombination,
  getActiveJobs,
  updateJobStatus,
  getEarnings,
};
