const express = require('express');
const auth = require('../middleware/auth');
const roleGuard = require('../middleware/roleGuard');
const validate = require('../middleware/validation');
const uuidParam = require('../middleware/uuidParam');
const c = require('../controllers/agreementController');

// Agreement on day/time: the only part of the flow shared by the three roles.
// Every handler checks that the caller is part of the selected package.
const router = express.Router();

router.param('id', uuidParam);
router.param('slotId', uuidParam);

router.use(auth);
router.post('/:id/slots', roleGuard(['producer', 'recipient', 'transporter']), validate(['scheduledAt']), c.proposeSlot);
router.post('/:id/slots/:slotId/accept', roleGuard(['producer', 'recipient', 'transporter']), c.acceptSlot);
router.post('/:id/reject', roleGuard(['recipient', 'transporter']), c.rejectPackage);

module.exports = router;
