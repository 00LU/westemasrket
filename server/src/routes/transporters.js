const express = require('express');
const auth = require('../middleware/auth');
const roleGuard = require('../middleware/roleGuard');
const uuidParam = require('../middleware/uuidParam');
const c = require('../controllers/transporterController');

const router = express.Router();

router.param('id', uuidParam);

router.use(auth, roleGuard(['transporter']));
router.get('/pickups', c.listPickups);
router.get('/pickups/:id', c.getPickup);
router.post('/pickups/:id/proposal', c.submitProposal);
router.get('/earnings', c.getEarnings);

module.exports = router;
