const express = require('express');
const auth = require('../middleware/auth');
const roleGuard = require('../middleware/roleGuard');
const validate = require('../middleware/validation');
const uuidParam = require('../middleware/uuidParam');
const c = require('../controllers/producerController');

const router = express.Router();

router.param('id', uuidParam);
router.param('packageId', uuidParam);

router.use(auth, roleGuard(['producer']));
router.post('/pricing/estimate', validate(['quantityTon', 'distanceKm']), c.estimatePrice);

router.get('/pickups', c.listPickups);
router.get('/pickups/recurring', c.listRecurring);
router.post('/pickups/:id/repeat', c.repeatRecurring);
router.post('/pickups', validate(['quantityTon', 'pickupAddress', 'deadline', 'maxPrice']), c.createPickup);
router.get('/pickups/:id', c.getPickup);
router.patch('/pickups/:id', c.updatePickup);
router.post('/pickups/:id/publish', c.publishPickup);
router.post('/pickups/:id/close-recipients', c.closeRecipients);
router.post('/pickups/:id/close-transporters', c.closeTransporters);
router.post('/pickups/:id/packages/:packageId/select', c.selectPackage);
router.post('/pickups/:id/withdraw-selection', c.withdrawSelection);
router.post('/pickups/:id/cancel', c.cancelPickup);

module.exports = router;
