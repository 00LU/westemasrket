const { Op } = require('sequelize');
const { Bid, RecipientOffer, User, WasteRequest } = require('../models');

const TRANSPORT_BIDDING_STATUSES = ['recipient_matching', 'recipient_options_ready', 'transporter_matching', 'package_options_ready'];

async function createBid(req, res, next) {
  try {
    const {
      wasteRequestId,
      transportPrice,
      pricingMode = 'fixed_trip',
      distanceKm,
      fixedPrice,
      vehicleType,
      availability,
    } = req.body;

    const request = await WasteRequest.findByPk(wasteRequestId);
    if (!request) {
      return res.status(404).json({ message: 'Waste request not found' });
    }

    if (!TRANSPORT_BIDDING_STATUSES.includes(request.status)) {
      return res.status(400).json({ message: 'Waste request is not open for transport offers' });
    }

    const selectedRecipientOffer = request.selectedRecipientOfferId
      ? await RecipientOffer.findByPk(request.selectedRecipientOfferId)
      : null;
    const treatmentPrice = selectedRecipientOffer ? Number(selectedRecipientOffer.pricePerTon || 0) * Number(request.quantityTon || 0) : 0;
    const calculatedTransportPrice = pricingMode === 'per_km'
      ? Number(distanceKm || 0) * Number(transportPrice || 0)
      : Number(fixedPrice ?? transportPrice ?? 0);
    const totalPrice = Number(calculatedTransportPrice) + Number(treatmentPrice);

    const existingBid = await Bid.findOne({
      where: {
        wasteRequestId,
        transporterId: req.user.id,
        status: { [Op.in]: ['active'] },
      },
    });

    let bid;
    if (existingBid) {
      bid = await existingBid.update({
        recipientId: request.selectedRecipientId || null,
        transportPrice: calculatedTransportPrice,
        pricingMode,
        distanceKm: Number(distanceKm || 0),
        treatmentPrice,
        totalPrice,
        vehicleType,
        availability,
      });
    } else {
      bid = await Bid.create({
        wasteRequestId,
        transporterId: req.user.id,
        recipientId: request.selectedRecipientId || null,
        transportPrice: calculatedTransportPrice,
        pricingMode,
        distanceKm: Number(distanceKm || 0),
        treatmentPrice,
        totalPrice,
        status: 'active',
        vehicleType,
        availability,
      });
    }

    if (request.status === 'transporter_matching') {
      await request.update({ status: 'package_options_ready' });
    }

    return res.status(existingBid ? 200 : 201).json({
      bid,
      requestStatus: request.status === 'transporter_matching'
        ? 'package_options_ready'
        : request.status,
    });
  } catch (error) {
    return next(error);
  }
}

async function listBidsByRequest(req, res, next) {
  try {
    const { wasteRequestId } = req.params;
    const bids = await Bid.findAll({
      where: { wasteRequestId },
      include: [
        {
          model: User,
          as: 'transporter',
          attributes: ['id', 'companyName', 'email'],
        },
      ],
      order: [['total_price', 'ASC']],
    });
    return res.json(bids);
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  createBid,
  listBidsByRequest,
};
