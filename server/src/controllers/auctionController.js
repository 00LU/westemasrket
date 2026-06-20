const { WasteRequest, Bid } = require('../models');
const { closeAuction } = require('../services/auctionManager');

async function getAuctionRoom(req, res, next) {
  try {
    const { wasteRequestId } = req.params;
    const request = await WasteRequest.findByPk(wasteRequestId);
    const bids = await Bid.findAll({ where: { wasteRequestId }, order: [['totalPrice', 'ASC']] });
    return res.json({ request, bids });
  } catch (error) {
    return next(error);
  }
}

async function closeAuctionByDeadline(req, res, next) {
  try {
    const { wasteRequestId } = req.params;
    const tx = await closeAuction(wasteRequestId);
    return res.json({ message: 'Auction closed', transaction: tx });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  getAuctionRoom,
  closeAuctionByDeadline,
};
