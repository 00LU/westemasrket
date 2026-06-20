const { Op } = require('sequelize');
const { Bid, RecipientOffer, User, WasteRequest } = require('../models');

const TRANSPORT_BIDDING_STATUSES = ['transporter_matching', 'package_options_ready'];

async function createBid(req, res, next) {
  try {
    const {
      wasteRequestId,
      transportPrice,
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

    if (!request.selectedRecipientId || !request.selectedRecipientOfferId) {
      return res.status(400).json({ message: 'Recipient must be selected before transport offers' });
    }

    const selectedRecipientOffer = await RecipientOffer.findByPk(request.selectedRecipientOfferId);
    if (!selectedRecipientOffer) {
      return res.status(400).json({ message: 'Selected recipient offer not found' });
    }

    const treatmentPrice = Number(selectedRecipientOffer.pricePerTon || 0) * Number(request.quantityTon || 0);
    const totalPrice = Number(transportPrice) + Number(treatmentPrice);

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
        recipientId: request.selectedRecipientId,
        transportPrice,
        treatmentPrice,
        totalPrice,
        vehicleType,
        availability,
      });
    } else {
      bid = await Bid.create({
        wasteRequestId,
        transporterId: req.user.id,
        recipientId: request.selectedRecipientId,
        transportPrice,
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
