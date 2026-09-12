const express = require('express');
const auth = require('../middleware/auth');
const roleGuard = require('../middleware/roleGuard');
const validate = require('../middleware/validation');
const {
  createWasteRequest,
  getActiveOrders,
  getOrderHistory,
  getRecurringOrders,
  repeatWasteRequest,
  updateOrderStatus,
  estimatePrice,
  getAuctionData,
  getRecipientOffers,
  getRecipientOffersBoard,
  getCombinationsBoard,
  selectCombination,
  selectRecipientOffer,
  selectTransportBid,
} = require('../controllers/producerController');

const router = express.Router();

router.use(auth, roleGuard(['producer']));
router.post('/waste-requests', validate(['cerCode', 'quantityTon', 'pickupAddress', 'deadline', 'maxPrice']), createWasteRequest);
router.post('/pricing/estimate', validate(['quantityTon', 'distanceKm']), estimatePrice);
router.get('/recipient-offers', getRecipientOffersBoard);
router.get('/combinations', getCombinationsBoard);
router.post('/waste-requests/:id/select-combination', validate(['bidId', 'recipientOfferId']), selectCombination);
router.patch('/waste-requests/:id/select-recipient', validate(['recipientOfferId']), selectRecipientOffer);
router.patch('/waste-requests/:id/select-transport', validate(['bidId']), selectTransportBid);
router.patch('/waste-requests/:id/status', validate(['status']), updateOrderStatus);
router.get('/waste-requests/:id/recipient-offers', getRecipientOffers);
router.get('/orders/active', getActiveOrders);
router.get('/orders/history', getOrderHistory);
router.get('/orders/recurring', getRecurringOrders);
router.post('/orders/recurring/:id/repeat', repeatWasteRequest);
router.get('/auctions/:id', getAuctionData);

module.exports = router;
