const express = require('express');
const auth = require('../middleware/auth');
const roleGuard = require('../middleware/roleGuard');
const { getAuctionRoom, closeAuctionByDeadline } = require('../controllers/auctionController');

const router = express.Router();

router.use(auth);
router.get('/:wasteRequestId', roleGuard(['producer', 'transporter', 'recipient', 'admin']), getAuctionRoom);
router.post('/:wasteRequestId/close', roleGuard(['producer', 'admin']), closeAuctionByDeadline);

module.exports = router;
