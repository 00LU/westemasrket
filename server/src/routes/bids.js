const express = require('express');
const auth = require('../middleware/auth');
const roleGuard = require('../middleware/roleGuard');
const validate = require('../middleware/validation');
const { createBid, listBidsByRequest } = require('../controllers/bidController');

const router = express.Router();

router.use(auth);
router.post('/', roleGuard(['transporter']), validate(['wasteRequestId', 'transportPrice']), createBid);
router.get('/:wasteRequestId', roleGuard(['producer', 'transporter', 'recipient', 'admin']), listBidsByRequest);

module.exports = router;
