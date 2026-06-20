const { Op } = require('sequelize');
const { WasteRequest, Bid, RecipientOffer, User } = require('../models');
const { calculateSuggestedRange } = require('../services/pricingCalculator');
const { matchOperators } = require('../services/matchingEngine');
const { notifyUser } = require('../services/notificationService');

const ACTIVE_REQUEST_STATUSES = [
  'recipient_matching',
  'recipient_options_ready',
  'recipient_selected',
  'transporter_matching',
  'package_options_ready',
  'package_selected',
  'assigned',
  'in_execution',
  'delivered',
  'active',
  'awarded',
];

const STATUS_TRANSITIONS = {
  recipient_matching: ['cancelled'],
  recipient_options_ready: ['cancelled'],
  recipient_selected: ['cancelled'],
  transporter_matching: ['cancelled'],
  package_options_ready: ['cancelled'],
  package_selected: ['cancelled'],
  assigned: ['in_execution', 'cancelled'],
  in_execution: ['delivered', 'cancelled'],
  delivered: ['completed'],
  completed: [],
  cancelled: [],
  expired: [],
};

async function createWasteRequest(req, res, next) {
  try {
    const payload = req.body;
    const request = await WasteRequest.create({
      producerId: req.user.id,
      cerCode: payload.cerCode,
      quantityTon: payload.quantityTon,
      pickupAddress: payload.pickupAddress,
      pickupLat: payload.pickupLat,
      pickupLng: payload.pickupLng,
      deadline: payload.deadline,
      maxPrice: payload.maxPrice,
      status: 'recipient_matching',
    });

    const matches = await matchOperators({
      cerCode: payload.cerCode,
      pickupLat: payload.pickupLat,
      pickupLng: payload.pickupLng,
    });

    await Promise.all([
      ...matches.transporters.map((item) => notifyUser(item.id, 'new_request_match', { wasteRequestId: request.id })),
      ...matches.recipients.map((item) => notifyUser(item.id, 'new_request_match', { wasteRequestId: request.id })),
    ]);

    return res.status(201).json({ request, matches });
  } catch (error) {
    return next(error);
  }
}

async function getActiveOrders(req, res, next) {
  try {
    const orders = await WasteRequest.findAll({
      where: {
        producerId: req.user.id,
        status: { [Op.in]: ACTIVE_REQUEST_STATUSES },
      },
      order: [['created_at', 'DESC']],
    });
    return res.json(orders);
  } catch (error) {
    return next(error);
  }
}

async function getOrderHistory(req, res, next) {
  try {
    const orders = await WasteRequest.findAll({
      where: {
        producerId: req.user.id,
      },
      order: [['created_at', 'DESC']],
    });
    return res.json(orders);
  } catch (error) {
    return next(error);
  }
}

async function updateOrderStatus(req, res, next) {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const request = await WasteRequest.findOne({ where: { id, producerId: req.user.id } });
    if (!request) {
      return res.status(404).json({ message: 'Waste request not found' });
    }

    const allowed = STATUS_TRANSITIONS[request.status] || [];
    if (!allowed.includes(status)) {
      return res.status(400).json({ message: `Transition ${request.status} -> ${status} is not allowed` });
    }

    await request.update({ status });
    return res.json({
      message: 'Request status updated',
      requestId: request.id,
      status: request.status,
    });
  } catch (error) {
    return next(error);
  }
}

async function estimatePrice(req, res, next) {
  try {
    const { hazardous, quantityTon, distanceKm, urgency } = req.body;
    const range = calculateSuggestedRange({ hazardous, quantityTon, distanceKm, urgency });
    return res.json(range);
  } catch (error) {
    return next(error);
  }
}

async function getAuctionData(req, res, next) {
  try {
    const { id } = req.params;
    const request = await WasteRequest.findByPk(id);
    const bids = await Bid.findAll({ where: { wasteRequestId: id }, order: [['totalPrice', 'ASC']] });
    return res.json({ request, bids });
  } catch (error) {
    return next(error);
  }
}

async function getRecipientOffers(req, res, next) {
  try {
    const { id } = req.params;
    const request = await WasteRequest.findOne({ where: { id, producerId: req.user.id } });

    if (!request) {
      return res.status(404).json({ message: 'Waste request not found' });
    }

    const offers = await RecipientOffer.findAll({
      where: { wasteRequestId: id },
      include: [
        {
          model: User,
          as: 'recipient',
          attributes: ['id', 'companyName', 'email'],
        },
      ],
      order: [['price_per_ton', 'ASC']],
    });

    return res.json({
      requestId: id,
      status: request.status,
      selectedRecipientId: request.selectedRecipientId,
      selectedRecipientOfferId: request.selectedRecipientOfferId,
      offers,
    });
  } catch (error) {
    return next(error);
  }
}

async function getRecipientOffersBoard(req, res, next) {
  try {
    const requests = await WasteRequest.findAll({
      where: {
        producerId: req.user.id,
        status: { [Op.in]: ACTIVE_REQUEST_STATUSES },
      },
      attributes: ['id', 'cerCode', 'quantityTon', 'pickupAddress', 'status', 'selectedRecipientOfferId', 'selectedBidId', 'created_at'],
      order: [['created_at', 'DESC']],
    });

    if (requests.length === 0) {
      return res.json([]);
    }

    const requestIds = requests.map((item) => item.id);
    const offers = await RecipientOffer.findAll({
      where: { wasteRequestId: { [Op.in]: requestIds } },
      include: [
        {
          model: User,
          as: 'recipient',
          attributes: ['id', 'companyName', 'email'],
        },
      ],
      order: [['price_per_ton', 'ASC']],
    });

    const offersByRequest = offers.reduce((acc, offer) => {
      const key = offer.wasteRequestId;
      if (!acc[key]) acc[key] = [];
      acc[key].push(offer);
      return acc;
    }, {});

    const bids = await Bid.findAll({
      where: {
        wasteRequestId: { [Op.in]: requestIds },
        status: { [Op.in]: ['active', 'accepted'] },
      },
      include: [
        {
          model: User,
          as: 'transporter',
          attributes: ['id', 'companyName', 'email'],
        },
      ],
      order: [['total_price', 'ASC']],
    });

    const bidsByRequest = bids.reduce((acc, bid) => {
      const key = bid.wasteRequestId;
      if (!acc[key]) acc[key] = [];
      acc[key].push(bid);
      return acc;
    }, {});

    const board = requests.map((request) => ({
      request,
      offers: offersByRequest[request.id] || [],
      bids: bidsByRequest[request.id] || [],
    }));

    return res.json(board);
  } catch (error) {
    return next(error);
  }
}

async function selectRecipientOffer(req, res, next) {
  try {
    const { id } = req.params;
    const { recipientOfferId, allowReplace } = req.body;

    const request = await WasteRequest.findOne({ where: { id, producerId: req.user.id } });
    if (!request) {
      return res.status(404).json({ message: 'Waste request not found' });
    }

    if (!['recipient_options_ready', 'recipient_selected'].includes(request.status)) {
      return res.status(400).json({ message: 'Waste request is not ready for recipient selection' });
    }

    if (request.selectedRecipientOfferId && request.selectedRecipientOfferId === recipientOfferId) {
      return res.json({
        message: 'Recipient already selected',
        requestId: request.id,
        status: request.status,
        selectedRecipientId: request.selectedRecipientId,
        selectedRecipientOfferId: request.selectedRecipientOfferId,
      });
    }

    if (request.selectedRecipientOfferId && !allowReplace) {
      return res.status(409).json({ message: 'Recipient already selected for this request' });
    }

    const offer = await RecipientOffer.findOne({
      where: {
        id: recipientOfferId,
        wasteRequestId: id,
        availabilityStatus: 'available',
      },
    });

    if (!offer) {
      return res.status(404).json({ message: 'Recipient offer not found' });
    }

    await request.update({
      selectedRecipientId: offer.recipientId,
      selectedRecipientOfferId: offer.id,
      status: 'recipient_selected',
    });

    await notifyUser(offer.recipientId, 'recipient_selected', {
      wasteRequestId: request.id,
      recipientOfferId: offer.id,
    });

    return res.json({
      message: 'Recipient selected',
      requestId: request.id,
      status: request.status,
      selectedRecipientId: request.selectedRecipientId,
      selectedRecipientOfferId: request.selectedRecipientOfferId,
    });
  } catch (error) {
    return next(error);
  }
}

async function selectTransportBid(req, res, next) {
  try {
    const { id } = req.params;
    const { bidId, allowReplace } = req.body;

    const request = await WasteRequest.findOne({ where: { id, producerId: req.user.id } });
    if (!request) {
      return res.status(404).json({ message: 'Waste request not found' });
    }

    if (!['package_options_ready', 'package_selected'].includes(request.status)) {
      return res.status(400).json({ message: 'Waste request is not ready for transport selection' });
    }

    if (!request.selectedRecipientId) {
      return res.status(400).json({ message: 'Recipient must be selected before confirming transport offer' });
    }

    if (request.selectedBidId && request.selectedBidId === bidId) {
      return res.json({
        message: 'Transport offer already selected',
        requestId: request.id,
        status: request.status,
        selectedBidId: request.selectedBidId,
        selectedTransporterId: request.selectedTransporterId,
      });
    }

    if (request.selectedBidId && !allowReplace) {
      return res.status(409).json({ message: 'Transport offer already selected for this request' });
    }

    const bid = await Bid.findOne({
      where: {
        id: bidId,
        wasteRequestId: request.id,
        recipientId: request.selectedRecipientId,
        status: { [Op.in]: ['active', 'accepted'] },
      },
    });

    if (!bid) {
      return res.status(404).json({ message: 'Transport offer not found' });
    }

    await Bid.update(
      { status: 'rejected' },
      {
        where: {
          wasteRequestId: request.id,
          id: { [Op.ne]: bid.id },
          status: { [Op.in]: ['active', 'accepted'] },
        },
      }
    );

    await bid.update({ status: 'accepted' });

    await request.update({
      selectedBidId: bid.id,
      selectedTransporterId: bid.transporterId,
      status: 'package_selected',
    });

    await notifyUser(bid.transporterId, 'transport_selected', {
      wasteRequestId: request.id,
      bidId: bid.id,
    });

    return res.json({
      message: 'Transport offer selected',
      requestId: request.id,
      status: request.status,
      selectedBidId: request.selectedBidId,
      selectedTransporterId: request.selectedTransporterId,
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  createWasteRequest,
  getActiveOrders,
  getOrderHistory,
  updateOrderStatus,
  estimatePrice,
  getAuctionData,
  getRecipientOffers,
  getRecipientOffersBoard,
  selectRecipientOffer,
  selectTransportBid,
};
