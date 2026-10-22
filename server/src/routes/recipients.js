const express = require('express');
const auth = require('../middleware/auth');
const roleGuard = require('../middleware/roleGuard');
const uuidParam = require('../middleware/uuidParam');
const c = require('../controllers/recipientController');

const router = express.Router();

router.param('id', uuidParam);

router.use(auth, roleGuard(['recipient']));
router.get('/pickups', c.listPickups);
router.get('/pickups/:id', c.getPickup);
router.post('/pickups/:id/availability', c.respondAvailability);
router.post('/pricing', c.setCerPricing);
router.post('/capacity', c.setCapacity);

module.exports = router;
