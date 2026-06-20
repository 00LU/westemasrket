const express = require('express');
const auth = require('../middleware/auth');
const roleGuard = require('../middleware/roleGuard');
const validate = require('../middleware/validation');
const {
  getNotificationsFeed,
  createRecipientOffer,
  acceptRecipientSelection,
  updateIncomingStatus,
  setCerPricing,
  setCapacity,
  getIncomingShipments,
} = require('../controllers/recipientController');

const router = express.Router();

router.use(auth, roleGuard(['recipient']));
router.get('/notifications', getNotificationsFeed);
router.post('/offers', validate(['wasteRequestId', 'pricePerTon', 'destinationAddress']), createRecipientOffer);
router.patch('/waste-requests/:id/accept-selection', acceptRecipientSelection);
router.patch('/waste-requests/:id/status', validate(['status']), updateIncomingStatus);
router.post('/pricing', setCerPricing);
router.post('/capacity', setCapacity);
router.get('/incoming', getIncomingShipments);

module.exports = router;
